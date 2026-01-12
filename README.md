# Mass Test Runner

Sistema de testing masivo para ejecutar tests sobre diferentes plugins (TradeIn, ECRM, OpenAI, etc.) con persistencia de resultados y análisis de métricas.

## Arquitectura

El sistema está basado en el diseño definido en `diagramas-clase.md`:

- **MassTestRunner**: Ejecuta tests masivos usando un plugin
- **TestPlugin**: Interfaz que deben implementar todos los plugins
- **PluginFactory**: Factory para obtener plugins por nombre
- **ResultStore**: Persistencia de resultados en base de datos
- **DTOs**: Case, Pred, Compare, Metrics, RunResult

## Estructura del Proyecto

```
test-IA-app/
├── backend/          # API FastAPI
│   ├── app/
│   │   ├── api/     # Endpoints
│   │   ├── core/    # Lógica de negocio (Runner, Store, Plugin)
│   │   ├── models/  # DTOs y modelos DB
│   │   └── db/      # Configuración DB
│   ├── alembic/     # Migraciones
│   └── tests/       # Tests unitarios
├── frontend/         # React + Vite + TypeScript
│   └── src/
│       ├── pages/   # Páginas principales
│       ├── services/# Cliente API
│       └── components/ # Componentes reutilizables
└── docs/            # Documentación y ADRs
```

## Requisitos

- Python 3.10+
- Node.js 18+
- PostgreSQL 12+ (o Docker para ejecutar PostgreSQL)

## Instalación y Configuración

### 1. Base de Datos (Docker Compose)

Iniciar PostgreSQL con Docker Compose:

```bash
# Desde la raíz del proyecto
docker compose up -d
```

Esto iniciará PostgreSQL en el puerto 5432 con:
- Usuario: `postgres`
- Contraseña: `postgres`
- Base de datos: `test_ia_db`

### 2. Backend

1. Navegar al directorio del backend:
```bash
cd backend
```

2. Crear entorno virtual:
```bash
python -m venv venv
```
```bash
# En Windows:
venv\Scripts\activate

# En Linux/Mac:
source venv/bin/activate
```

3. Instalar dependencias:
```bash
pip install -r requirements.txt
```

4. (Opcional) Configurar variables de entorno:
```bash
# Crear archivo .env en backend/ si quieres personalizar la conexión
# Por defecto usa: postgresql://postgres:postgres@localhost:5432/test_ia_db
```

5. Ejecutar migraciones:
```bash
alembic upgrade head
```

6. Iniciar servidor:
```bash
# Opción 1: Usando el script (Windows)
start.bat

# Opción 2: Usando el script (Linux/Mac)
./start.sh

# Opción 3: Manualmente
uvicorn app.main:app --reload --port 8000
```

El API estará disponible en `http://localhost:8000`
Documentación Swagger en `http://localhost:8000/docs`

### 3. Frontend

1. Navegar al directorio del frontend:
```bash
cd frontend
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar servidor de desarrollo:
```bash
# Opción 1: Usando el script (Windows)
start.bat

# Opción 2: Manualmente
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## Uso

### Crear una ejecución

1. Abrir el frontend en `http://localhost:5173`
2. Click en "Nueva Ejecución"
3. Seleccionar plugin "demo"
4. Configurar número de casos y error rate
5. Click en "Crear Ejecución"

### Ver resultados

- **Dashboard**: Lista de todas las ejecuciones con métricas principales
- **Detalle de Run**: Tabs para ver Resumen, Mismatches, Todos los casos, Errores
- **Detalle de Caso**: Modal con información completa, comentarios y tags

### Exportar resultados

En la página de detalle de un run, click en "Exportar CSV" para descargar todos los casos.

## Plugins

El sistema soporta dos tipos de plugins:

1. **Plugins Built-in**: Plugins hardcodeados en el código (como "demo")
2. **Plugins Dinámicos**: Plugins almacenados en base de datos que pueden crearse/editarse desde el frontend

### Arquitectura de Plugins

Los plugins siguen el patrón de diseño **Plugin Pattern**, donde cada plugin implementa la interfaz `TestPlugin` con tres métodos principales:

- **`obtener_casos(config)`**: Genera/obtiene los casos de prueba
- **`ejecutar_test(caso, config)`**: Ejecuta el test para un caso y devuelve la predicción
- **`comparar_resultados(caso, pred, config)`**: Compara el resultado esperado con la predicción

Esta arquitectura permite:
- **Extensibilidad**: Agregar nuevos plugins sin modificar el código core
- **Flexibilidad**: Cada plugin puede tener su propia lógica interna
- **Reutilización**: El framework (Runner, Store) es independiente de los plugins
- **Testing**: Fácil de testear cada plugin de forma aislada

### DemoPlugin (Built-in)

Plugin de demostración incluido para probar el sistema:

- Genera casos simulados con labels T1/T2/T3/T4
- Ejecuta tests con tasa de error configurable (`error_rate`)
- Compara resultados y genera mismatches
- Config schema: `{"num_casos": "int", "error_rate": "float"}`

### Crear un Plugin Dinámico (Desde el Frontend)

Los plugins dinámicos se crean desde la interfaz web sin necesidad de modificar código:

1. **Acceder a la página de Plugins**: Navegar a `/plugins` en el frontend
2. **Click en "Nuevo Plugin"**
3. **Completar el formulario**:
   - **Nombre del Plugin (ID)**: Identificador único (ej: `mi_plugin`)
   - **Nombre para Mostrar**: Nombre descriptivo (ej: `Mi Plugin`)
   - **Código del Plugin**: Código Python que implementa `TestPlugin`
   - **Config Schema (JSON)**: Especifica los parámetros de configuración

