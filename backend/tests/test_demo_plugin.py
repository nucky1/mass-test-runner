"""Tests para DemoPlugin"""
import pytest
from app.core.plugin import DemoPlugin
from app.models.dto import Case


def test_demo_plugin_obtener_casos():
    """Test que DemoPlugin genera casos correctamente"""
    plugin = DemoPlugin()
    config = {"num_casos": 10, "error_rate": 0.1}
    
    casos = list(plugin.obtener_casos(config))
    
    assert len(casos) == 10
    assert all(isinstance(caso, Case) for caso in casos)
    assert all(caso.id.startswith("demo_case_") for caso in casos)
    assert all("label" in caso.data for caso in casos)


def test_demo_plugin_ejecutar_test():
    """Test que DemoPlugin ejecuta tests"""
    plugin = DemoPlugin()
    caso = Case(id="test_case", data={"label": "T1", "input_text": "test"})
    config = {"error_rate": 0.0}  # Sin errores
    
    pred = plugin.ejecutar_test(caso, config)
    
    assert pred.ok is True
    assert pred.value is not None
    assert pred.status == "success"


def test_demo_plugin_ejecutar_test_with_errors():
    """Test que DemoPlugin puede generar errores"""
    plugin = DemoPlugin()
    caso = Case(id="test_case", data={"label": "T1", "input_text": "test"})
    config = {"error_rate": 1.0}  # 100% errores
    
    pred = plugin.ejecutar_test(caso, config)
    
    assert pred.ok is False
    assert pred.status == "error"


def test_demo_plugin_comparar_resultados():
    """Test que DemoPlugin compara resultados correctamente"""
    plugin = DemoPlugin()
    caso = Case(id="test_case", data={"label": "T1", "input_text": "test"})
    
    # Predicción correcta
    pred_correcta = plugin.ejecutar_test(caso, {"error_rate": 0.0})
    # Forzar que sea correcta
    pred_correcta.value = "T1"
    
    cmp = plugin.comparar_resultados(caso, pred_correcta, {})
    
    assert cmp.match is True
    assert cmp.truth == "T1"
    assert cmp.pred == "T1"


def test_demo_plugin_comparar_resultados_mismatch():
    """Test comparación cuando hay mismatch"""
    plugin = DemoPlugin()
    caso = Case(id="test_case", data={"label": "T1", "input_text": "test"})
    
    # Predicción incorrecta
    pred_incorrecta = plugin.ejecutar_test(caso, {"error_rate": 0.0})
    pred_incorrecta.value = "T4"  # Forzar mismatch
    
    cmp = plugin.comparar_resultados(caso, pred_incorrecta, {})
    
    assert cmp.match is False
    assert cmp.truth == "T1"
    assert cmp.pred == "T4"
    assert "mismatch" in cmp.reason.lower() or "T1" in cmp.reason
