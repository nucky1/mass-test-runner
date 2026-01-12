# Changelog - Mejoras Implementadas

## Cambios Realizados

### 1. ✅ Corregido error 422 en endpoint details
- **Problema**: El endpoint `/api/runs/{run_id}/details` daba error 422 cuando se pasaba `filter=errors`
- **Solución**: 
  - Cambiado el parámetro `filter` para usar un Enum (`DetailFilter`) en lugar de regex
  - El Enum acepta: `all`, `mismatch`, `error`
  - El frontend ahora puede usar `filter=error` correctamente

### 2. ✅ Mejorado sistema de configuración para plugins
- **Mejora**: El campo `config` en `RunConfig` ahora se pasa correctamente al plugin
- **Uso**: Los plugins pueden recibir configuración como `assistant_id`, conexiones, etc.
- **Ejemplo**:
```json
{
  "plugin_name": "mi_plugin",
  "config": {
    "assistant_id": "asst_xxx",
    "connection_string": "postgresql://...",
    "num_casos": 50
  }
}
```

### 3. ✅ Sistema de gestión de plugins
- **Nuevo**: Tabla `plugins` en la base de datos
- **Endpoints creados**:
  - `POST /api/plugins` - Crear nuevo plugin
  - `GET /api/plugins` - Listar todos los plugins
  - `GET /api/plugins/{plugin_name}` - Obtener información de un plugin
  - `PUT /api/plugins/{plugin_name}` - Actualizar plugin
  - `POST /api/plugins/{plugin_name}/test` - Probar plugin
  - `DELETE /api/plugins/{plugin_name}` - Eliminar plugin

- **Campos del plugin**:
  - `plugin_name`: Identificador único
  - `display_name`: Nombre para mostrar
  - `code`: Código Python del plugin (debe implementar TestPlugin)
  - `config_schema`: Schema JSON de la configuración esperada
  - `status`: `active`, `error`, `disabled`
  - `error_message`: Último error si status == "error"
  - `last_test_at`: Última vez que se probó

- **Carga dinámica**: Los plugins se cargan dinámicamente desde la base de datos usando `exec()`

### 4. ✅ Validación de estado de plugins
- **Mejora**: Los plugins con `status="error"` no pueden usarse en ejecuciones
- **Validación automática**: 
  - Al intentar usar un plugin, se valida su estado
  - Si tiene errores, se lanza excepción con el mensaje de error
  - Si está deshabilitado, también se bloquea su uso

- **Testing automático**:
  - Al crear/actualizar un plugin, se prueba automáticamente
  - Si falla, se marca como `error` con el mensaje de error
  - Endpoint `/api/plugins/{plugin_name}/test` para probar manualmente

## Migraciones Necesarias

Ejecutar la nueva migración:
```bash
cd backend
alembic upgrade head
```

Esto creará la tabla `plugins` con todos los campos necesarios.

## Ejemplo de Uso

### Crear un plugin:

```bash
POST /api/plugins
{
  "plugin_name": "mi_plugin",
  "display_name": "Mi Plugin Personalizado",
  "code": "
from app.models.dto import Case, Pred, Compare
from app.core.plugin import TestPlugin

class MiPlugin(TestPlugin):
    def obtener_casos(self, config):
        # Usar config.get('assistant_id'), etc.
        return [Case(id='1', data={'label': 'T1'})]
    
    def ejecutar_test(self, caso, config):
        # Lógica de ejecución
        return Pred(ok=True, value='T1', status='success', raw='{}', meta={})
    
    def comparar_resultados(self, caso, pred, config):
        return Compare(match=True, truth=caso.data['label'], pred=pred.value, reason='Match', detail={})
",
  "config_schema": {
    "assistant_id": "string",
    "connection_string": "string"
  }
}
```

### Usar el plugin en una ejecución:

```bash
POST /api/runs
{
  "plugin_name": "mi_plugin",
  "config": {
    "assistant_id": "asst_xxx",
    "connection_string": "postgresql://..."
  }
}
```

## Notas de Seguridad

⚠️ **Importante**: La carga dinámica de código Python usando `exec()` puede ser un riesgo de seguridad. En producción, considerar:
- Validación del código antes de ejecutarlo
- Sandboxing del código ejecutado
- Restricciones de imports peligrosos
- Revisión manual del código antes de activarlo

## Archivos Modificados

- `backend/app/api/routes.py` - Corregido filtro con Enum
- `backend/app/models/db.py` - Agregada tabla Plugin
- `backend/app/models/dto.py` - Agregados DTOs para plugins
- `backend/app/core/plugin.py` - Sistema de carga dinámica y validación
- `backend/app/core/runner.py` - Validación de estado antes de ejecutar
- `backend/app/api/plugin_routes.py` - Nuevos endpoints para gestión
- `backend/app/main.py` - Registrado router de plugins
- `backend/alembic/versions/002_add_plugins_table.py` - Nueva migración
