from typing import List, Optional, Tuple
from sqlalchemy import or_, cast, String
from models.entities.charge import Charge
from repositories.base.sqlalchemy_repository import SQLAlchemyRepository

class ChargeRepository(SQLAlchemyRepository[Charge]):
    def __init__(self, session, model=Charge):
        super().__init__(session, model)

    def find_page(
        self, page: int, page_size: int, search: Optional[str] = None
    ) -> Tuple[List[Charge], int]:
        query = self.session.query(self.model)
        if search:
            like = f"%{search}%"
            query = query.filter(
                or_(
                    self.model.uuid.ilike(like),
                    self.model.document_number.ilike(like),
                    self.model.customer_name.ilike(like),
                    self.model.customer_document_number.ilike(like),
                    self.model.recipient.ilike(like),
                )
            )

        total = query.count()
        items = (
            query.order_by(self.model.uuid.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total
