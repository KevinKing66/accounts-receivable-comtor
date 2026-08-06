import uuid
from typing import List, Optional, Tuple
from models.entities.charge import Charge
from services.sqlalchemy_service import SQLAlchemyService
from repositories.charge_repository import ChargeRepository
from services.vfs_service import VFSService

class ChargeService(SQLAlchemyService[Charge]):
    vfs_service: VFSService
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
            
        res = super().create(charge)
        self.vfs_service.create_from_base64_v2(uuid=str(charge.uuid), full_base64=str(charge.attachment_base64))
        return res

    def find_page(
        self, page: int, page_size: int, search: Optional[str] = None
    ) -> Tuple[List[Charge], int]:
        return self._repo().find_page(page, page_size, search)
