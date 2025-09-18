"""High-level pipeline orchestration for DOI ingestion."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

from anytype_bib_manager.config import Settings
from anytype_bib_manager.services.anytype import AnytypeAPIError, AnytypeClient, AnytypePublisher
from anytype_bib_manager.services.dedup import AnytypeDuplicateDetector
from anytype_bib_manager.services.metadata import (
    DOIIngestionService,
    MetadataRetrievalError,
)


class PipelineError(RuntimeError):
    """Raised when the DOI processing pipeline fails."""


def run_pipeline(
    doi: str,
    pdf_path: Optional[str],
    dry_run: bool,
    settings: Settings,
    prompt_func: Callable[[str], str] | None = None,
) -> None:
    """Execute the DOI ingestion pipeline."""
    pdf = Path(pdf_path) if pdf_path else None
    if pdf is not None and not pdf.exists():
        raise PipelineError(f"PDF not found at path: {pdf}")

    prompt = prompt_func or input

    if dry_run:
        ingestion_service = DOIIngestionService(settings=settings, prompt_func=prompt)
    else:
        client = AnytypeClient(settings=settings)
        publisher = AnytypePublisher(client=client, settings=settings)
        duplicate_detector = AnytypeDuplicateDetector(client=client, settings=settings)
        ingestion_service = DOIIngestionService(
            settings=settings,
            duplicate_detector=duplicate_detector,
            publisher=publisher,
            prompt_func=prompt,
        )

    try:
        record = ingestion_service.fetch_metadata(doi)
    except MetadataRetrievalError as exc:
        raise PipelineError(str(exc)) from exc

    bibtex_entry = ingestion_service.generate_bibtex(record)

    if dry_run:
        print("Dry run completed. Metadata and BibTeX generated but not sent to Anytype.")
        print(record.model_dump_json(indent=2))
        print(bibtex_entry)
        return

    try:
        ingestion_service.publish_to_anytype(record, bibtex_entry=bibtex_entry, pdf=pdf)
    except AnytypeAPIError as exc:
        raise PipelineError(f"Anytype API error: {exc}") from exc
