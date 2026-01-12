"""Endpoints de la API FastAPI"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from enum import Enum
import csv
import io
from datetime import datetime

from app.db.session import get_db
from app.core.runner import MassTestRunner
from app.core.store import ResultStore
from app.models.dto import (
    RunConfig, RunResult, RunSummary, RunDetail as RunDetailDTO, CommentRequest
)
from app.models.db import Run, RunDetail

router = APIRouter(prefix="/api", tags=["runs"])


class DetailFilter(str, Enum):
    """Filtros disponibles para detalles de run"""
    ALL = "all"
    MISMATCH = "mismatch"
    ERROR = "error"


def get_store(db: Session = Depends(get_db)) -> ResultStore:
    """Dependency para obtener ResultStore"""
    return ResultStore(db)


def get_runner(store: ResultStore = Depends(get_store)) -> MassTestRunner:
    """Dependency para obtener MassTestRunner"""
    return MassTestRunner(store)


@router.post("/runs", response_model=RunResult)
def create_run(config: RunConfig, runner: MassTestRunner = Depends(get_runner), db: Session = Depends(get_db)):
    """Crea una nueva ejecución y la ejecuta síncronamente"""
    try:
        result = runner.run(config, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs", response_model=List[RunSummary])
def list_runs(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    store: ResultStore = Depends(get_store)
):
    """Lista todas las ejecuciones"""
    runs = store.get_runs(limit=limit, offset=offset)
    
    summaries = []
    for run in runs:
        # Contar detalles
        total = store.get_run_details_count(run.run_id)
        mismatches = store.get_run_details_count(run.run_id, filter_type="mismatch")
        errors = store.get_run_details_count(run.run_id, filter_type="error")
        
        summaries.append(RunSummary(
            run_id=run.run_id,
            plugin_name=run.plugin_name,
            status=run.status,
            created_at=run.created_at,
            accuracy=run.accuracy,
            coverage=run.coverage,
            error_rate=run.error_rate,
            total_cases=total,
            mismatches=mismatches,
            errors=errors
        ))
    
    return summaries


@router.get("/runs/{run_id}", response_model=RunSummary)
def get_run(run_id: str, db: Session = Depends(get_db), store: ResultStore = Depends(get_store)):
    """Obtiene detalles de una ejecución"""
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run no encontrado")
    
    total = store.get_run_details_count(run.run_id)
    mismatches = store.get_run_details_count(run.run_id, filter_type="mismatch")
    errors = store.get_run_details_count(run.run_id, filter_type="error")
    
    return RunSummary(
        run_id=run.run_id,
        plugin_name=run.plugin_name,
        status=run.status,
        created_at=run.created_at,
        accuracy=run.accuracy,
        coverage=run.coverage,
        error_rate=run.error_rate,
        total_cases=total,
        mismatches=mismatches,
        errors=errors
    )


@router.get("/runs/{run_id}/details", response_model=List[RunDetailDTO])
def get_run_details(
    run_id: str,
    filter: Optional[DetailFilter] = Query(None, description="Filtro: all, mismatch, error"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    store: ResultStore = Depends(get_store)
):
    """Obtiene detalles de casos de un run con filtros"""
    # Verificar que el run existe
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run no encontrado")
    
    # Convertir Enum a string o None
    filter_str = filter.value if filter else None
    details = store.get_run_details(run_id, filter_type=filter_str, limit=limit, offset=offset)
    
    return [
        RunDetailDTO(
            case_id=d.case_id,
            case_data=d.case_data,
            truth=d.truth,
            pred_value=d.pred_value,
            pred_ok=d.pred_ok,
            pred_status=d.pred_status,
            match=d.match,
            mismatch_reason=d.mismatch_reason,
            raw=d.pred_raw,
            meta=d.pred_meta,
            comment=d.comment,
            tag=d.tag,
            reviewed=d.reviewed
        )
        for d in details
    ]


@router.post("/runs/{run_id}/details/{case_id}/comment")
def add_comment(
    run_id: str,
    case_id: str,
    comment_req: CommentRequest,
    store: ResultStore = Depends(get_store)
):
    """Agrega comentario/tag/marca como revisado a un caso"""
    # Verificar que el run existe
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run no encontrado")
    
    store.save_comment(
        run_id=run_id,
        case_id=case_id,
        comment=comment_req.comment,
        tag=comment_req.tag,
        reviewed=comment_req.reviewed
    )
    
    return {"message": "Comentario actualizado"}


@router.get("/runs/{run_id}/export.csv")
def export_csv(run_id: str, store: ResultStore = Depends(get_store)):
    """Exporta detalles de un run a CSV"""
    # Verificar que el run existe
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run no encontrado")
    
    details = store.get_run_details(run_id, filter_type="all", limit=10000, offset=0)
    
    # Crear CSV en memoria
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "case_id", "truth", "pred_value", "match", "pred_ok", "pred_status",
        "mismatch_reason", "comment", "tag", "reviewed"
    ])
    
    # Datos
    for d in details:
        writer.writerow([
            d.case_id,
            d.truth or "",
            d.pred_value or "",
            d.match,
            d.pred_ok,
            d.pred_status,
            d.mismatch_reason or "",
            d.comment or "",
            d.tag or "",
            d.reviewed
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=run_{run_id}.csv"}
    )
