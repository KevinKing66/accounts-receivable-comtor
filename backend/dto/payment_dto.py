from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    charge_uuid: Optional[str] = None
    customer_search: Optional[str] = None
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
    payment: Optional[PaymentResponse] = None
    charge_uuid: Optional[str] = None
    charge_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    pending_amount: Optional[float] = None
    payment_status: Optional[str] = None
    total_payment_amount: Optional[float] = None
    applied_amount: Optional[float] = None
    unused_amount: Optional[float] = None
    applied_payments_count: Optional[int] = None
    details: Optional[list] = None

