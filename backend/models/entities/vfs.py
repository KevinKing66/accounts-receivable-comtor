from sqlalchemy import Column, String, Text

from models.sqlalchemy.common.base import SQLAlchemyBase


class VFS(SQLAlchemyBase):
    __tablename__ = "vfs"

    uuid = Column(String(36), primary_key=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(128), nullable=False)
    base64 = Column(Text, nullable=False)
