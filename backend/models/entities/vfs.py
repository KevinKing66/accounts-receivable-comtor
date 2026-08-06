from sqlalchemy import Column, String, Integer, Text

from models.sqlalchemy.common.base import SQLAlchemyBase


class VFS(SQLAlchemyBase):
    __tablename__ = "vfs"

    uuid = Column(String(36), primary_key=True)
    path = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    extension = Column(String(32), nullable=True)
    content_type = Column(String(128), nullable=False)