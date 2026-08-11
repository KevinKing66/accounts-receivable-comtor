from sqlalchemy import Column, Date, Float, String

from models.sqlalchemy.common.base import SQLAlchemyBase


class Payment(SQLAlchemyBase):
    __tablename__ = "payments"

    uuid = Column(String(36), primary_key=True)
    charge_uuid = Column(String(1024), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    method = Column(String(64), nullable=True)
    reference = Column(String(255), nullable=True)
    notes = Column(String(1024), nullable=True)
    attachment_base64 = Column(String(1024), nullable=True)

