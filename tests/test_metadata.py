from pathlib import Path

from anytype_bib_manager.models import Author, BibliographicRecord
from anytype_bib_manager.services.dedup import DuplicateCandidate
from anytype_bib_manager.services.metadata import DOIIngestionService


class StubDuplicateDetector:
    def find_duplicates(self, record):
        return []


class StubPublisher:
    def __init__(self):
        self.created = []
        self.attached = []
        self.updated = []

    def create_reference(self, record, bibtex_entry):
        self.created.append((record, bibtex_entry))
        return {"id": "obj123"}

    def update_reference(self, object_id, record, bibtex_entry):
        self.updated.append(object_id)
        return {"id": object_id}

    def attach_pdf(self, object_id, pdf_path: Path):
        self.attached.append((object_id, pdf_path))


def build_record() -> BibliographicRecord:
    return BibliographicRecord(
        doi="10.1000/test",
        title="Understanding Quantum Fields",
        entry_type="article",
        year=2024,
        authors=[Author(family="Doe", given="Jane"), Author(family="Smith", given="John")],
        journal="Journal of Testing",
    )


def test_generate_bibtex_wraps_title(sample_settings):
    service = DOIIngestionService(settings=sample_settings)
    record = build_record()
    bibtex = service.generate_bibtex(record)
    assert "{{ Understanding Quantum Fields }}" in bibtex
    assert "Doe2024Understanding" in bibtex
    assert "author = {Doe, Jane and Smith, John}" in bibtex


def test_publish_creates_new_object_without_duplicates(tmp_path, sample_settings):
    pdf = tmp_path / "paper.pdf"
    pdf.write_text("dummy")
    publisher = StubPublisher()
    service = DOIIngestionService(
        settings=sample_settings,
        duplicate_detector=StubDuplicateDetector(),
        publisher=publisher,
        prompt_func=lambda _: "c",
    )
    record = build_record()
    bibtex = service.generate_bibtex(record)

    service.publish_to_anytype(record, bibtex, pdf)

    assert publisher.created
    assert publisher.attached == [("obj123", pdf)]
    assert not publisher.updated


class StubDuplicateDetectorWithCandidate:
    def __init__(self, candidate):
        self._candidate = candidate

    def find_duplicates(self, record):
        return [self._candidate]


def test_publish_updates_existing_when_user_selects_use(tmp_path, sample_settings):
    pdf = tmp_path / "paper.pdf"
    pdf.write_text("dummy")
    candidate = DuplicateCandidate(object_id="existing", title="Existing", doi="10.1000/test")
    detector = StubDuplicateDetectorWithCandidate(candidate)
    publisher = StubPublisher()
    inputs = iter(["u", "1"])
    service = DOIIngestionService(
        settings=sample_settings,
        duplicate_detector=detector,
        publisher=publisher,
        prompt_func=lambda _: next(inputs),
    )
    record = build_record()
    bibtex = service.generate_bibtex(record)

    service.publish_to_anytype(record, bibtex, pdf)

    assert publisher.updated == ["existing"]
    assert not publisher.created
    assert publisher.attached == [("existing", pdf)]
