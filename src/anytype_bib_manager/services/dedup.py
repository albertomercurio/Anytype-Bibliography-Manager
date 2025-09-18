"""Duplicate detection interfaces and helpers."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Iterable, Optional

from pydantic import BaseModel, Field

from anytype_bib_manager.config import Settings
from anytype_bib_manager.models import BibliographicRecord

if TYPE_CHECKING:
    from anytype_bib_manager.services.anytype import AnytypeClient

logger = logging.getLogger(__name__)


class DuplicateCandidate(BaseModel):
    """Represents an existing Anytype object that might duplicate an incoming record."""

    object_id: str
    title: Optional[str] = None
    doi: Optional[str] = None
    authors: list[str] = Field(default_factory=list)

    def display_label(self) -> str:
        doi_part = f" DOI={self.doi}" if self.doi else ""
        author_part = f" Authors={', '.join(self.authors)}" if self.authors else ""
        return f"{self.object_id}: {self.title or 'Unknown'}{doi_part}{author_part}"


class DuplicateDetector(ABC):
    """Interface for duplicate detection engines."""

    @abstractmethod
    def find_duplicates(self, record: BibliographicRecord) -> Iterable[DuplicateCandidate]:
        """Yield potential duplicates for the provided bibliographic record."""


class NoopDuplicateDetector(DuplicateDetector):
    """Default detector that performs no duplicate detection."""

    def find_duplicates(self, record: BibliographicRecord) -> Iterable[DuplicateCandidate]:
        return []


class AnytypeDuplicateDetector(DuplicateDetector):
    """Queries Anytype for existing objects that resemble the incoming record."""

    def __init__(self, client: AnytypeClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    def find_duplicates(self, record: BibliographicRecord) -> Iterable[DuplicateCandidate]:
        seen: set[str] = set()
        candidates: list[DuplicateCandidate] = []

        if record.doi:
            doi_matches = self._client.search_by_property(
                property_key=self._settings.anytype_field_doi,
                value=record.doi,
                limit=5,
            )
            self._extend_candidates(candidates, seen, doi_matches)

        author_last_names = {author.family_ascii().lower() for author in record.authors}
        if author_last_names:
            author_matches = self._client.search_by_text(
                query=" ".join(author_last_names),
                limit=5,
            )
            self._extend_candidates(candidates, seen, author_matches)

        if not candidates and record.title:
            title_matches = self._client.search_by_text(query=record.title, limit=3)
            self._extend_candidates(candidates, seen, title_matches)

        if candidates:
            logger.debug("Duplicate detector found candidates: %s", candidates)

        return candidates

    def _extend_candidates(
        self,
        target: list[DuplicateCandidate],
        seen: set[str],
        raw_objects: Iterable[dict[str, object]],
    ) -> None:
        for obj in raw_objects:
            object_id = str(obj.get("id"))
            if object_id in seen:
                continue
            seen.add(object_id)
            fields = obj.get("fields", {})
            title = obj.get("name") or obj.get("title")
            doi = fields.get(self._settings.anytype_field_doi) if isinstance(fields, dict) else None
            authors_field = fields.get(self._settings.anytype_field_authors) if isinstance(fields, dict) else []
            if isinstance(authors_field, str):
                authors = [part.strip() for part in authors_field.split(self._settings.anytype_author_separator)]
            elif isinstance(authors_field, list):
                authors = [str(part) for part in authors_field]
            else:
                authors = []
            target.append(
                DuplicateCandidate(
                    object_id=object_id,
                    title=str(title) if title else None,
                    doi=str(doi) if doi else None,
                    authors=authors,
                )
            )
