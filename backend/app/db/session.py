"""Configuración de base de datos SQLAlchemy"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.db import Base
import os
from dotenv import load_dotenv

load_dotenv()

# URL de conexión a la base de datos
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/test_ia_db"
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Inicializa las tablas en la base de datos"""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Dependency para obtener sesión de DB en FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
