from datetime import date
from typing import Optional
import uuid

from models.entities.payment import Payment
from repositories.payment_repository import PaymentRepository
from services.charge_service import ChargeService
from services.sqlalchemy_service import SQLAlchemyService
from services.vfs_service import VFSService


class PaymentError(Exception):
    pass


class ChargeNotFoundError(PaymentError):
    pass


class PaymentAmountError(PaymentError):
    pass


class PaymentService(SQLAlchemyService[Payment]):
    PAID_STATUS = "Pagado"
    PARTIAL_STATUS = "Pago parcial"

    def __init__(self, session):
        super().__init__(
            session=session,
            model=Payment,
            repository_class=PaymentRepository,
        )
        self.charge_service = ChargeService(session)
        self.vfs_service = VFSService(session=session)

    def process_payment(
        self,
        charge_uuid: str,
        amount: float,
        payment_date: date | None = None,
        method: str | None = None,
        reference: str | None = None,
        notes: str | None = None,
        attachment_base64: str | None = None,
    ) -> dict:
        charge = self.charge_service.find_by_id(charge_uuid)
        if charge is None:
            raise ChargeNotFoundError("Cuenta de cobro no encontrada")

        charge_amount = float(charge.amount or 0)
        paid_before = self._repo().sum_by_charge(charge_uuid)
        pending_before = max(charge_amount - paid_before, 0)

        if amount <= 0:
            raise PaymentAmountError("El monto del pago debe ser mayor a cero")
        if amount > pending_before:
            raise PaymentAmountError("El pago supera el saldo pendiente")

        payment_entity = Payment(
            uuid=str(uuid.uuid4()),
            charge_uuid=charge_uuid,
            amount=amount,
            payment_date=payment_date or date.today(),
            method=method,
            reference=reference,
            notes=notes,
            attachment_base64=attachment_base64,
        )

        payment = self.create(payment_entity)

        paid_amount = paid_before + amount
        pending_amount = max(charge_amount - paid_amount, 0)
        payment_status = self.PAID_STATUS if pending_amount == 0 else self.PARTIAL_STATUS

        charge.delivery_status = payment_status
        self.charge_service.update(charge)

        return {
            "payment": payment,
            "charge_uuid": charge_uuid,
            "charge_amount": charge_amount,
            "paid_amount": paid_amount,
            "pending_amount": pending_amount,
            "payment_status": payment_status,
        }

    def create(self, payment: Payment) -> Payment:
        if not payment.uuid:
            payment.uuid = str(uuid.uuid4())

        self._save_attachment(payment)
        created = super().create(payment)
        return self._hydrate_attachment(created)

    def update(self, payment: Payment) -> Payment:
        self._save_attachment(payment)
        updated = super().update(payment)
        return self._hydrate_attachment(updated)

    def delete(self, payment: Payment) -> None:
        self.vfs_service.delete_from_key(str(payment.uuid))
        super().delete(payment)

    def find_by_id(self, id_value) -> Optional[Payment]:
        payment = super().find_by_id(id_value)
        return self._hydrate_optional_attachment(payment)

    def find_by_charge(self, charge_uuid: str) -> list[Payment]:
        payments = self._repo().find_by_charge(charge_uuid)
        return [self._hydrate_attachment(payment) for payment in payments]

    def _save_attachment(self, payment: Payment) -> None:
        attachment = str(payment.attachment_base64 or "")
        if not attachment or not attachment.startswith("data:"):
            return

        self.vfs_service.update_from_base64_v2(
            uuid=str(payment.uuid),
            full_base64=attachment,
        )
        payment.attachment_base64 = str(payment.uuid)

    def _hydrate_optional_attachment(self, payment: Optional[Payment]) -> Optional[Payment]:
        if payment is None:
            return None

        return self._hydrate_attachment(payment)

    def _hydrate_attachment(self, payment: Payment) -> Payment:
        attachment = str(payment.attachment_base64 or "")
        vfs_uuid = (
            str(payment.uuid)
            if not attachment or attachment.startswith("data:")
            else attachment
        )
        payment.attachment_base64 = self.vfs_service.find_as_data_uri(vfs_uuid)
        return payment

