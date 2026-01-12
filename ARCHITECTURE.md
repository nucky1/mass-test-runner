# Arquitectura del Sistema

## Resumen

Sistema de testing masivo construido según el diseño en `diagramas-clase.md`. El sistema permite ejecutar tests sobre diferentes plugins con persistencia de resultados y análisis de métricas.

## Componentes Principales

### Backend (FastAPI)

#### Core
- **MassTestRunner** (`app/core/runner.py`): Ejecuta tests masivos usando un plugin
- **ResultStore** (`app/core/store.py`): Implementación SQL para persistencia
- **TestPlugin** (`app/core/plugin.py`): Interfaz base para plugins
- **PluginFactory** (`app/core/plugin.py`): Factory para obtener plugins
- **DemoPlugin** (`app/core/plugin.py`): Plugin de demostración

#### Modelos
- **DTOs** (`app/models/dto.py`): Case, Pred, Compare, Metrics, RunResult, RunConfig, RunSummary, RunDetail, CommentRequest, PluginCreate, PluginUpdate, PluginInfo
- **DB Models** (`app/models/db.py`): Run, RunDetail, Plugin (SQLAlchemy)

#### API
- **Routes** (`app/api/routes.py`): Endpoints REST para ejecuciones
  - POST /api/runs - Crear ejecución
  - GET /api/runs - Listar ejecuciones (con paginación: limit, offset)
  - GET /api/runs/{run_id} - Obtener ejecución
  - GET /api/runs/{run_id}/details - Obtener detalles (con filtros: all, mismatch, error)
  - POST /api/runs/{run_id}/details/{case_id}/comment - Agregar comentario/tag/marcar revisado
  - GET /api/runs/{run_id}/export.csv - Exportar CSV
- **Plugin Routes** (`app/api/plugin_routes.py`): Endpoints REST para plugins
  - GET /api/plugins - Listar todos los plugins (built-in + dinámicos)
  - GET /api/plugins/{plugin_name} - Obtener información de un plugin
  - POST /api/plugins - Crear nuevo plugin dinámico
  - PUT /api/plugins/{plugin_name} - Actualizar plugin dinámico
  - DELETE /api/plugins/{plugin_name} - Eliminar plugin dinámico
  - POST /api/plugins/{plugin_name}/test - Probar plugin

#### Base de Datos
- **Session** (`app/db/session.py`): Configuración SQLAlchemy
- **Migraciones** (`alembic/versions/`): Migraciones Alembic

### Frontend (React + Vite + TypeScript)

#### Páginas
- **RunsPage** (`src/pages/RunsPage.tsx`): Dashboard con lista de ejecuciones y formulario de creación
- **RunDetailPage** (`src/pages/RunDetailPage.tsx`): Vista detallada con tabs (Resumen, Mismatches, Todos, Errores)
- **PluginsPage** (`src/pages/PluginsPage.tsx`): Gestión completa de plugins (crear, editar, listar, eliminar, probar)

#### Servicios
- **API Service** (`src/services/api.ts`): Cliente API con TypeScript

#### Funcionalidades del Frontend

##### RunsPage (Dashboard de Ejecuciones)
- **Listar ejecuciones**: Tabla con todas las ejecuciones y sus métricas
- **Crear nueva ejecución**: Formulario dinámico que:
  - Carga plugins disponibles desde la API
  - Permite seleccionar un plugin
  - Genera campos de configuración dinámicamente basados en el `config_schema` del plugin
  - Soporta diferentes tipos de campos (int, float, string, bool)
- **Visualización de métricas**: Accuracy, Coverage, Error Rate, Total de casos, Mismatches, Errores
- **Navegación**: Click en "Ver" para ir al detalle de una ejecución

##### RunDetailPage (Detalle de Ejecución)
- **Resumen de métricas**: Panel con todas las métricas principales
- **Tabs de filtrado**:
  - **Resumen**: Vista general (primeros casos)
  - **Mismatches**: Solo casos que no coincidieron
  - **Todos**: Todos los casos del run
  - **Errores**: Solo casos con errores (pred.ok = False)
