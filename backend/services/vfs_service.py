from __future__ import annotations

from dataclasses import dataclass
import mimetypes
from typing import TYPE_CHECKING, TypeAlias
import uuid

from models.entities.vfs import VFS
from repositories.vfs_repository import VFSRepository
from services.sqlalchemy_service import SQLAlchemyService

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

UUIDStr: TypeAlias = str


@dataclass(frozen=True, slots=True)
class ParsedBase64File:
    filename: str
    content_type: str
    base64: str


class VFSService(SQLAlchemyService[VFS]):
    DEFAULT_CONTENT_TYPE = "application/octet-stream"

    def __init__(self, session: Session) -> None:
        super().__init__(
            session=session,
            model=VFS,
            repository_class=VFSRepository,
        )

    def create_from_base64(
        self,
        filename: str,
        content_type: str,
        base64_content: str,
        old_uuid: UUIDStr | None = None,
    ) -> VFS:
        return self.create(
            filename=filename,
            content_type=content_type,
            base64_content=base64_content,
            old_uuid=old_uuid,
        )

    def create_from_base64_v2(
        self,
        uuid: UUIDStr | None,
        full_base64: str,
    ) -> VFS:
        parsed_file = self.parse_base64_file(full_base64)
        return self.create(
            filename=parsed_file.filename,
            content_type=parsed_file.content_type,
            base64_content=parsed_file.base64,
            old_uuid=uuid,
        )

    def create(
        self,
        filename: str,
        content_type: str,
        base64_content: str,
        old_uuid: UUIDStr | None = None,
    ) -> VFS:
        file_uuid = old_uuid if old_uuid else str(uuid.uuid4())
        normalized_content_type = content_type or self.DEFAULT_CONTENT_TYPE
        normalized_filename = filename or self._default_filename(
            file_uuid=file_uuid,
            content_type=normalized_content_type,
        )

        return super().create(
            VFS(
                uuid=file_uuid,
                filename=normalized_filename,
                content_type=normalized_content_type,
                base64=base64_content,
            )
        )

    def edit(
        self,
        old_vfs: VFS,
        filename: str,
        content_type: str,
        base64_content: str,
    ) -> VFS:
        self.delete(old_vfs)
        return self.create(
            filename=filename,
            content_type=content_type,
            base64_content=base64_content,
            old_uuid=str(old_vfs.uuid),
        )

    def update_from_base64_v2(self, uuid: UUIDStr, full_base64: str) -> VFS:
        parsed_file = self.parse_base64_file(full_base64)
        existing_vfs = super().find_by_id(uuid)

        if existing_vfs is None:
            return self.create(
                filename=parsed_file.filename,
                content_type=parsed_file.content_type,
                base64_content=parsed_file.base64,
                old_uuid=uuid,
            )

        existing_vfs.filename = parsed_file.filename or self._default_filename(
            file_uuid=uuid,
            content_type=parsed_file.content_type,
        )
        existing_vfs.content_type = parsed_file.content_type
        existing_vfs.base64 = parsed_file.base64
        return super().update(existing_vfs)

    def delete_from_key(self, uuid_str: UUIDStr) -> None:
        vfs = super().find_by_id(uuid_str)
        if vfs is not None:
            self.delete(vfs)

    def deleteFromKey(self, uuid_str: UUIDStr) -> None:
        self.delete_from_key(uuid_str)

    def delete(self, vfs: VFS) -> None:
        super().delete(vfs)

    def find_as_data_uri(self, uuid_str: UUIDStr | None) -> str | None:
        if not uuid_str:
            return None

        vfs = super().find_by_id(uuid_str)
        if vfs is None:
            return None

        return self.build_data_uri(vfs)

    def build_data_uri(self, vfs: VFS) -> str:
        filename = str(vfs.filename or "")
        filename_metadata = f";name={filename}" if filename else ""
        return f"data:{vfs.content_type}{filename_metadata};base64,{vfs.base64}"

    def parse_base64_file(self, full_base64: str) -> ParsedBase64File:
        base64_data = (full_base64 or "").strip()
        filename = ""
        content_type = self.DEFAULT_CONTENT_TYPE

        if base64_data.startswith("data:"):
            header, _, encoded_content = base64_data.partition(",")
            base64_data = encoded_content.strip()
            content_type, filename = self._parse_data_uri_header(header)

        return ParsedBase64File(
            filename=filename,
            content_type=content_type,
            base64=base64_data,
        )

    def _parse_data_uri_header(self, header: str) -> tuple[str, str]:
        content_type = self.DEFAULT_CONTENT_TYPE
        filename = ""

        for part in header.removeprefix("data:").split(";"):
            part = part.strip()
            if not part or part == "base64":
                continue

            if "/" in part:
                content_type = part
            elif part.startswith("name="):
                filename = part.split("=", 1)[1].strip("\"'")

        return content_type, filename

    def _default_filename(self, file_uuid: UUIDStr, content_type: str) -> str:
        extension = mimetypes.guess_extension(content_type) or ""
        return f"{file_uuid}{extension}"
