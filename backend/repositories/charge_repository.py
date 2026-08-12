from datetime import date
from typing import List, Optional, Tuple
from sqlalchemy import func, or_

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

    def calculate_by_customer(self, customer_search: str) -> dict:
        charges = (
            self.session.query(self.model)
            .filter(self._customer_filter(customer_search))
            .all()
        )
        return self._calculate_group(charges)

    def calculate_grouped_by_customer(self, customer_search: Optional[str] = None) -> List[dict]:
        query = self.session.query(self.model)
        if customer_search:
            query = query.filter(self._customer_filter(customer_search))

        charges = query.all()
        grouped_charges: dict[str, List[Charge]] = {}

        for charge in charges:
            key = self._group_key(charge)
            grouped_charges.setdefault(key, []).append(charge)

        return [
            self._calculate_group(group)
            for group in sorted(
                grouped_charges.values(),
                key=lambda group: self._group_key(group[0]),
            )
        ]

    def find_pending_by_customer(self, customer_search: str) -> List[Charge]:
        return (
            self.session.query(self.model)
            .filter(
                self._customer_filter(customer_search),
                or_(
                    self.model.delivery_status.is_(None),
                    func.lower(self.model.delivery_status) != "pagado",
                ),
            )
            .order_by(self.model.due_date.asc(), self.model.uuid.desc())
            .all()
        )

    def find_customers(self) -> List[dict]:
        rows = (
            self.session.query(
                self.model.customer_name,
                self.model.customer_document_type,
                self.model.customer_document_number,
            )
            .filter(
                or_(
                    self.model.customer_name.isnot(None),
                    self.model.customer_document_type.isnot(None),
                    self.model.customer_document_number.isnot(None),
                )
            )
            .distinct()
            .order_by(
                self.model.customer_name.asc(),
                self.model.customer_document_number.asc(),
            )
            .all()
        )

        return [
            {
                "customer_name": customer_name,
                "customer_document_type": customer_document_type,
                "customer_document_number": customer_document_number,
            }
            for customer_name, customer_document_type, customer_document_number in rows
        ]

    def _customer_filter(self, customer_search: str):
        like = f"%{customer_search.strip()}%"
        return or_(
            self.model.customer_name.ilike(like),
            self.model.customer_document_number.ilike(like),
        )

    def _calculate_group(self, charges: List[Charge]) -> dict:
        most_recent_charge = self._most_recent_charge(charges)
        pending_charges = [
            charge for charge in charges if self._is_pending_charge(charge)
        ]

        return {
            "customer_key": self._group_key(most_recent_charge) if most_recent_charge else None,
            "customer_document_number": (
                most_recent_charge.customer_document_number if most_recent_charge else None
            ),
            "customer_name": most_recent_charge.customer_name if most_recent_charge else None,
            "recipient": most_recent_charge.recipient if most_recent_charge else None,
            "most_recent_date": self._most_recent_date(most_recent_charge),
            "total_charges": len(pending_charges),
            "total_amount": float(sum(charge.amount or 0 for charge in pending_charges)),
            "total_discounted_amount": float(
                sum(charge.discounted_amount or 0 for charge in pending_charges)
            ),
            "total_tax": float(sum(charge.tax or 0 for charge in pending_charges)),
        }

    def _is_pending_charge(self, charge: Charge) -> bool:
        return str(charge.delivery_status or "").strip().lower() == "pendiente"

    def _group_key(self, charge: Optional[Charge]) -> str:
        if charge is None:
            return ""

        document_number = str(charge.customer_document_number or "").strip()
        if document_number:
            return document_number.lower()

        return str(charge.customer_name or "").strip().lower()

    def _most_recent_charge(self, charges: List[Charge]) -> Optional[Charge]:
        charges_with_dates = [
            charge for charge in charges if self._most_recent_date(charge) is not None
        ]
        if not charges_with_dates:
            return charges[0] if charges else None

        return max(
            charges_with_dates,
            key=lambda charge: self._most_recent_date(charge) or date.min,
        )

    def _most_recent_date(self, charge: Optional[Charge]) -> Optional[date]:
        if charge is None:
            return None

        dates = [
            charge.sent_date,
            charge.due_date,
            charge.discount_date,
            charge.late_fee_date,
        ]
        valid_dates = [value for value in dates if value is not None]
        return max(valid_dates) if valid_dates else None
