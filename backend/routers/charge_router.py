from fastapi import HTTPException, Query, status
from fastapi_utils.cbv import cbv
from fastapi_utils.inferring_router import InferringRouter
from typing import Optional
from uuid import UUID

from services.charge_service import ChargeService
from repositories.sqlalchemy_db_manager import SqlAlchemyDatabaseManager
from dto.charge_dto import (
    ChargeCalculation,
    ChargeCustomer,
    ChargePage,
    ChargeResponse,
    ChargeCreate,
    ChargeUpdate,
)
from models.entities.charge import Charge

router = InferringRouter()

@cbv(router)
class ChargeEndpoint:
    @router.get("/charges", response_model=ChargePage)
    def get_charges(
        self,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        search: Optional[str] = Query(None),
    ):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            items, total = ChargeService(session).find_page(page, page_size, search)
            return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/charges/customer/calculation", response_model=ChargeCalculation)
    def calculate_charges_by_customer(
        self,
        customer_search: str = Query(..., min_length=1),
    ):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return ChargeService(session).calculate_by_customer(customer_search)

    @router.get("/charges/customer/calculations", response_model=list[ChargeCalculation])
    def calculate_charges_grouped_by_customer(
        self,
        customer_search: Optional[str] = Query(None, min_length=1),
    ):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return ChargeService(session).calculate_grouped_by_customer(customer_search)

    @router.get("/charges/customer/pending", response_model=list[ChargeResponse])
    def get_pending_charges_by_customer(
        self,
        customer_search: str = Query(..., min_length=1),
    ):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return ChargeService(session).find_pending_by_customer(customer_search)

    @router.get("/charges/customers", response_model=list[ChargeCustomer])
    def get_charge_customers(self):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            return ChargeService(session).find_customers()

    @router.get("/charges/{charge_uuid}", response_model=ChargeResponse)
    def get_charge(self, charge_uuid: UUID):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            charge = ChargeService(session).find_by_id(str(charge_uuid))
            if not charge:
                raise HTTPException(status_code=404, detail="Cobro no encontrado")
            return charge

    @router.post("/charges", response_model=ChargeResponse, status_code=status.HTTP_201_CREATED)
    def create_charge(self, data: ChargeCreate):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            charge_data = data.dict(exclude_unset=True)
            charge = Charge(**charge_data)
            created = ChargeService(session).create(charge)
            return created

    @router.put("/charges/{charge_uuid}", response_model=ChargeResponse)
    def update_charge(self, charge_uuid: UUID, data: ChargeUpdate):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            service = ChargeService(session)
            charge = service.find_by_id(str(charge_uuid))
            if not charge:
                raise HTTPException(status_code=404, detail="Cobro no encontrado")
            
            update_data = data.dict(exclude_unset=True)
            for key, value in update_data.items():
                setattr(charge, key, value)
            
            updated = service.update(charge)
            return updated

    @router.delete("/charges/{charge_uuid}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_charge(self, charge_uuid: UUID):
        with SqlAlchemyDatabaseManager.session("primary") as session:
            service = ChargeService(session)
            charge = service.find_by_id(str(charge_uuid))
            if not charge:
                raise HTTPException(status_code=404, detail="Cobro no encontrado")
            service.delete(charge)
            return None
