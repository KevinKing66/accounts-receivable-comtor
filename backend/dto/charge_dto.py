from typing import Optional, List, Tuple
from datetime import date
from pydantic import BaseModel, Field

class ChargeBase(BaseModel):
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    customer_document_type: Optional[str] = None
    customer_document_number: Optional[str] = None
    customer_name: Optional[str] = None
    charge_details: Optional[str] = None
    sent_date: Optional[date] = None
    delivery_status: Optional[str] = None
    scheduled_date: Optional[str] = None
    due_date: Optional[date] = None
    discount_date: Optional[date] = None
    late_fee_date: Optional[date] = None
    amount: Optional[float] = Field(None, ge=0)
    discounted_amount: Optional[float] = Field(None, ge=0)
    tax: Optional[float] = Field(None, ge=0, le=100)
    is_read: Optional[int] = Field(0, ge=0, le=1)
    attachment_base64: Optional[str] = None
    recipient: Optional[str] = None

class ChargeCreate(ChargeBase):
    pass

class ChargeUpdate(ChargeBase):
    pass

class ChargeResponse(ChargeBase):
    uuid: str

    class Config:
        orm_mode = True
        from_attributes = True

class ChargePage(BaseModel):
    items: List[ChargeResponse]
    total: int
    page: int
    page_size: int

class ChargeCalculation(BaseModel):
    customer_key: Optional[str] = None
    customer_document_number: Optional[str] = None
    customer_name: Optional[str] = None
    recipient: Optional[str] = None
    most_recent_date: Optional[date] = None
    total_charges: int
    total_amount: float
    total_discounted_amount: float
    total_tax: float

class ChargeCustomer(BaseModel):
    customer_name: Optional[str] = None
    customer_document_type: Optional[str] = None
    customer_document_number: Optional[str] = None
