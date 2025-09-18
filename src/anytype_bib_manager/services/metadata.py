"""Services for retrieving and transforming bibliographic metadata."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Sequence

import httpx

from anytype_bib_manager.config import Settings
from anytype_bib_manager.models import Author, BibliographicRecord
from anytype_bib_manager.services.anytype import AnytypeAPIError, AnytypePublisher
from anytype_bib_manager.services.dedup import (
    DuplicateCandidate,
    DuplicateDetector,
    NoopDuplicateDetector,
)

logger = logging.getLogger(__name__)

CROSSREF_API = "https://api.crossref.org/works"


class MetadataRetrievalError(RuntimeError):
    """Raised when metadata could not be retrieved or parsed."""


@dataclass
class DOIIngestionService:
    """Coordinates DOI metadata retrieval and downstream processing."""

    settings: Settings
    duplicate_detector: DuplicateDetector | None = None
    publisher: AnytypePublisher | None = None
    crossref_mailto: Optional[str] = None
    http_timeout: float = 15.0
    prompt_func: Callable[[str], str] = input

    def fetch_metadata(self, doi: str) -> BibliographicRecord:
        """Fetch metadata by DOI using the CrossRef API."""
        normalized_doi = doi.strip()
        if not normalized_doi:
            raise MetadataRetrievalError("DOI cannot be empty.")

        headers = {
            "User-Agent": "AnytypeBibliographyManager/0.1 (+https://github.com/alberto/Anytype-Bibliography-Manager)"
        }
        params = {}
        mailto = self.crossref_mailto or os.getenv("CROSSREF_MAILTO")
        if mailto:
            params["mailto"] = mailto

        try:
            response = httpx.get(
                f"{CROSSREF_API}/{normalized_doi}",
                params=params,
                headers=headers,
                timeout=self.http_timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise MetadataRetrievalError(f"Failed to retrieve metadata for DOI {normalized_doi}") from exc

        payload = response.json()
        message = payload.get("message")
        if not message:
            raise MetadataRetrievalError("CrossRef response missing 'message' payload")

        title = self._extract_title(message)
        year = self._extract_year(message)
        authors = self._extract_authors(message)
        entry_type = self._map_crossref_type(message.get("type"))

        record = BibliographicRecord(
            doi=message.get("DOI", normalized_doi),
            title=title,
            entry_type=entry_type,
            year=year,
            authors=authors,
            journal=self._extract_journal(message),
            short_journal=self._extract_short_journal(message),
            publisher=message.get("publisher"),
            raw=message,
        )
        logger.debug("Retrieved bibliographic record: %s", record)
        return record

    def generate_bibtex(self, record: BibliographicRecord) -> str:
        """Produce a BibTeX entry from an internal record."""
        citation_key = record.citation_key()
        title_field = f"{{{{ {record.title} }}}}"
        fields = {
            "title": title_field,
            "author": record.formatted_authors(),
            "year": str(record.year),
            "doi": record.doi,
        }
        if record.journal:
            fields["journal"] = record.journal
        if record.publisher and record.entry_type == "book":
            fields["publisher"] = record.publisher

        lines = [f"@{record.entry_type}{{{citation_key},"]
        for key, value in fields.items():
            if value:
                lines.append(f"  {key} = {{{value}}},")
        # Replace trailing comma on last field with closing brace
        if len(lines) > 1:
            lines[-1] = lines[-1].rstrip(',')
        lines.append("}")
        bibtex_entry = "\n".join(lines)
        logger.debug("Generated BibTeX entry:\n%s", bibtex_entry)
        return bibtex_entry

    def publish_to_anytype(
        self,
        record: BibliographicRecord,
        bibtex_entry: str,
        pdf: Optional[Path],
    ) -> None:
        """Send results to Anytype, performing duplicate resolution if required."""
        if not self.publisher:
            raise RuntimeError("Anytype publisher has not been configured.")

        detector = self.duplicate_detector or NoopDuplicateDetector()
        candidates = list(detector.find_duplicates(record))
        if candidates:
            action, selected = self._prompt_duplicate_action(candidates)
            if action == "abort":
                logger.info("User aborted ingest due to duplicates")
                return
            if action == "use_existing" and selected:
                self._update_existing(selected, record, bibtex_entry, pdf)
                return

        created = self.publisher.create_reference(record, bibtex_entry)
        object_id = self._extract_object_id(created)
        logger.info("Created Anytype object %s for DOI %s", object_id, record.doi)
        if pdf:
            self.publisher.attach_pdf(object_id, pdf)
            logger.info("Attached PDF %s to object %s", pdf, object_id)

    def _update_existing(
        self,
        candidate: DuplicateCandidate,
        record: BibliographicRecord,
        bibtex_entry: str,
        pdf: Optional[Path],
    ) -> None:
        if not self.publisher:
            raise RuntimeError("Anytype publisher has not been configured.")
        object_id = candidate.object_id
        self.publisher.update_reference(object_id, record, bibtex_entry)
        logger.info("Updated existing Anytype object %s", object_id)
        if pdf:
            self.publisher.attach_pdf(object_id, pdf)
            logger.info("Attached PDF %s to object %s", pdf, object_id)

    def _prompt_duplicate_action(
        self, candidates: Sequence[DuplicateCandidate]
    ) -> tuple[str, Optional[DuplicateCandidate]]:
        print("Potential duplicates detected:")
        for idx, candidate in enumerate(candidates, start=1):
            print(f"  [{idx}] {candidate.display_label()}")
        print("Options: [a]bort, [u]se existing, [c]reate new")

        while True:
            choice = self.prompt_func("Select option: ").strip().lower()
            if choice in {"a", "abort"}:
                return "abort", None
            if choice in {"c", "create"}:
                return "create", None
            if choice in {"u", "use"}:
                index_raw = self.prompt_func(
                    "Enter the number of the object to reuse: "
                ).strip()
                try:
                    index = int(index_raw)
                except ValueError:
                    print("Invalid selection. Please enter a number from the list.")
                    continue
                if 1 <= index <= len(candidates):
                    return "use_existing", candidates[index - 1]
                print("Selection out of range. Try again.")
            else:
                print("Input not recognized. Choose a, u, or c.")

    @staticmethod
    def _extract_object_id(payload: dict[str, object]) -> str:
        object_id = payload.get("id")
        if not object_id:
            raise AnytypeAPIError("Anytype create response missing 'id' field")
        return str(object_id)

    @staticmethod
    def _extract_title(message: dict[str, object]) -> str:
        titles = message.get("title") or []
        if isinstance(titles, list) and titles:
            return titles[0]
        if isinstance(titles, str):
            return titles
        raise MetadataRetrievalError("Title information missing in CrossRef response")

    @staticmethod
    def _extract_year(message: dict[str, object]) -> int:
        for key in ("published-print", "published-online", "issued"):
            date_parts = message.get(key, {}).get("date-parts")
            if date_parts and isinstance(date_parts, list) and date_parts[0]:
                return int(date_parts[0][0])
        raise MetadataRetrievalError("Year information missing in CrossRef response")

    @staticmethod
    def _extract_authors(message: dict[str, object]) -> list[Author]:
        authors_data = message.get("author") or []
        authors: list[Author] = []
        for author in authors_data:
            family = author.get("family") if isinstance(author, dict) else None
            if not family:
                continue
            given = author.get("given") if isinstance(author, dict) else None
            orcid = None
            if isinstance(author, dict):
                orcid_raw = author.get("ORCID")
                if isinstance(orcid_raw, str):
                    orcid = orcid_raw.replace("https://orcid.org/", "")
            authors.append(Author(family=family, given=given, orcid=orcid))
        if not authors:
            logger.warning("No authors found in metadata")
        return authors

    @staticmethod
    def _extract_journal(message: dict[str, object]) -> Optional[str]:
        container = message.get("container-title")
        if isinstance(container, list) and container:
            return container[0]
        if isinstance(container, str):
            return container
        return None

    @staticmethod
    def _extract_short_journal(message: dict[str, object]) -> Optional[str]:
        short = message.get("short-container-title")
        if isinstance(short, list) and short:
            return short[0]
        if isinstance(short, str):
            return short
        return None

    @staticmethod
    def _map_crossref_type(ref_type: Optional[str]) -> str:
        mapping = {
            "journal-article": "article",
            "book": "book",
            "proceedings-article": "inproceedings",
        }
        return mapping.get(ref_type or "", "misc")
