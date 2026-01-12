## Propuesta simplificada: “Plugin” + Runner + Store

### Qué queda fijo (framework)

* `MassTestRunner`
* `ResultStore`
* DTOs simples (`Case`, `Pred`, `Compare`)

### Qué cambia por bot/dominio

* **Un solo objeto**: `TestPlugin`

---

## Diagrama de clases Mermaid (simple y usable)

```mermaid
classDiagram

class MassTestRunner {
  -plugin: TestPlugin
  -store: ResultStore
  +run(config): RunResult
}

class TestPlugin {
  <<interface>>
  +obtener_casos(config): Iterable~Case~
  +ejecutar_test(caso: Case, config): Pred
  +comparar_resultados(caso: Case, pred: Pred, config): Compare
}

class PluginFactory {
  +get(name: string): TestPlugin
  +set_db_session(db: Session)
  +test_plugin(name: string, db: Session): tuple[bool, str?]
  +register(name: string, plugin_class: type)
  -_load_plugin_from_code(code: string, name: string): TestPlugin
}

class ResultStore {
  <<interface>>
  +create_run(config): run_id
  +save_detail(run_id, caso: Case, pred: Pred, cmp: Compare)
  +compute_metrics(run_id): Metrics
  +close_run(run_id)
  +save_comment(run_id, case_id, comment, tag, reviewed)
}

class Case {
  +id: string
  +data: dict
}

class Pred {
  +ok: bool
  +value: string?
  +status: string
  +raw: string?
  +meta: dict
}

class Compare {
  +match: bool
  +truth: string?
  +pred: string?
  +reason: string
  +detail: dict
}

class RunResult {
  +run_id: string
  +metrics: Metrics
}

class Metrics {
  +accuracy: float
  +coverage: float
  +error_rate: float
  +confusion_matrix: dict?
}

class Plugin {
  +plugin_name: string (PK)
  +display_name: string
  +code: string
  +config_schema: dict
  +status: string
  +error_message: string?
  +created_at: datetime
  +updated_at: datetime
  +last_test_at: datetime?
}

MassTestRunner --> TestPlugin
MassTestRunner --> ResultStore
MassTestRunner --> PluginFactory
PluginFactory --> TestPlugin
PluginFactory --> Plugin
ResultStore --> Metrics
ResultStore --> Plugin
```

---

## Concreto TradeIn (sin ensuciar la abstracción)

Acá TradeIn implementa **un solo plugin**, y adentro hace lo que necesite (SQL, imágenes, assistant, etc.) sin forzar interfaces extra.

```mermaid
classDiagram

class TradeInPlugin {
  +obtener_casos(config): Iterable~Case~
  +ejecutar_test(caso: Case, config): Pred
  +comparar_resultados(caso: Case, pred: Pred, config): Compare
  -sql_query: string
  -conn: SqlConnection
  -storage: StorageProvider
  -assistant_id: string
}

class StorageProvider {
  <<interface>>
  +obtener_archivos(key): list
  +obtener_imagen(locator): bytes
}

class Case { +id: string +data: dict }
class Pred { +ok: bool +value: string? +status: string +raw: string? +meta: dict }
class Compare { +match: bool +truth: string? +pred: string? +reason: string +detail: dict }

TradeInPlugin --> StorageProvider
TradeInPlugin --> Case
TradeInPlugin --> Pred
TradeInPlugin --> Compare
```

> Nota: dentro de `Case.data` podés llevar `id_caso`, `nro_pedido`, `resultado_final`, `resultado_operador`, `tabulacion`, etc. **sin que el framework lo sepa**.

---

## ZenUML (Mermaid sequence) alineado a esta versión simple

```mermaid
sequenceDiagram
autonumber
actor Analista
participant Runner as MassTestRunner
participant Factory as PluginFactory
participant Plugin as TestPlugin
participant Store as ResultStore
participant UI as UI

Analista->>Runner: run(config{plugin_name,...})
Runner->>Factory: get(plugin_name)
Factory-->>Runner: plugin
Runner->>Store: create_run(config) -> run_id

Runner->>Plugin: obtener_casos(config)
Plugin-->>Runner: casos[]

loop caso in casos
  Runner->>Plugin: ejecutar_test(caso, config)
  Plugin-->>Runner: pred
  Runner->>Plugin: comparar_resultados(caso, pred, config)
  Plugin-->>Runner: cmp
  Runner->>Store: save_detail(run_id, caso, pred, cmp)
end

Runner->>Store: compute_metrics(run_id)
Store-->>Runner: metrics
Runner->>Store: close_run(run_id)
Runner-->>UI: publish(run_id)

Analista->>UI: comentar mismatch
UI->>Store: save_comment(...)
```

---

## Por qué esta abstracción es “la correcta” para vos

* **Solo 1 punto de extensión** (el Plugin) → menos boilerplate.
* Igual te permite tener **múltiples implementaciones** (TradeInPlugin, BotXPlugin, etc.).
* Te deja “probar múltiples diagramas” y lógicas cambiando `plugin_name`, sin rediseñar todo.
* Si mañana necesitás más fine-grain, podés **refactorizar internamente** el plugin a strategies, pero sin imponerlo a todo el sistema.
 