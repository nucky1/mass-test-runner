"""ResultStore: implementación SQL para persistencia"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List, Dict, Any
from app.models.db import Run, RunDetail
from app.models.dto import Metrics
from datetime import datetime
import uuid


class ResultStore:
    """Implementación de ResultStore usando SQLAlchemy"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_run(self, plugin_name: str, config: Dict[str, Any]) -> str:
        """Crea un nuevo run y devuelve su ID"""
        run_id = str(uuid.uuid4())
        run = Run(
            run_id=run_id,
            plugin_name=plugin_name,
            status="running",
            config=config,
            created_at=datetime.utcnow()
        )
        self.db.add(run)
        self.db.commit()
        return run_id
    
    def save_detail(self, run_id: str, caso, pred, cmp) -> None:
        """Guarda un detalle de caso"""
        detail = RunDetail(
            run_id=run_id,
            case_id=caso.id,
            case_data=caso.data,
            truth=cmp.truth,
            pred_value=pred.value,
            pred_ok=pred.ok,
            pred_status=pred.status,
            pred_raw=pred.raw,
            pred_meta=pred.meta,
            match=cmp.match,
            mismatch_reason=cmp.reason if not cmp.match else None,
            compare_detail=cmp.detail
        )
        self.db.add(detail)
        self.db.commit()
    
    def compute_metrics(self, run_id: str) -> Metrics:
        """Calcula métricas para un run"""
        details = self.db.query(RunDetail).filter(RunDetail.run_id == run_id).all()
        
        if not details:
            return Metrics(accuracy=0.0, coverage=0.0, error_rate=0.0)
        
        total = len(details)
        
        # Coverage: pred.ok && pred.value != null / total
        covered = sum(1 for d in details if d.pred_ok and d.pred_value is not None)
        coverage = covered / total if total > 0 else 0.0
        
        # Error rate: pred.ok == False / total
        errors = sum(1 for d in details if not d.pred_ok)
        error_rate = errors / total if total > 0 else 0.0
        
        # Accuracy: matches / evaluados (solo donde pred.value exista)
        evaluados = [d for d in details if d.pred_value is not None]
        if evaluados:
            matches = sum(1 for d in evaluados if d.match)
            accuracy = matches / len(evaluados)
        else:
            accuracy = 0.0
        
        # Confusion matrix (si hay labels binarias o multiclass)
        confusion_matrix = self._compute_confusion_matrix(details)
        
        return Metrics(
            accuracy=accuracy,
            coverage=coverage,
            error_rate=error_rate,
            confusion_matrix=confusion_matrix
        )
    
    def _compute_confusion_matrix(self, details: List[RunDetail]) -> Optional[Dict[str, Any]]:
        """Calcula matriz de confusión para casos evaluados"""
        evaluados = [d for d in details if d.pred_value is not None and d.truth is not None]
        
        if not evaluados:
            return None
        
        # Construir matriz de confusión
        labels = set()
        for d in evaluados:
            if d.truth:
                labels.add(d.truth)
            if d.pred_value:
                labels.add(d.pred_value)
        
        labels = sorted(list(labels))
        matrix = {label: {label2: 0 for label2 in labels} for label in labels}
        
        for d in evaluados:
            truth_label = d.truth or "unknown"
            pred_label = d.pred_value or "unknown"
            if truth_label in matrix and pred_label in matrix[truth_label]:
                matrix[truth_label][pred_label] += 1
        
        return {
            "labels": labels,
            "matrix": matrix
        }
    
    def close_run(self, run_id: str) -> None:
        """Marca un run como completado"""
        run = self.db.query(Run).filter(Run.run_id == run_id).first()
        if run:
            metrics = self.compute_metrics(run_id)
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            run.accuracy = metrics.accuracy
            run.coverage = metrics.coverage
            run.error_rate = metrics.error_rate
            run.confusion_matrix = metrics.confusion_matrix
            self.db.commit()
    
    def save_comment(self, run_id: str, case_id: str, comment: Optional[str] = None,
                     tag: Optional[str] = None, reviewed: bool = False) -> None:
        """Guarda comentario/tag/reviewed para un caso"""
        detail = self.db.query(RunDetail).filter(
            and_(RunDetail.run_id == run_id, RunDetail.case_id == case_id)
        ).first()
        
        if detail:
            if comment is not None:
                detail.comment = comment
            if tag is not None:
                detail.tag = tag
            detail.reviewed = reviewed
            self.db.commit()
    
    def get_run(self, run_id: str) -> Optional[Run]:
        """Obtiene un run por ID"""
        return self.db.query(Run).filter(Run.run_id == run_id).first()
    
    def get_runs(self, limit: int = 100, offset: int = 0) -> List[Run]:
        """Obtiene lista de runs"""
        return self.db.query(Run).order_by(Run.created_at.desc()).limit(limit).offset(offset).all()
    
    def get_run_details(self, run_id: str, filter_type: Optional[str] = None,
                        limit: int = 100, offset: int = 0) -> List[RunDetail]:
        """Obtiene detalles de un run con filtros opcionales"""
        query = self.db.query(RunDetail).filter(RunDetail.run_id == run_id)
        
        if filter_type == "mismatches":
            query = query.filter(RunDetail.match == False)
        elif filter_type == "errors":
            query = query.filter(RunDetail.pred_ok == False)
        # filter_type == "all" o None: sin filtro adicional
        
        return query.order_by(RunDetail.id).limit(limit).offset(offset).all()
    
    def get_run_details_count(self, run_id: str, filter_type: Optional[str] = None) -> int:
        """Cuenta detalles de un run con filtros"""
        query = self.db.query(RunDetail).filter(RunDetail.run_id == run_id)
        
        if filter_type == "mismatches":
            query = query.filter(RunDetail.match == False)
        elif filter_type == "errors":
            query = query.filter(RunDetail.pred_ok == False)
        
        return query.count()
