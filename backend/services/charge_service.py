import uuid
from typing import List, Optional, Tuple
from models.entities.charge import Charge
from services.sqlalchemy_service import SQLAlchemyService
from repositories.charge_repository import ChargeRepository

class ChargeService(SQLAlchemyService[Charge]):
    def __init__(self, session):
        super().__init__(
            session=session,
            model=Charge,
            repository_class=ChargeRepository,
        )

    def create(self, charge: Charge) -> Charge:
        if not charge.uuid:
            charge.uuid = str(uuid.uuid4())
        return super().create(charge)

    def find_page(
        self, page: int, page_size: int, search: Optional[str] = None
    ) -> Tuple[List[Charge], int]:
        return self._repo().find_page(page, page_size, search)
