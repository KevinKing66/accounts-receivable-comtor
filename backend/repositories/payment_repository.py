from typing import List

from sqlalchemy import func

from models.entities.payment import Payment
from repositories.base.sqlalchemy_repository import SQLAlchemyRepository


class PaymentRepository(SQLAlchemyRepository[Payment]):
    def __init__(self, session, model=Payment):
        super().__init__(session, model)

    def find_by_charge(self, charge_uuid: str) -> List[Payment]:
        return (
            self.session.query(self.model)
            .filter(self.model.charge_uuid == charge_uuid)
            .order_by(self.model.payment_date.desc(), self.model.uuid.desc())
            .all()
        )

    def sum_by_charge(self, charge_uuid: str) -> float:
        total = (
            self.session.query(func.coalesce(func.sum(self.model.amount), 0))
            .filter(self.model.charge_uuid == charge_uuid)
            .scalar()
        )
        return float(total or 0)
