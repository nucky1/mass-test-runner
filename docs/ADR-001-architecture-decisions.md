# ADR-001: Decisiones de Arquitectura

## Contexto

Se necesita construir un sistema de testing masivo que permita ejecutar tests sobre diferentes plugins (TradeIn, ECRM, OpenAI, etc.) de forma extensible y mantener resultados persistentes.

## Decisiones

### 1. Base de Datos: PostgreSQL con SQLAlchemy

**Decisión**: Usar PostgreSQL como base de datos relacional con SQLAlchemy como ORM.

**Razones**:
- Soporte nativo para JSONB para campos flexibles (`raw`, `meta`, `config`)
- Escalabilidad y robustez para producción
- Alembic para migraciones versionadas
- SQLAlchemy permite abstracción y testing más fácil

**Alternativas consideradas**:
- SQLite: Más simple pero menos robusto para producción
- MongoDB: No necesario dado que tenemos estructura relacional clara

### 2. Backend: FastAPI

**Decisión**: Usar FastAPI como framework web.

**Razones**:
- Validación automática con Pydantic
- Documentación automática (OpenAPI/Swagger)
- Performance excelente (async nativo)
- Type hints integrados

### 3. Frontend: React + Vite + TypeScript

**Decisión**: Usar React con Vite y TypeScript.

**Razones**:
- Vite ofrece desarrollo rápido y build eficiente
- TypeScript para type safety
- React es estándar de la industria
- Separación clara entre frontend y backend

### 4. Ejecución: Síncrona inicialmente, preparado para async

**Decisión**: Ejecución síncrona en el endpoint POST /api/runs, pero con estructura preparada para background jobs.

**Razones**:
- Simplicidad inicial para validar el pipeline
- La estructura de `MassTestRunner` y `ResultStore` permite cambiar a Celery/RQ/Temporal sin modificar la lógica core
- Para runs pequeños (<1000 casos) es aceptable

**Próximos pasos**:
- Cuando se necesite escalar, mover la ejecución a un worker background
- Mantener la misma interfaz de `MassTestRunner.run()`

### 5. Plugin System: Interfaz simple con 3 métodos

**Decisión**: Un solo punto de extensión (`TestPlugin`) con 3 métodos claros.

**Razones**:
- Simplicidad: menos abstracciones = menos complejidad
- Suficiente para todos los casos de uso conocidos
- Fácil de entender y mantener
- `PluginFactory` permite registro dinámico de plugins

**Estructura**:
```python
class TestPlugin:
    obtener_casos(config) -> Iterable[Case]
    ejecutar_test(caso, config) -> Pred
    comparar_resultados(caso, pred, config) -> Compare
```

### 6. Persistencia: JSONB para campos flexibles

**Decisión**: Usar JSONB en PostgreSQL para `raw`, `meta`, `config`, `case_data`, `compare_detail`.

**Razones**:
- Flexibilidad: cada plugin puede tener estructura diferente sin cambiar schema
- Consultas JSONB eficientes en PostgreSQL
- No rigidiza el modelo de datos
- Permite evolución sin migraciones complejas

### 7. Métricas: Cálculo en tiempo real

**Decisión**: Calcular métricas al cerrar el run, guardarlas en la tabla `runs`.

**Razones**:
- Performance: evitar cálculos repetidos
- Consistencia: métricas siempre actualizadas
- Fácil de consultar desde frontend

**Métricas implementadas**:
- `accuracy`: matches / evaluados
- `coverage`: pred.ok && pred.value != null / total
- `error_rate`: pred.ok == False / total
- `confusion_matrix`: matriz de confusión (soporta multiclass)

### 8. Frontend: Routing con React Router

**Decisión**: Usar React Router para navegación entre páginas.

**Razones**:
- Estándar de la industria
- URLs amigables (/runs/:runId)
- Fácil de extender

## Consecuencias

### Positivas
- Código modular y extensible
- Fácil agregar nuevos plugins
- Base sólida para escalar
- Type safety en frontend y backend

### Negativas
- Requiere PostgreSQL (no SQLite para producción)
- Ejecución síncrona puede bloquear para runs grandes (mitigado con estructura preparada para async)

## Estado

Aceptado - Implementado en v1.0
