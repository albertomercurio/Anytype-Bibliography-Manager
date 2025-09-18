from anytype_bib_manager.models import Author, BibliographicRecord


def test_author_family_ascii_removes_accents():
    author = Author(family="García", given="María")
    assert author.family_ascii() == "Garcia"


def test_bibliographic_record_citation_key():
    record = BibliographicRecord(
        doi="10.1000/test",
        title="Understanding Quantum Fields",
        entry_type="article",
        year=2024,
        authors=[Author(family="Doe", given="Jane")],
    )
    assert record.citation_key() == "Doe2024Understanding"
