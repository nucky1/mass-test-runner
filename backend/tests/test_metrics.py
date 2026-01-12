"""Tests para cálculo de métricas"""
import pytest
from app.core.store import ResultStore
from app.models.db import Run, RunDetail
from app.models.dto import Case, Pred, Compare
from sqlalchemy.orm import Session
from datetime import datetime


def test_compute_metrics_perfect_match():
    """Test métricas cuando todos los casos matchean"""
    # Este test requiere una sesión de DB real, así que lo dejamos como ejemplo
    # En un entorno real usarías fixtures de pytest con una DB de test
    pass


def test_compute_metrics_with_errors():
    """Test métricas cuando hay errores"""
    pass


def test_compute_metrics_coverage():
    """Test cálculo de coverage"""
    # Coverage = pred.ok && pred.value != null / total
    # Si tenemos 10 casos y 8 tienen pred.ok=True y pred.value != null, coverage = 0.8
    pass


def test_compute_metrics_accuracy():
    """Test cálculo de accuracy"""
    # Accuracy = matches / evaluados (solo donde pred.value exista)
    # Si tenemos 10 casos evaluados y 7 matchean, accuracy = 0.7
    pass


def test_compute_metrics_error_rate():
    """Test cálculo de error_rate"""
    # Error rate = pred.ok == False / total
    # Si tenemos 10 casos y 2 tienen pred.ok=False, error_rate = 0.2
    pass
