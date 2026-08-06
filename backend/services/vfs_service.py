# import os
# from backend.repositories.vfs_repository import VFSRepository
# from models.entities.vfs import VFS
# from services.sqlalchemy_service import SQLAlchemyService

# class VFSService(SQLAlchemyService[VFS]):

#     BASE_PATH = "/opt/aixabot-vfs"

#     def __init__(self, session, base_path=BASE_PATH, context=None):
#         super().__init__(
#             session=session,
#             model=VFS,
#             repository_class=VFSRepository,
#         )

#         self.base_path = base_path
#         self.context = context or "miia"

#         self.full_relative_path = os.path.join(
#             self.base_path,
#             self.context,
#         )

#         os.makedirs(self.full_relative_path, exist_ok=True)

from __future__ import annotations

import base64
from dataclasses import dataclass
import mimetypes
import os
from typing import TYPE_CHECKING, Final, TypeAlias
import uuid

from repositories.vfs_repository import VFSRepository
from models.entities.vfs import VFS
from services.sqlalchemy_service import SQLAlchemyService

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

UUIDStr: TypeAlias = str


@dataclass(frozen=True, slots=True)
class FileDTO:
    """Objeto DTO inmutable para representar la respuesta del archivo."""

    content_type: str
    filename: str
    content: bytes


class VFSService(SQLAlchemyService[VFS]):

    BASE_PATH: Final[str] = "/opt/aixabot-vfs"
    DEFAULT_CONTEXT: Final[str] = "miia"

    def __init__(
        self,
        session: Session,
        base_path: str = BASE_PATH,
        context: str | None = None,
    ) -> None:
        super().__init__(
            session=session,
            model=VFS,
            repository_class=VFSRepository,
        )

        self.base_path: str = base_path
        self.context: str = context or self.DEFAULT_CONTEXT

        self.full_relative_path: str = os.path.join(
            self.base_path,
            self.context,
        )

        os.makedirs(self.full_relative_path, exist_ok=True)

    def _get_directories(self, uuid_str: UUIDStr) -> str:
        """Genera una estructura de subdirectorios basada en los primeros caracteres del UUID."""
        prefix: str = uuid_str.split("-")[0]
        parts: list[str] = [prefix[i : i + 2] for i in range(0, len(prefix), 2)]
        return os.path.join(*parts)

    def create_from_base64(
        self,
        filename: str,
        content_type: str,
        base64_content: str,
        old_uuid: UUIDStr | None = None,
    ) -> VFS:
        file_data: bytes = base64.b64decode(base64_content)
        return self.create(
            filename=filename,
            content_type=content_type,
            file_content=file_data,
            old_uuid=old_uuid,
        )
        
    def create_from_base64_v2(
        self,
        uuid: UUIDStr | None,
        full_base64: str,
    ) -> VFS:
        """
        Crea un VFS a partir de una cadena Base64 completa (Data URI).

        Soporta formatos como:
        - data:image/png;name=archivo.png;base64,...
        - data:application/pdf;name=factura.pdf;base64,...
        - data:text/plain;base64,...
        - Base64 puro (sin Data URI)
        """

        filename = ""
        content_type = "application/octet-stream"

        base64_data = full_base64.strip()

        if base64_data.startswith("data:"):
            header, _, encoded_content = base64_data.partition(",")
            base64_data = encoded_content

            # Elimina "data:"
            metadata = header[5:]

            # Ejemplo:
            # image/png;name=archivo.png;base64
            for part in metadata.split(";"):
                part = part.strip()

                if not part or part == "base64":
                    continue

                if "/" in part:
                    content_type = part

                elif part.startswith("name="):
                    filename = part.split("=", 1)[1].strip("\"'")

        file_data = base64.b64decode(base64_data)

        return self.create(
            filename=filename,
            content_type=content_type,
            file_content=file_data,
            old_uuid=uuid,
        )

    def create(
        self,
        filename: str,
        content_type: str,
        file_content: bytes,
        old_uuid: UUIDStr | None = None,
    ) -> VFS:
        file_uuid: UUIDStr = (
            old_uuid if (old_uuid is not None and old_uuid != "") else str(uuid.uuid4())
        )

        relative_dir_path: str = self._get_directories(file_uuid)
        target_dir: str = os.path.join(self.full_relative_path, relative_dir_path)
        os.makedirs(target_dir, exist_ok=True)

        if not filename:
            filename = file_uuid

        base: str
        ext: str
        base, ext = os.path.splitext(filename)

        extension: str
        if ext:
            extension = ext
        else:
            if content_type == "audio/ogg":
                extension = ".ogg"
            else:
                extension = mimetypes.guess_extension(content_type) or ""
            filename = f"{filename}{extension}"

        target_filename: str = file_uuid
        target_path: str = os.path.join(target_dir, target_filename)

        with open(target_path, "wb") as f:
            f.write(file_content)

        vfs = VFS(
            uuid=file_uuid,
            path=os.path.join(relative_dir_path, file_uuid),
            filename=filename,
            extension=extension,
            content_type=content_type,
        )

        # Si tu SQLAlchemyService/Repository usa save/add o super().create(),
        # simplemente se invoca de manera limpia (ej: super().create(vfs) o self.session.add(vfs))
        return super().create(vfs)

    def edit(
        self,
        old_vfs: VFS,
        filename: str,
        content_type: str,
        file_content: bytes,
    ) -> VFS:
        self.delete(old_vfs)
        return self.create(
            filename=filename,
            content_type=content_type,
            file_content=file_content,
        )

    def deleteFromKey(self, uuid_str: UUIDStr) -> None:
        # Usa el método de búsqueda nativo de tu servicio base (por ejemplo, super().find(uuid_str) o self.session.get(VFS, uuid_str))
        vfs: VFS | None = super().find_by_id(uuid_str)
        if vfs is not None:
            self.delete(vfs)

    def delete(self, vfs: VFS) -> None:
        full_path: str = os.path.join(self.full_relative_path, str(vfs.path))

        if os.path.exists(full_path):
            os.remove(full_path)

        super().delete(vfs)

    def find_as_file_dto(self, uuid_str: UUIDStr) -> FileDTO | None:
        vfs: VFS | None = super().find_by_id(uuid_str)

        if vfs is not None:
            full_path: str = os.path.join(self.full_relative_path, str(vfs.path))
            if os.path.exists(full_path):
                with open(full_path, "rb") as file:
                    content: bytes = base64.b64encode(file.read())
                    return FileDTO(
                        content_type=str(vfs.content_type),
                        filename=str(vfs.filename),
                        content=content,
                    )

        return None