4. **El sistema automáticamente**:
   - Valida que el código compile correctamente
   - Verifica que implemente la interfaz `TestPlugin`
   - Ejecuta una prueba básica del plugin
   - Marca el plugin como "active" si pasa las pruebas, o "error" si falla

#### Ejemplo de Código de Plugin

```python
from app.core.plugin import TestPlugin
from app.models.dto import Case, Pred, Compare

class MiPlugin(TestPlugin):
    def obtener_casos(self, config):
        """Genera casos de prueba"""
        num_casos = config.get("num_casos", 10)
        casos = []
        for i in range(num_casos):
            casos.append(Case(
                id=f"case_{i}",
                data={"input": f"test_{i}", "label": "T1"}
            ))
        return casos
    
    def ejecutar_test(self, caso, config):
        """Ejecuta el test y devuelve la predicción"""
        # Tu lógica aquí (llamar a API, procesar, etc.)
        return Pred(
            ok=True,
            value="T1",
            status="success",
            raw='{"result": "T1"}',
            meta={"confidence": 0.95}
        )
    
    def comparar_resultados(self, caso, pred, config):
        """Compara truth vs pred"""
        truth = caso.data.get("label")
        match = truth == pred.value
        return Compare(
            match=match,
            truth=truth,
            pred=pred.value,
            reason="Match" if match else f"Truth: {truth}, Pred: {pred.value}",
            detail={"match": match}
        )
```

#### Config Schema

El `config_schema` define los parámetros de configuración que el plugin acepta. Se especifica como JSON donde las claves son los nombres de los parámetros y los valores son los tipos:

```json
{
  "num_casos": "int",
  "error_rate": "float",
  "api_key": "string",
  "enable_cache": "bool"
}
```

Tipos soportados:
- `"int"`: Número entero
- `"float"`: Número decimal
- `"string"`: Texto
- `"bool"`: Booleano (true/false)

El frontend genera automáticamente campos de formulario basados en este schema cuando se crea una ejecución.

### Crear un Plugin Built-in (Desde Código)

Para agregar un plugin hardcodeado (requiere modificar código):

1. Crear clase que implemente `TestPlugin` en `backend/app/core/plugin.py` o archivo separado
2. Registrar en `PluginFactory._plugins`:

```python
# En backend/app/core/plugin.py
class PluginFactory:
    _plugins: Dict[str, type] = {
        "demo": DemoPlugin,
        "mi_plugin": MiPlugin,  # Agregar aquí
    }
```

**Nota**: Los plugins built-in no se pueden editar desde el frontend (como el plugin "demo").

### Gestión de Plugins

Desde la página de Plugins (`/plugins`) puedes:

- **Listar todos los plugins**: Ver todos los plugins disponibles (built-in y dinámicos)
- **Crear nuevo plugin**: Agregar plugins dinámicos
- **Editar plugin**: Modificar código, display_name o config_schema (solo plugins dinámicos)
- **Probar plugin**: Ejecutar una prueba básica para verificar que funciona
- **Eliminar plugin**: Eliminar plugins dinámicos (no se pueden eliminar built-in)

### Estados de Plugin

Los plugins pueden tener los siguientes estados:

- **`active`**: Plugin funcional y listo para usar
- **`error`**: Plugin tiene errores (código inválido, no compila, etc.)
- **`disabled`**: Plugin deshabilitado manualmente

Los plugins con estado `error` o `disabled` no pueden usarse para ejecutar runs.

## API Endpoints

### Ejecuciones (Runs)
- `POST /api/runs` - Crear nueva ejecución
- `GET /api/runs` - Listar ejecuciones (parámetros: `limit`, `offset`)
- `GET /api/runs/{run_id}` - Obtener ejecución
- `GET /api/runs/{run_id}/details` - Obtener detalles (parámetros: `filter` (all/mismatch/error), `limit`, `offset`)
- `POST /api/runs/{run_id}/details/{case_id}/comment` - Agregar comentario/tag/marcar revisado
- `GET /api/runs/{run_id}/export.csv` - Exportar CSV

### Plugins
- `GET /api/plugins` - Listar todos los plugins (built-in + dinámicos)
- `GET /api/plugins/{plugin_name}` - Obtener información de un plugin
- `POST /api/plugins` - Crear nuevo plugin dinámico
- `PUT /api/plugins/{plugin_name}` - Actualizar plugin dinámico
- `DELETE /api/plugins/{plugin_name}` - Eliminar plugin dinámico
- `POST /api/plugins/{plugin_name}/test` - Probar plugin

**Documentación interactiva**: Disponible en `http://localhost:8000/docs` (Swagger UI)

## Tests

Ejecutar tests:
```bash
cd backend
pytest
```

Tests incluidos:
- `test_demo_plugin.py`: Tests del DemoPlugin
- `test_plugin_factory.py`: Tests del PluginFactory
- `test_metrics.py`: Tests de cálculo de métricas (estructura preparada)

## Detener los Servicios

Para detener la base de datos:
```bash
docker compose down
```

Para detener y eliminar los volúmenes (borra los datos):
```bash
docker compose down -v
```

## Próximos Pasos

- [ ] Implementar ejecución asíncrona con background workers (Celery/RQ)
- [ ] Agregar más plugins (TradeIn, ECRM, OpenAI)
- [ ] Mejorar UI con gráficos y visualizaciones
- [ ] Agregar autenticación y autorización
- [ ] Implementar tests de integración end-to-end

## Licencia

MIT
