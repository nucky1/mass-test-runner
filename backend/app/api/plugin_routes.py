"""Endpoints para gestión de plugins"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from app.db.session import get_db
from app.core.plugin import PluginFactory
from app.models.dto import PluginCreate, PluginUpdate, PluginInfo
from app.models.db import Plugin
from app.core.deps import ALLOWED_PACKAGES, BUILTIN_PACKAGES

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


@router.get("/deps")
def get_plugin_deps() -> Dict[str, Any]:
    """Obtiene la lista de dependencias permitidas para plugins"""
    return {
        "allowed": sorted(list(ALLOWED_PACKAGES)),
        "builtin": sorted(list(BUILTIN_PACKAGES)),
        "note": "Si necesitás otra librería (no builtin y no listada), instalala en el proyecto antes de importarla."
    }

@router.post("", response_model=PluginInfo)
def create_plugin(plugin_data: PluginCreate, db: Session = Depends(get_db)):
    """Crea un nuevo plugin"""
    # Verificar que no exista
    existing = db.query(Plugin).filter(Plugin.plugin_name == plugin_data.plugin_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Plugin '{plugin_data.plugin_name}' ya existe")
    
    # Crear plugin
    plugin = Plugin(
        plugin_name=plugin_data.plugin_name,
        display_name=plugin_data.display_name,
        code=plugin_data.code,
        config_schema=plugin_data.config_schema,
        status="active",  # Por defecto activo, se probará al crear
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(plugin)
    db.commit()
    
    # Probar el plugin
    success, error_msg = PluginFactory.test_plugin(plugin_data.plugin_name, db)
    if not success:
        plugin.status = "error"
        plugin.error_message = error_msg
        db.commit()
    
    return PluginInfo(
        plugin_name=plugin.plugin_name,
        display_name=plugin.display_name,
        status=plugin.status,
        error_message=plugin.error_message,
        config_schema=plugin.config_schema,
        created_at=plugin.created_at,
        updated_at=plugin.updated_at,
        last_test_at=plugin.last_test_at
    )


@router.get("", response_model=List[PluginInfo])
def list_plugins(db: Session = Depends(get_db)):
    """Lista todos los plugins"""
    plugins = db.query(Plugin).order_by(Plugin.plugin_name).all()
    
    # También incluir plugins built-in
    built_in_plugins = [
        PluginInfo(
            plugin_name="demo",
            display_name="Demo Plugin",
            status="active",
            error_message=None,
            config_schema={"num_casos": "int", "error_rate": "float"},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_test_at=None
        )
    ]
    
    db_plugins = [
        PluginInfo(
            plugin_name=p.plugin_name,
            display_name=p.display_name,
            status=p.status,
            error_message=p.error_message,
            config_schema=p.config_schema,
            created_at=p.created_at,
            updated_at=p.updated_at,
            last_test_at=p.last_test_at
        )
        for p in plugins
    ]
    
    return built_in_plugins + db_plugins


@router.get("/{plugin_name}", response_model=PluginInfo)
def get_plugin(plugin_name: str, db: Session = Depends(get_db)):
    """Obtiene información de un plugin"""
    # Si es built-in
    if plugin_name == "demo":
        return PluginInfo(
            plugin_name="demo",
            display_name="Demo Plugin",
            status="active",
            error_message=None,
            config_schema={"num_casos": "int", "error_rate": "float"},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_test_at=None
        )
    
    plugin = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin no encontrado")
    
    return PluginInfo(
        plugin_name=plugin.plugin_name,
        display_name=plugin.display_name,
        status=plugin.status,
        error_message=plugin.error_message,
        config_schema=plugin.config_schema,
        created_at=plugin.created_at,
        updated_at=plugin.updated_at,
        last_test_at=plugin.last_test_at
    )


@router.put("/{plugin_name}", response_model=PluginInfo)
def update_plugin(plugin_name: str, plugin_data: PluginUpdate, db: Session = Depends(get_db)):
    """Actualiza un plugin"""
    if plugin_name == "demo":
        raise HTTPException(status_code=400, detail="No se puede modificar el plugin 'demo'")
    
    plugin = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin no encontrado")
    
    # Actualizar campos
    if plugin_data.display_name is not None:
        plugin.display_name = plugin_data.display_name
    if plugin_data.code is not None:
        plugin.code = plugin_data.code
    if plugin_data.config_schema is not None:
        plugin.config_schema = plugin_data.config_schema
    if plugin_data.status is not None:
        plugin.status = plugin_data.status
    
    plugin.updated_at = datetime.utcnow()
    
    # Si se actualizó el código, probar el plugin
    if plugin_data.code is not None:
        success, error_msg = PluginFactory.test_plugin(plugin_name, db)
        if not success:
            plugin.status = "error"
            plugin.error_message = error_msg
        else:
            plugin.error_message = None
    
    db.commit()
    
    return PluginInfo(
        plugin_name=plugin.plugin_name,
        display_name=plugin.display_name,
        status=plugin.status,
        error_message=plugin.error_message,
        config_schema=plugin.config_schema,
        created_at=plugin.created_at,
        updated_at=plugin.updated_at,
        last_test_at=plugin.last_test_at
    )


@router.post("/{plugin_name}/test")
def test_plugin(plugin_name: str, db: Session = Depends(get_db)):
    """Prueba un plugin para verificar que funciona"""
    if plugin_name == "demo":
        return {"success": True, "message": "Plugin demo siempre funciona"}
    
    plugin = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin no encontrado")
    
    success, error_msg = PluginFactory.test_plugin(plugin_name, db)
    
    if success:
        return {"success": True, "message": "Plugin probado exitosamente"}
    else:
        return {"success": False, "message": error_msg}


@router.delete("/{plugin_name}")
def delete_plugin(plugin_name: str, db: Session = Depends(get_db)):
    """Elimina un plugin"""
    if plugin_name == "demo":
        raise HTTPException(status_code=400, detail="No se puede eliminar el plugin 'demo'")
    
    plugin = db.query(Plugin).filter(Plugin.plugin_name == plugin_name).first()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin no encontrado")
    
    db.delete(plugin)
    db.commit()
    
    return {"message": f"Plugin '{plugin_name}' eliminado"}

