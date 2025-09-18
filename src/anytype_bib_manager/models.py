"""Core data models used across Anytype Bibliography Manager."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from pydantic import BaseModel, Field


class Author(BaseModel):
    """Represents a single contributor in the bibliographic record."""

    family: str
    given: Optional[str] = None
    orcid: Optional[str] = None

    def display_name(self) -> str:
        if self.given:
            return f"{self.family}, {self.given}"
        return self.family

    def family_ascii(self) -> str:
        normalized = unicodedata.normalize("NFD", self.family)
        stripped = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        ascii_name = stripped.encode("ascii", "ignore").decode("ascii")
        return ascii_name or self.family


class BibliographicRecord(BaseModel):
    """Structured reference metadata returned by DOI lookups."""

    doi: str
    title: str
    entry_type: str
    year: int
    authors: list[Author]
    journal: Optional[str] = None
    short_journal: Optional[str] = None
    publisher: Optional[str] = None
    raw: dict[str, object] = Field(default_factory=dict)

    def first_author(self) -> Optional[Author]:
        return self.authors[0] if self.authors else None

    def formatted_authors(self) -> str:
        return " and ".join(author.display_name() for author in self.authors)

    def citation_key(self) -> str:
        author = self.first_author()
        last_name = author.family_ascii() if author else "unknown"
        year_str = str(self.year)
        title_first_word = self._title_first_word(self.title)
        return re.sub(r"[^A-Za-z0-9]+", "", f"{last_name}{year_str}{title_first_word}")

    @staticmethod
    def _title_first_word(title: str) -> str:
        match = re.search(r"[A-Za-z0-9]+", title)
        return match.group(0) if match else "Title"
