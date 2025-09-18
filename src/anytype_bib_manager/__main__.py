"""Command-line entry point for Anytype Bibliography Manager."""

from __future__ import annotations

import argparse

from anytype_bib_manager.config import load_settings
from anytype_bib_manager.pipeline import run_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="anytype-bib-manager",
        description="Ingest DOIs and manage Anytype references.",
    )
    parser.add_argument("doi", help="DOI of the reference to ingest")
    parser.add_argument(
        "--pdf",
        help="Optional path to a local PDF to attach to the Anytype object.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run all processing steps without calling the Anytype API.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    settings = load_settings()
    run_pipeline(
        doi=args.doi,
        pdf_path=args.pdf,
        dry_run=args.dry_run,
        settings=settings,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
