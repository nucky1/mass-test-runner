"""Tests para PluginFactory"""
import pytest
from app.core.plugin import PluginFactory, DemoPlugin


def test_plugin_factory_get_demo():
    """Test que PluginFactory puede obtener DemoPlugin"""
    plugin = PluginFactory.get("demo")
    
    assert isinstance(plugin, DemoPlugin)


def test_plugin_factory_invalid_plugin():
    """Test que PluginFactory lanza error para plugin inválido"""
    with pytest.raises(ValueError, match="no encontrado"):
        PluginFactory.get("invalid_plugin")
