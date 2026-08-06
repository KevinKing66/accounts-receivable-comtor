import uuid
from typing import List, Optional, Tuple

from models.entities.charge import Charge
from repositories.charge_repository import ChargeRepository
from services.sqlalchemy_service import SQLAlchemyService
from services.vfs_service import VFSService


class ChargeService(SQLAlchemyService[Charge]):
    def __init__(self, session):
        super().__init__(
            session=session,
            model=Charge,
            repository_class=ChargeRepository,
        )
        self.vfs_service = VFSService(session=session)

    def create(self, charge: Charge) -> Charge:
        if not charge.uuid:
            charge.uuid = str(uuid.uuid4())

        self._save_attachment(charge)
        created = super().create(charge)
        return self._hydrate_attachment(created)
    
    def update(self, charge: Charge) -> Charge:
        self._save_attachment(charge)
        updated = super().update(charge)
        return self._hydrate_attachment(updated)

    def delete(self, charge: Charge) -> None:
        self.vfs_service.delete_from_key(str(charge.uuid))
        super().delete(charge)

    def find_by_id(self, id_value) -> Optional[Charge]:
        charge = super().find_by_id(id_value)
        return self._hydrate_optional_attachment(charge)

    def find_by(self, **filters) -> Optional[Charge]:
        charge = super().find_by(**filters)
        return self._hydrate_optional_attachment(charge)

    def find_page(
        self, page: int, page_size: int, search: Optional[str] = None
    ) -> Tuple[List[Charge], int]:
        charges, total = self._repo().find_page(page, page_size, search)
        return [self._hydrate_attachment(charge) for charge in charges], total

    def _save_attachment(self, charge: Charge) -> None:
        attachment = str(charge.attachment_base64 or "")
        if not attachment or not attachment.startswith("data:"):
            return

        self.vfs_service.update_from_base64_v2(
            uuid=str(charge.uuid),
            full_base64=attachment,
        )
        charge.attachment_base64 = str(charge.uuid)

    def _hydrate_optional_attachment(self, charge: Optional[Charge]) -> Optional[Charge]:
        if charge is None:
            return None

        return self._hydrate_attachment(charge)

    def _hydrate_attachment(self, charge: Charge) -> Charge:
        attachment = str(charge.attachment_base64 or "")
        vfs_uuid = (
            str(charge.uuid)
            if not attachment or attachment.startswith("data:")
            else attachment
        )
        charge.attachment_base64 = self.vfs_service.find_as_data_uri(vfs_uuid)
        return charge
