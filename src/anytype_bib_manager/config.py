"""Configuration loading for Anytype Bibliography Manager."""

from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass
class Settings:
    anytype_base_url: str
    anytype_token: str
    anytype_space_id: str
    anytype_object_type_article: str
    anytype_object_type_book: str
    anytype_field_doi: str
    anytype_field_year: str
    anytype_field_authors: str
    anytype_field_journal: str
    anytype_field_short_journal: str
    anytype_field_bibtex: str
    anytype_author_separator: str
    anytype_file_relation_key: str


DEFAULT_BASE_URL = "https://api.anytype.io"


def load_settings() -> Settings:
    """Load configuration from environment variables."""
    base_url = os.getenv("ANYTYPE_BASE_URL", DEFAULT_BASE_URL)
    token = os.getenv("ANYTYPE_TOKEN")
    space_id = os.getenv("ANYTYPE_SPACE_ID")

    if not token or not space_id:
        raise RuntimeError(
            "ANYTYPE_TOKEN and ANYTYPE_SPACE_ID must be set in the environment."
        )

    return Settings(
        anytype_base_url=base_url,
        anytype_token=token,
        anytype_space_id=space_id,
        anytype_object_type_article=os.getenv("ANYTYPE_OBJECT_TYPE_ARTICLE", "Article"),
        anytype_object_type_book=os.getenv("ANYTYPE_OBJECT_TYPE_BOOK", "Book"),
        anytype_field_doi=os.getenv("ANYTYPE_FIELD_DOI", "doi"),
        anytype_field_year=os.getenv("ANYTYPE_FIELD_YEAR", "year"),
        anytype_field_authors=os.getenv("ANYTYPE_FIELD_AUTHORS", "authors"),
        anytype_field_journal=os.getenv("ANYTYPE_FIELD_JOURNAL", "journal"),
        anytype_field_short_journal=os.getenv("ANYTYPE_FIELD_SHORT_JOURNAL", "short_journal"),
        anytype_field_bibtex=os.getenv("ANYTYPE_FIELD_BIBTEX", "bibtex"),
        anytype_author_separator=os.getenv("ANYTYPE_AUTHOR_SEPARATOR", "; "),
        anytype_file_relation_key=os.getenv("ANYTYPE_FILE_RELATION_KEY", "attachments"),
    )
