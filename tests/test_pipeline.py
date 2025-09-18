from anytype_bib_manager.models import Author, BibliographicRecord
from anytype_bib_manager.pipeline import run_pipeline
from anytype_bib_manager.services.dedup import DuplicateCandidate
from anytype_bib_manager.services.metadata import DOIIngestionService


def make_record() -> BibliographicRecord:
    return BibliographicRecord(
        doi="10.1000/example",
        title="A Study on Pipelines",
        entry_type="article",
        year=2023,
        authors=[Author(family="Doe", given="Jane")],
        journal="Journal",
    )


def test_pipeline_creates_object_without_duplicates(monkeypatch, sample_settings):
    record = make_record()

    monkeypatch.setattr(DOIIngestionService, "fetch_metadata", lambda self, doi: record)

    class FakeAnytypeClient:
        def __init__(self, settings):
            self.settings = settings

    class FakeDuplicateDetector:
        def __init__(self, client, settings):
            pass

        def find_duplicates(self, record):
            return []

    class FakePublisher:
        instances = []

        def __init__(self, client, settings):
            self.created = []
            self.updated = []
            self.attachments = []
            FakePublisher.instances.append(self)

        def create_reference(self, record, bibtex_entry):
            self.created.append((record, bibtex_entry))
            return {"id": "obj123"}

        def update_reference(self, object_id, record, bibtex_entry):
            self.updated.append(object_id)
            return {"id": object_id}

        def attach_pdf(self, object_id, pdf_path):
            self.attachments.append((object_id, pdf_path))

    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypeClient", FakeAnytypeClient)
    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypeDuplicateDetector", FakeDuplicateDetector)
    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypePublisher", FakePublisher)

    run_pipeline("10.1000/example", pdf_path=None, dry_run=False, settings=sample_settings)

    assert FakePublisher.instances
    publisher = FakePublisher.instances[0]
    assert publisher.created
    assert not publisher.updated
    assert not publisher.attachments


def test_pipeline_updates_duplicate_when_user_selects_existing(monkeypatch, sample_settings):
    record = make_record()

    monkeypatch.setattr(DOIIngestionService, "fetch_metadata", lambda self, doi: record)

    class FakeAnytypeClient:
        def __init__(self, settings):
            self.settings = settings

    class FakeDuplicateDetector:
        def __init__(self, client, settings):
            self.candidate = DuplicateCandidate(object_id="existing", title="Existing", doi=record.doi)

        def find_duplicates(self, record):
            return [self.candidate]

    class FakePublisher:
        instances = []

        def __init__(self, client, settings):
            self.created = []
            self.updated = []
            FakePublisher.instances.append(self)

        def create_reference(self, record, bibtex_entry):
            self.created.append((record, bibtex_entry))
            return {"id": "obj456"}

        def update_reference(self, object_id, record, bibtex_entry):
            self.updated.append(object_id)
            return {"id": object_id}

        def attach_pdf(self, object_id, pdf_path):
            pass

    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypeClient", FakeAnytypeClient)
    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypeDuplicateDetector", FakeDuplicateDetector)
    monkeypatch.setattr("anytype_bib_manager.pipeline.AnytypePublisher", FakePublisher)

    responses = iter(["u", "1"])
    prompt = lambda _: next(responses)

    run_pipeline(
        "10.1000/example",
        pdf_path=None,
        dry_run=False,
        settings=sample_settings,
        prompt_func=prompt,
    )

    publisher = FakePublisher.instances[0]
    assert not publisher.created
    assert publisher.updated == ["existing"]
