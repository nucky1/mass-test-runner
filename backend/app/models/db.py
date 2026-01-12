"""Modelos de base de datos SQLAlchemy"""
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Run(Base):
    """Tabla de ejecuciones (runs)"""
    __tablename__ = "runs"

    run_id = Column(String, primary_key=True)
    plugin_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running")  # running, completed, failed
    config = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Métricas calculadas
    accuracy = Column(Float, nullable=True)
    coverage = Column(Float, nullable=True)
    error_rate = Column(Float, nullable=True)
    confusion_matrix = Column(JSON, nullable=True)
    
    # Relación con detalles
    details = relationship("RunDetail", back_populates="run", cascade="all, delete-orphan")


class RunDetail(Base):
    """Tabla de detalles de casos dentro de un run"""
    __tablename__ = "run_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.run_id"), nullable=False, index=True)
    case_id = Column(String, nullable=False, index=True)
    
    # Datos del caso
    case_data = Column(JSON, nullable=False)
    
    # Truth y Pred
    truth = Column(String, nullable=True)
    pred_value = Column(String, nullable=True)
    pred_ok = Column(Boolean, nullable=False)
    pred_status = Column(String, nullable=False)
    pred_raw = Column(Text, nullable=True)
    pred_meta = Column(JSON, nullable=False, default={})
    
    # Comparación
    match = Column(Boolean, nullable=False)
    mismatch_reason = Column(Text, nullable=True)
    compare_detail = Column(JSON, nullable=False, default={})
    
    # Comentarios y revisión
    comment = Column(Text, nullable=True)
    tag = Column(String, nullable=True)
    reviewed = Column(Boolean, nullable=False, default=False)
    
    # Relación con run
    run = relationship("Run", back_populates="details")


class Plugin(Base):
    """Tabla de plugins registrados"""
    __tablename__ = "plugins"

    plugin_name = Column(String, primary_key=True)
    display_name = Column(String, nullable=False)
    code = Column(Text, nullable=False)  # Código Python del plugin
    config_schema = Column(JSON, nullable=False, default={})  # Schema de configuración esperada
    status = Column(String, nullable=False, default="active")  # active, error, disabled
    error_message = Column(Text, nullable=True)  # Último error si status == "error"
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_test_at = Column(DateTime, nullable=True)  # Última vez que se probó el plugin
