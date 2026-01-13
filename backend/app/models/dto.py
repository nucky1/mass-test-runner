"""DTOs (Data Transfer Objects) basados en el diseño de diagramas-clase.md"""
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class Case(BaseModel):
    """Caso de prueba con datos de entrada"""
    id: str
    data: Dict[str, Any]


class Pred(BaseModel):
    """Predicción del modelo/sistema"""
    ok: bool
    value: Optional[str] = None
    status: str
    raw: Optional[str] = None
    meta: Dict[str, Any] = {}


class Compare(BaseModel):
    """Resultado de comparación entre truth y pred"""
    match: bool
    truth: Optional[str] = None
    pred: Optional[str] = None
    reason: str
    detail: Dict[str, Any] = {}


class Metrics(BaseModel):
    """Métricas calculadas para un run"""
    accuracy: float
    coverage: float
    error_rate: float
    confusion_matrix: Optional[Dict[str, Any]] = None


class RunResult(BaseModel):
    """Resultado de una ejecución completa"""
    run_id: str
    metrics: Metrics


class RunConfig(BaseModel):
    """Configuración para ejecutar un test run"""
    plugin_name: str
    config: Dict[str, Any] = {}  # Configuración específica del plugin (assistant_id, conexiones, etc.)


class RunSummary(BaseModel):
    """Resumen de un run para listado"""
    run_id: str
    plugin_name: str
    status: str
    created_at: datetime
    accuracy: Optional[float] = None
    coverage: Optional[float] = None
    error_rate: Optional[float] = None
    total_cases: int
    mismatches: int
    errors: int
    processed_cases: Optional[int] = None  # Casos procesados (para progreso)


class RunProgress(BaseModel):
    """Progreso de un run"""
    run_id: str
    status: str
    total_cases: Optional[int] = None
    processed_cases: int
    progress_percent: Optional[float] = None  # Porcentaje de completitud (0-100)


class RunDetail(BaseModel):
    """Detalle de un caso dentro de un run"""
    case_id: str
    case_data: Dict[str, Any]
    truth: Optional[str] = None
    pred_value: Optional[str] = None
    pred_ok: bool
    pred_status: str
    match: bool
    mismatch_reason: Optional[str] = None
    raw: Optional[str] = None
    meta: Dict[str, Any] = {}
    comment: Optional[str] = None
    tag: Optional[str] = None
    reviewed: bool = False


class CommentRequest(BaseModel):
    """Request para agregar comentario a un caso"""
    comment: Optional[str] = None
    tag: Optional[str] = None
    reviewed: bool = False


class PluginCreate(BaseModel):
    """Request para crear un plugin"""
    plugin_name: str
    display_name: str
    code: str
    config_schema: Dict[str, Any] = {}


class PluginUpdate(BaseModel):
    """Request para actualizar un plugin"""
    display_name: Optional[str] = None
    code: Optional[str] = None
    config_schema: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # active, error, disabled


class PluginInfo(BaseModel):
    """Información de un plugin"""
    plugin_name: str
    display_name: str
    status: str
    error_message: Optional[str] = None
    config_schema: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime
    last_test_at: Optional[datetime] = None
