import pytest

from anytype_bib_manager.config import Settings


@pytest.fixture
def sample_settings() -> Settings:
    return Settings(
        anytype_base_url="https://api.example",
        anytype_token="token",
        anytype_space_id="space",
        anytype_object_type_article="Article",
        anytype_object_type_book="Book",
        anytype_field_doi="doi",
        anytype_field_year="year",
        anytype_field_authors="authors",
        anytype_field_journal="journal",
        anytype_field_short_journal="short_journal",
        anytype_field_bibtex="bibtex",
        anytype_author_separator="; ",
        anytype_file_relation_key="attachments",
    )
