from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    charge_uuid: str
    amount: float = Field(..., gt=0)
    payment_date: Optional[date] = None
    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    attachment_base64: Optional[str] = None


class PaymentResponse(BaseModel):
    uuid: str
    charge_uuid: str
    amount: float
    payment_date: date
    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    attachment_base64: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class PaymentProcessResponse(BaseModel):
    payment: PaymentResponse
    charge_uuid: str
    charge_amount: float
    paid_amount: float
    pending_amount: float
    payment_status: str
