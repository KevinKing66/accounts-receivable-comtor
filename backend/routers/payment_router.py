from fastapi import HTTPException, status
from fastapi_utils.cbv import cbv
from fastapi_utils.inferring_router import InferringRouter

from dto.payment_dto import PaymentCreate, PaymentProcessResponse, PaymentResponse
from repositories.sqlalchemy_db_manager import SqlAlchemyDatabaseManager
from services.payment_service import (
    ChargeNotFoundError,
    PaymentAmountError,
    PaymentService,
)

router = InferringRouter()


@cbv(router)
class PaymentEndpoint:
    @router.post(
        "/payments/process",
        response_model=PaymentProcessResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def process_payment(self, data: PaymentCreate):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            try:
                return PaymentService(session).process_payment_cascading(
                    charge_uuid=data.charge_uuid,
                    customer_search=data.customer_search,
                    amount=data.amount,
                    payment_date=data.payment_date,
                    method=data.method,
                    reference=data.reference,
                    notes=data.notes,
                    attachment_base64=data.attachment_base64,
                )
            except ChargeNotFoundError as err:
                raise HTTPException(status_code=404, detail=str(err))
            except PaymentAmountError as err:
                raise HTTPException(status_code=400, detail=str(err))


    @router.get("/payments/charge/{charge_uuid}", response_model=list[PaymentResponse])
    def get_payments_by_charge(self, charge_uuid: str):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return PaymentService(session).find_by_charge(charge_uuid)

    @router.get("/payments/balance/charge/{charge_uuid}")
    def get_charge_balance(self, charge_uuid: str):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            try:
                return PaymentService(session).get_charge_balance(charge_uuid)
            except ChargeNotFoundError as err:
                raise HTTPException(status_code=404, detail=str(err))

    @router.get("/payments/balance/customer/{customer_search}")
    def get_customer_balance(self, customer_search: str):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return PaymentService(session).get_customer_balance(customer_search)

