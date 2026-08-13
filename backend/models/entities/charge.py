from sqlalchemy import Column, String, Date, Float, SmallInteger, Text
from models.sqlalchemy.common.base import SQLAlchemyBase

class Charge(SQLAlchemyBase):
    __tablename__ = "charges"

    uuid = Column(String(1024), primary_key=True)
    document_type = Column(String(1024), nullable=True)
    document_number = Column(String(1024), nullable=True)
    customer_document_type = Column(String(32), nullable=True)
    customer_document_number = Column(String(32), nullable=True)
    customer_name = Column(String(1024), nullable=True)
    charge_details = Column(String(2048), nullable=True)
    sent_date = Column(Date, nullable=True)
    status = Column(String(64), nullable=True, default="pendiente")
    delivery_status = Column(String(64), nullable=True, default="pendiente de enviar")
    scheduled_date = Column(String(255), nullable=True)
    due_date = Column(Date, nullable=True)
    discount_date = Column(Date, nullable=True)
    late_fee_date = Column(Date, nullable=True)
    amount = Column(Float, nullable=True)
    discounted_amount = Column(Float, nullable=True)
    tax = Column(Float, nullable=True)
    is_read = Column(SmallInteger, default=0, nullable=True)
    attachment_base64 = Column(Text, nullable=True)
    template = Column(String(1024), nullable=True)
    recipient = Column(String(64), nullable=True)
