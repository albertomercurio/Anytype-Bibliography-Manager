"""Anytype API client and publishing helpers."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import httpx

from anytype_bib_manager.config import Settings
from anytype_bib_manager.models import BibliographicRecord

logger = logging.getLogger(__name__)


class AnytypeAPIError(RuntimeError):
    """Raised when Anytype API calls fail."""


@dataclass
class AnytypeClient:
    """Lightweight HTTP client wrapper around the Anytype REST API."""

    settings: Settings
    timeout: float = 15.0

    def _url(self, path: str) -> str:
        base = self.settings.anytype_base_url.rstrip("/")
        return f"{base}{path}"

    def _headers(self, *, json_body: bool = True) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.settings.anytype_token}",
            "Accept": "application/json",
        }
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    def create_object(
        self,
        *,
        object_type: str,
        name: str,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {
            "objectType": object_type,
            "name": name,
            "fields": fields,
        }
        response = httpx.post(
            self._url(f"/spaces/{self.settings.anytype_space_id}/objects"),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        return self._parse_response(response)

    def update_object(self, object_id: str, *, fields: dict[str, Any]) -> dict[str, Any]:
        payload = {"fields": fields}
        response = httpx.patch(
            self._url(f"/spaces/{self.settings.anytype_space_id}/objects/{object_id}"),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        return self._parse_response(response)

    def search_by_property(
        self,
        *,
        property_key: str,
        value: str,
        limit: int = 5,
    ) -> Iterable[dict[str, Any]]:
        payload = {
            "filters": [
                {
                    "property": property_key,
                    "operator": "equals",
                    "value": value,
                }
            ],
            "limit": limit,
        }
        response = httpx.post(
            self._url(f"/spaces/{self.settings.anytype_space_id}/objects/search"),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        data = self._parse_response(response)
        return data.get("objects", []) if isinstance(data, dict) else []

    def search_by_text(self, *, query: str, limit: int = 5) -> Iterable[dict[str, Any]]:
        payload = {"query": {"text": query}, "limit": limit}
        response = httpx.post(
            self._url(f"/spaces/{self.settings.anytype_space_id}/objects/search"),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        data = self._parse_response(response)
        return data.get("objects", []) if isinstance(data, dict) else []

    def upload_file(self, pdf_path: Path) -> str:
        with pdf_path.open("rb") as handle:
            response = httpx.post(
                self._url(f"/spaces/{self.settings.anytype_space_id}/files"),
                headers=self._headers(json_body=False),
                files={"file": (pdf_path.name, handle, "application/pdf")},
                timeout=self.timeout,
            )
        data = self._parse_response(response)
        file_id = data.get("id") if isinstance(data, dict) else None
        if not file_id:
            raise AnytypeAPIError("File upload succeeded but response missing 'id'.")
        return str(file_id)

    def attach_file_to_object(self, object_id: str, file_id: str) -> None:
        payload = {
            "fileId": file_id,
            "relationKey": self.settings.anytype_file_relation_key,
        }
        response = httpx.post(
            self._url(f"/spaces/{self.settings.anytype_space_id}/objects/{object_id}/files"),
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        self._parse_response(response)

    def _parse_response(self, response: httpx.Response) -> dict[str, Any]:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("Anytype API error: %s", exc)
            raise AnytypeAPIError(str(exc)) from exc
        if response.content:
            try:
                return response.json()
            except ValueError as exc:
                raise AnytypeAPIError("Anytype API returned invalid JSON") from exc
        return {}


@dataclass
class AnytypePublisher:
    """Transforms bibliographic records into Anytype objects."""

    client: AnytypeClient
    settings: Settings

    def create_reference(self, record: BibliographicRecord, bibtex_entry: str) -> dict[str, Any]:
        fields = self._build_fields(record, bibtex_entry)
        object_type = (
            self.settings.anytype_object_type_book
            if record.entry_type == "book"
            else self.settings.anytype_object_type_article
        )
        return self.client.create_object(
            object_type=object_type,
            name=record.title,
            fields=fields,
        )

    def update_reference(
        self,
        object_id: str,
        record: BibliographicRecord,
        bibtex_entry: str,
    ) -> dict[str, Any]:
        fields = self._build_fields(record, bibtex_entry)
        return self.client.update_object(object_id=object_id, fields=fields)


    def attach_pdf(self, object_id: str, pdf_path: Path) -> None:
        file_id = self.client.upload_file(pdf_path)
        self.client.attach_file_to_object(object_id, file_id)

    def _build_fields(self, record: BibliographicRecord, bibtex_entry: str) -> dict[str, Any]:
        fields: dict[str, Any] = {
            self.settings.anytype_field_doi: record.doi,
            self.settings.anytype_field_year: record.year,
            self.settings.anytype_field_authors: record.formatted_authors().replace(
                " and ", self.settings.anytype_author_separator
            ),
            self.settings.anytype_field_bibtex: bibtex_entry,
        }
        if record.journal:
            fields[self.settings.anytype_field_journal] = record.journal
        if record.short_journal and self.settings.anytype_field_short_journal:
            fields[self.settings.anytype_field_short_journal] = record.short_journal
        return {key: value for key, value in fields.items() if value is not None}
