from typing import Optional
from fastapi import HTTPException, Query, status
from fastapi_utils.cbv import cbv
from fastapi_utils.inferring_router import InferringRouter

from dto.payment_dto import (
    PaymentCreate,
    PaymentPageResponse,
    PaymentProcessResponse,
    PaymentResponse,
    PaymentStatusUpdate,
    PaymentDetailedResponse,
)
from repositories.sqlalchemy_db_manager import SqlAlchemyDatabaseManager
from services.payment_service import (
    ChargeNotFoundError,
    PaymentAmountError,
    PaymentError,
    PaymentService,
)

router = InferringRouter()


@cbv(router)
class PaymentEndpoint:
    @router.get("/payments", response_model=PaymentPageResponse)
    def list_payments(
        self,
        sort_by: str = Query("fecha", description="Ordenar por: fecha, estado, o ambas"),
        sort_order: str = Query("desc", description="Orden: asc o desc"),
        search: Optional[str] = Query(None, description="Búsqueda por cliente, referencia o doc"),
        status_filter: Optional[str] = Query(None, alias="status", description="Filtrar por estado"),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=100),
    ):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return PaymentService(session).find_all_paginated(
                sort_by=sort_by,
                sort_order=sort_order,
                search=search,
                status_filter=status_filter,
                page=page,
                page_size=page_size,
            )

    @router.put("/payments/{payment_uuid}/status", response_model=PaymentDetailedResponse)
    def update_payment_status(self, payment_uuid: str, body: PaymentStatusUpdate):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            try:
                return PaymentService(session).update_payment_status(
                    payment_uuid=payment_uuid,
                    new_status=body.status,
                )
            except PaymentError as err:
                raise HTTPException(status_code=404, detail=str(err))

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


