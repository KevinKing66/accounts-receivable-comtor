from datetime import date
from typing import Optional
import uuid

from sqlalchemy.orm.attributes import set_committed_value

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
    PAID_STATUS = "paga"
    PARTIAL_STATUS = "pago parcial"

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
        charge_uuid: str | None = None,
        amount: float = 0,
        payment_date: date | None = None,
        method: str | None = None,
        reference: str | None = None,
        notes: str | None = None,
        attachment_base64: str | None = None,
    ) -> dict:
        return self.process_payment_cascading(
            charge_uuid=charge_uuid,
            amount=amount,
            payment_date=payment_date,
            method=method,
            reference=reference,
            notes=notes,
            attachment_base64=attachment_base64,
        )


    def process_payment_cascading( self,
        charge_uuid: str | None = None,
        customer_search: str | None = None,
        amount: float = 0,
        payment_date: date | None = None,
        method: str | None = None,
        reference: str | None = None,
        notes: str | None = None,
        attachment_base64: str | None = None,
    ) -> dict:
        if amount <= 0:
            raise PaymentAmountError("El monto del pago debe ser mayor a cero")

        # 1. Obtener la lista de facturas a pagar
        charges_to_process = []
        if charge_uuid:
            initial_charge = self.charge_service.find_by_id(charge_uuid)
            if initial_charge:
                customer_ref = initial_charge.customer_document_number or initial_charge.customer_name
                if customer_ref:
                    charges_to_process = self.charge_service.find_pending_by_customer(customer_ref)
                if not any(c.uuid == charge_uuid for c in charges_to_process):
                    charges_to_process.insert(0, initial_charge)
                else:
                    charges_to_process.sort(key=lambda c: 0 if c.uuid == charge_uuid else 1)
        
        if not charges_to_process and customer_search:
            charges_to_process = self.charge_service.find_pending_by_customer(customer_search)

        if not charges_to_process:
            raise ChargeNotFoundError("No se encontró ninguna cuenta de cobro pendiente para procesar el pago")


        remaining_payment = amount
        applied_payments = []

        for charge in charges_to_process:
            if remaining_payment <= 0:
                break

            charge_amount = float(charge.amount or 0)
            paid_before = self._repo().sum_by_charge(str(charge.uuid))
            pending_before = max(charge_amount - paid_before, 0)

            if pending_before <= 0:
                continue

            # Monto a abonar a esta factura en particular
            payment_for_charge = min(remaining_payment, pending_before)

            payment_entity = Payment(
                uuid=str(uuid.uuid4()),
                charge_uuid=str(charge.uuid),
                amount=payment_for_charge,
                payment_date=payment_date or date.today(),
                method=method,
                reference=reference,
                notes=notes,
                attachment_base64=attachment_base64,
            )

            created_payment = self.create(payment_entity)
            payment = created_payment if created_payment is not None else payment_entity

            paid_amount = paid_before + payment_for_charge
            pending_amount = max(charge_amount - paid_amount, 0)
            payment_status = self.PAID_STATUS if pending_amount == 0 else self.PARTIAL_STATUS

            charge.status = payment_status
            charge.delivery_status = "cliente manda evidencia del pago"
            self.charge_service.update(charge)

            remaining_payment -= payment_for_charge

            applied_payments.append({
                "payment_uuid": payment.uuid,
                "document_number": charge.document_number,
                "charge_amount": charge_amount,
                "applied_amount": payment_for_charge,
                "paid_amount": paid_amount,
                "pending_amount": pending_amount,
                "payment_status": payment_status,
            })

        return {
            "total_payment_amount": amount,
            "applied_amount": amount - remaining_payment,
            "unused_amount": remaining_payment,
            "applied_payments_count": len(applied_payments),
            "details": applied_payments,
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
        if attachment and not attachment.startswith("data:"):
            attachment_data = self.vfs_service.find_as_data_uri(vfs_uuid)
            if attachment_data:
                set_committed_value(payment, "attachment_base64", attachment_data)
        return payment

    def _to_detailed_dict(self, payment: Payment, charge = None) -> dict:
        if charge is None and payment.charge_uuid:
            charge = self.charge_service.find_by_id(payment.charge_uuid)

        return {
            "uuid": payment.uuid,
            "charge_uuid": payment.charge_uuid,
            "amount": payment.amount,
            "payment_date": payment.payment_date,
            "method": payment.method,
            "reference": payment.reference,
            "notes": payment.notes,
            "attachment_base64": payment.attachment_base64,
            "status": payment.status or "pendiente",
            "document_number": charge.document_number if charge else None,
            "document_type": charge.document_type if charge else None,
            "customer_name": charge.customer_name if charge else None,
            "customer_document_number": charge.customer_document_number if charge else None,
            "charge_amount": float(charge.amount) if charge and charge.amount is not None else None,
            "charge_status": charge.status if charge else None,
        }

    def find_all_paginated(
        self,
        sort_by: str = 'fecha',
        sort_order: str = 'desc',
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> dict:
        results, total = self._repo().find_all_paginated(
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
            status_filter=status_filter,
            page=page,
            page_size=page_size,
        )

        items = []
        for payment, charge in results:
            payment = self._hydrate_attachment(payment)
            items.append(self._to_detailed_dict(payment, charge))

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def update_payment_status(self, payment_uuid: str, new_status: str) -> dict:
        payment = self.find_by_id(payment_uuid)
        if not payment:
            raise PaymentError(f"Pago con id {payment_uuid} no encontrado")

        payment.status = new_status
        self.update(payment)

        charge = self.charge_service.find_by_id(payment.charge_uuid)
        if charge:
            charge_amount = float(charge.amount or 0)
            paid_amount = self._repo().sum_by_charge(str(charge.uuid))
            pending_amount = max(charge_amount - paid_amount, 0)

            if pending_amount == 0 and charge_amount > 0:
                charge.status = self.PAID_STATUS
            elif paid_amount > 0:
                charge.status = self.PARTIAL_STATUS
            else:
                charge.status = "pendiente"

            if new_status == "aprobado":
                charge.delivery_status = "El administrador valida"
            elif new_status == "rechazado":
                charge.delivery_status = "El administrador rechaza evidencia"

            self.charge_service.update(charge)

        return self._to_detailed_dict(payment, charge)

    def get_charge_balance(self, charge_uuid: str) -> dict:
        charge = self.charge_service.find_by_id(charge_uuid)
        if charge is None:
            raise ChargeNotFoundError("Cuenta de cobro no encontrada")

        charge_amount = float(charge.amount or 0)
        paid_amount = self._repo().sum_by_charge(charge_uuid)
        pending_amount = max(charge_amount - paid_amount, 0)
        payments = self.find_by_charge(charge_uuid)

        return {
            "charge_uuid": charge_uuid,
            "document_number": charge.document_number,
            "customer_name": charge.customer_name,
            "customer_document_number": charge.customer_document_number,
            "charge_amount": charge_amount,
            "paid_amount": paid_amount,
            "pending_amount": pending_amount,
            "status": charge.status,
            "delivery_status": charge.delivery_status,
            "payments_count": len(payments),
            "payments": payments,
        }

    def get_customer_balance(self, customer_search: str) -> dict:
        charges = self.charge_service._repo().session.query(self.charge_service._model).filter(
            self.charge_service._repo()._customer_filter(customer_search)
        ).all()

        total_charge_amount = 0.0
        total_paid_amount = 0.0
        total_pending_amount = 0.0
        charges_breakdown = []

        for charge in charges:
            c_amount = float(charge.amount or 0)
            c_paid = self._repo().sum_by_charge(str(charge.uuid))
            c_pending = max(c_amount - c_paid, 0)

            total_charge_amount += c_amount
            total_paid_amount += c_paid
            total_pending_amount += c_pending

            charges_breakdown.append({
                "charge_uuid": str(charge.uuid),
                "document_number": charge.document_number,
                "due_date": charge.due_date,
                "charge_amount": c_amount,
                "paid_amount": c_paid,
                "pending_amount": c_pending,
                "status": charge.status,
                "delivery_status": charge.delivery_status,
            })

        return {
            "customer_search": customer_search,
            "total_charge_amount": total_charge_amount,
            "total_paid_amount": total_paid_amount,
            "total_pending_amount": total_pending_amount,
            "total_charges": len(charges),
            "charges": charges_breakdown,
        }
