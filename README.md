# Anytype Bibliography Manager

Automation framework to create and maintain Anytype references from DOIs, including metadata ingestion, BibTeX generation, and deduplication support.

## Quick Start

```bash
uv sync
uv run python -m anytype_bib_manager --help
```

## Configuration

Set the required Anytype environment variables before running the tool:

```bash
export ANYTYPE_TOKEN="<your-api-token>"
export ANYTYPE_SPACE_ID="<space-id>"
# Optional overrides
export ANYTYPE_BASE_URL="https://api.anytype.io"
export ANYTYPE_OBJECT_TYPE_ARTICLE="Article"
export ANYTYPE_OBJECT_TYPE_BOOK="Book"
export ANYTYPE_FIELD_DOI="doi"
export ANYTYPE_FIELD_YEAR="year"
export ANYTYPE_FIELD_AUTHORS="authors"
export ANYTYPE_FIELD_JOURNAL="journal"
export ANYTYPE_FIELD_SHORT_JOURNAL="short_journal"
export ANYTYPE_FIELD_BIBTEX="bibtex"
export ANYTYPE_AUTHOR_SEPARATOR="; "
export ANYTYPE_FILE_RELATION_KEY="attachments"
```

Avoid committing secrets to the repository—store sensitive values (like `ANYTYPE_TOKEN`) in your shell configuration or a secrets manager.

## Project Goals

- Fetch metadata for DOIs and optional PDFs using public scholarly APIs.
- Create or update Anytype objects with clean bibliographic data.
- Produce BibTeX entries that respect capitalization and naming rules.
- Detect duplicates across articles, authors, and journals before writing to Anytype.
- Offer optional AI assistance for conflict resolution and summarization.

## Development

Run the test suite after making changes:

```bash
uv run pytest
```

## Status

Core ingestion pipeline, Anytype integration scaffolding, duplicate resolution prompts, and automated tests are in place. Further work is needed to exercise the live Anytype API and add richer AI-backed workflows.
