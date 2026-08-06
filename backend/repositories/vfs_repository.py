from models.entities.vfs import VFS
from repositories.base.sqlalchemy_repository import SQLAlchemyRepository


class VFSRepository(SQLAlchemyRepository[VFS]):
    def __init__(self, session, model=VFS):
        super().__init__(session, model)