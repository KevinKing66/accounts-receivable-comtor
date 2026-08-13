from typing import List, Optional, Tuple
from sqlalchemy import func, or_

from models.entities.payment import Payment
from models.entities.charge import Charge
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
            .filter(or_(self.model.status != 'rechazado', self.model.status.is_(None)))
            .scalar()
        )
        return float(total or 0)

    def find_all_paginated(
        self,
        sort_by: str = 'fecha',
        sort_order: str = 'desc',
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[Tuple[Payment, Optional[Charge]]], int]:
        query = self.session.query(self.model, Charge).outerjoin(Charge, self.model.charge_uuid == Charge.uuid)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    self.model.reference.ilike(search_pattern),
                    self.model.method.ilike(search_pattern),
                    self.model.notes.ilike(search_pattern),
                    Charge.customer_name.ilike(search_pattern),
                    Charge.document_number.ilike(search_pattern),
                    Charge.customer_document_number.ilike(search_pattern),
                )
            )

        if status_filter:
            query = query.filter(self.model.status == status_filter)

        if sort_by == 'estado':
            query = query.order_by(
                self.model.status.asc() if sort_order == 'asc' else self.model.status.desc(),
                self.model.payment_date.desc(),
                self.model.uuid.desc(),
            )
        elif sort_by == 'ambas':
            query = query.order_by(
                self.model.status.asc(),
                self.model.payment_date.desc() if sort_order == 'desc' else self.model.payment_date.asc(),
                self.model.uuid.desc(),
            )
        else:
            if sort_order == 'asc':
                query = query.order_by(self.model.payment_date.asc(), self.model.uuid.asc())
            else:
                query = query.order_by(self.model.payment_date.desc(), self.model.uuid.desc())

        total = query.count()
        results = query.offset((page - 1) * page_size).limit(page_size).all()
        return results, total