- **Tabla de casos**: Lista con Case ID, Truth, Pred, Match, Status, Revisado
- **Modal de detalle de caso**:
  - Datos completos del caso (case_data como JSON)
  - Comparación detallada (Truth vs Pred)
  - Raw response (respuesta cruda del plugin)
  - Metadata (información adicional)
  - **Sistema de comentarios**:
    - Agregar comentarios a casos
    - Agregar tags
    - Marcar como revisado
- **Exportar a CSV**: Botón para descargar todos los casos en formato CSV

##### PluginsPage (Gestión de Plugins)
- **Listar plugins**: Tabla con todos los plugins (built-in y dinámicos)
  - Información: Nombre, Display Name, Estado, Fechas, Config Schema
  - Indicadores visuales de estado (active, error, disabled)
  - Mensajes de error si el plugin tiene problemas
- **Crear plugin**:
  - Formulario con campos: plugin_name, display_name, code, config_schema (JSON)
  - Validación automática del código al crear
  - El sistema prueba el plugin automáticamente
- **Editar plugin**:
  - Modificar display_name, code, config_schema
  - No permite editar plugins built-in (como "demo")
  - Prueba automática si se modifica el código
- **Probar plugin**: Botón para ejecutar prueba manual del plugin
- **Eliminar plugin**: Eliminar plugins dinámicos (no built-in)

## Flujo de Ejecución

1. Usuario crea ejecución desde frontend (POST /api/runs)
2. Backend crea run en DB (status="running")
3. MassTestRunner obtiene plugin desde PluginFactory
4. Plugin.obtener_casos() genera casos
5. Para cada caso:
   - Plugin.ejecutar_test() genera Pred
   - Plugin.comparar_resultados() genera Compare
   - ResultStore.save_detail() guarda resultado
6. ResultStore.compute_metrics() calcula métricas
7. ResultStore.close_run() marca run como completado
8. Frontend muestra resultados

## Base de Datos

### Tabla: runs
- run_id (PK)
- plugin_name
- status (running/completed/failed)
- config (JSONB)
- created_at, completed_at
- accuracy, coverage, error_rate (métricas)
- confusion_matrix (JSONB)

### Tabla: run_details
- id (PK)
- run_id (FK)
- case_id
- case_data (JSONB)
- truth, pred_value
- pred_ok, pred_status
- pred_raw, pred_meta (JSONB)
- match, mismatch_reason
- compare_detail (JSONB)
- comment, tag, reviewed

### Tabla: plugins
- plugin_name (PK)
- display_name
- code (TEXT) - Código Python del plugin
- config_schema (JSONB) - Schema de configuración
- status (active/error/disabled)
- error_message (TEXT) - Último error si status == "error"
- created_at, updated_at, last_test_at

## Métricas

- **Accuracy**: matches / evaluados (solo donde pred.value exista)
- **Coverage**: pred.ok && pred.value != null / total
- **Error Rate**: pred.ok == False / total
- **Confusion Matrix**: Matriz de confusión (soporta multiclass)

## Extensibilidad

### Agregar un nuevo plugin dinámico (Desde el Frontend)

Los plugins dinámicos se crean desde la interfaz web sin necesidad de modificar código:

1. Navegar a `/plugins` en el frontend
2. Click en "Nuevo Plugin"
3. Completar el formulario:
   - **plugin_name**: Identificador único
   - **display_name**: Nombre descriptivo
   - **code**: Código Python que implementa `TestPlugin`
   - **config_schema**: JSON con los parámetros de configuración (ej: `{"param1": "int", "param2": "string"}`)
4. El sistema valida y prueba el plugin automáticamente

El plugin estará disponible inmediatamente para crear ejecuciones.

### Agregar un nuevo plugin built-in (Desde Código)

Para plugins hardcodeados:

1. Crear clase que implemente `TestPlugin` en `backend/app/core/plugin.py`
2. Registrar en `PluginFactory._plugins`:
```python
class PluginFactory:
    _plugins: Dict[str, type] = {
        "demo": DemoPlugin,
        "mi_plugin": MiPlugin,  # Agregar aquí
    }
```

**Nota**: Los plugins built-in no se pueden editar desde el frontend.

## Próximos Pasos

- Ejecución asíncrona con background workers
- Más plugins (TradeIn, ECRM, OpenAI)
- Mejoras en UI (gráficos, visualizaciones)
- Autenticación y autorización
- Tests de integración end-to-end
