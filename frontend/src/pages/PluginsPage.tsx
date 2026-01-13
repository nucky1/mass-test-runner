import { useState, useEffect } from 'react'
import { apiService, PluginInfo, PluginCreate, PluginUpdate } from '../services/api'
import './PluginsPage.css'

function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<PluginInfo | null>(null)
  const [formData, setFormData] = useState<PluginCreate>({
    plugin_name: '',
    display_name: '',
    code: '',
    config_schema: {},
  })
  const [configSchemaJson, setConfigSchemaJson] = useState('{}')
  const [saving, setSaving] = useState(false)
  const [testingPlugin, setTestingPlugin] = useState<string | null>(null)
  const [pluginDeps, setPluginDeps] = useState<{
    allowed: string[]
    builtin: string[]
    note: string
  } | null>(null)
  const [showBuiltin, setShowBuiltin] = useState(false)

  useEffect(() => {
    loadPlugins()
    loadPluginDeps()
  }, [])

  const loadPluginDeps = async () => {
    try {
      const deps = await apiService.getPluginDeps()
      setPluginDeps(deps)
    } catch (error) {
      console.error('Error loading plugin deps:', error)
      // Fallback a datos hardcodeados mínimos
      setPluginDeps({
        allowed: ['pandas', 'openpyxl', 'msal', 'requests', 'sqlalchemy', 'pymysql', 'psycopg2', 'pyodbc'],
        builtin: ['csv', 'json', 'sqlite3'],
        note: 'Si necesitás otra librería (no builtin y no listada), instalala en el proyecto antes de importarla.'
      })
    }
  }

  const loadPlugins = async () => {
    try {
      setLoading(true)
      const data = await apiService.listPlugins()
      setPlugins(data)
    } catch (error) {
      console.error('Error loading plugins:', error)
      alert('Error al cargar plugins')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setEditingPlugin(null)
    setFormData({
      plugin_name: '',
      display_name: '',
      code: '',
      config_schema: {},
    })
    setConfigSchemaJson('{}')
    setShowForm(true)
  }

  const handleEditClick = (plugin: PluginInfo) => {
    if (plugin.plugin_name === 'demo') {
      alert('No se puede editar el plugin demo')
      return
    }
    setEditingPlugin(plugin)
    setFormData({
      plugin_name: plugin.plugin_name,
      display_name: plugin.display_name,
      code: '',
      config_schema: plugin.config_schema,
    })
    setConfigSchemaJson(JSON.stringify(plugin.config_schema, null, 2))
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingPlugin(null)
    setFormData({
      plugin_name: '',
      display_name: '',
      code: '',
      config_schema: {},
    })
    setConfigSchemaJson('{}')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Validar JSON del config_schema
      let parsedConfigSchema = {}
      try {
        parsedConfigSchema = JSON.parse(configSchemaJson)
      } catch (error) {
        alert('El config_schema no es un JSON válido')
        return
      }

      setSaving(true)
      if (editingPlugin) {
        // Actualizar plugin
        const updateData: PluginUpdate = {
          display_name: formData.display_name,
          code: formData.code || undefined,
          config_schema: parsedConfigSchema,
        }
        await apiService.updatePlugin(editingPlugin.plugin_name, updateData)
      } else {
        // Crear plugin
        if (!formData.code) {
          alert('El código del plugin es requerido')
          return
        }
        const createData: PluginCreate = {
          plugin_name: formData.plugin_name,
          display_name: formData.display_name,
          code: formData.code,
          config_schema: parsedConfigSchema,
        }
        await apiService.createPlugin(createData)
      }
      setShowForm(false)
      setEditingPlugin(null)
      await loadPlugins()
    } catch (error: any) {
      console.error('Error saving plugin:', error)
      alert(`Error al guardar plugin: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pluginName: string) => {
    if (pluginName === 'demo') {
      alert('No se puede eliminar el plugin demo')
      return
    }
    if (!confirm(`¿Estás seguro de eliminar el plugin "${pluginName}"?`)) {
      return
    }
    try {
      await apiService.deletePlugin(pluginName)
      await loadPlugins()
    } catch (error: any) {
      console.error('Error deleting plugin:', error)
      alert(`Error al eliminar plugin: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleTest = async (pluginName: string) => {
    try {
      setTestingPlugin(pluginName)
      const result = await apiService.testPlugin(pluginName)
      if (result.success) {
        alert('Plugin probado exitosamente')
      } else {
        alert(`Error al probar plugin: ${result.message}`)
      }
      await loadPlugins()
    } catch (error: any) {
      console.error('Error testing plugin:', error)
      alert(`Error al probar plugin: ${error.response?.data?.detail || error.message}`)
    } finally {
      setTestingPlugin(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES')
  }

  return (
    <div className="plugins-page">
      <div className="page-header">
        <h1>Plugins</h1>
        <button className="btn btn-primary" onClick={handleCreateClick}>
          Nuevo Plugin
        </button>
      </div>

      {showForm && (
        <div className="create-form">
          <h2>{editingPlugin ? 'Editar Plugin' : 'Crear Nuevo Plugin'}</h2>

          {/* Bloque informativo de dependencias */}
          <div className="deps-info">
            <div className="deps-info-header">
              <strong>📦 Librerías Disponibles para Plugins</strong>
            </div>
            <div className="deps-info-content">
              <p>
                Este entorno soporta por defecto: <strong>SharePoint</strong> (msal/requests),{' '}
                <strong>CSV/Excel</strong> (pandas/openpyxl), <strong>DB</strong> (sqlalchemy + drivers mysql/postgres/sqlserver),{' '}
                <strong>sqlite</strong>.
              </p>
              {pluginDeps && (
                <>
                  <div className="deps-allowed">
                    <strong>Paquetes permitidos:</strong>{' '}
                    {pluginDeps.allowed.join(', ')}
                  </div>
                  <div className="deps-builtin">
                    <button
                      type="button"
                      className="deps-toggle"
                      onClick={() => setShowBuiltin(!showBuiltin)}
                    >
                      {showBuiltin ? '▼' : '▶'} Módulos builtin de Python ({pluginDeps.builtin.length})
                    </button>
                    {showBuiltin && (
                      <div className="deps-builtin-list">
                        {pluginDeps.builtin.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="deps-note">
                    <small>{pluginDeps.note}</small>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Bloque informativo de contrato del plugin */}
          <div className="deps-info" style={{ marginTop: 12 }}>
            <div className="deps-info-header">
              <strong>🧩 Contrato del Plugin (clases ya disponibles)</strong>
            </div>
            <div className="deps-info-content">
              <p>
                Al ejecutar un plugin dinámico, el sistema <strong>inyecta automáticamente</strong>{' '}
                <code>TestPlugin</code>, <code>Case</code>, <code>Pred</code> y <code>Compare</code>.
                <br />
                <strong>No hace falta importarlas</strong> en el código del plugin.
              </p>

              <div className="deps-allowed" style={{ marginTop: 10 }}>
                <strong>Tu clase debe heredar de:</strong>{' '}
                <code>TestPlugin</code> y definir estos métodos:
                <ul style={{ marginTop: 8 }}>
                  <li><code>obtener_casos(config) -&gt; Iterable[Case]</code></li>
                  <li><code>ejecutar_test(caso, config) -&gt; Pred</code></li>
                  <li><code>comparar_resultados(caso, pred, config) -&gt; Compare</code></li>
                </ul>
              </div>

              <div className="deps-builtin" style={{ marginTop: 10 }}>
                <strong>Definiciones (simplificadas)</strong>
                <pre className="deps-builtin-list" style={{ whiteSpace: 'pre-wrap' }}>
                  {`class Case:
  id: str
  data: dict

class Pred:
  ok: bool
  value: Any
  status: str
  raw: Any
  meta: dict

class Compare:
  match: bool
  truth: Any
  pred: Any
  reason: str
  detail: dict

class TestPlugin:
  def obtener_casos(self, config) -> Iterable[Case]: ...
  def ejecutar_test(self, caso: Case, config) -> Pred: ...
  def comparar_resultados(self, caso: Case, pred: Pred, config) -> Compare: ...`}
                </pre>
                <small>
                  Consejo: guardá el valor esperado (truth) dentro de <code>caso.data</code> (ej: <code>caso.data["label"]</code>)
                  y comparalo contra <code>pred.value</code>.
                </small>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nombre del Plugin (ID):</label>
              <input
                type="text"
                value={formData.plugin_name}
                onChange={(e) => setFormData({ ...formData, plugin_name: e.target.value })}
                disabled={!!editingPlugin}
                required
                placeholder="ej: mi_plugin"
              />
              {editingPlugin && (
                <small className="form-help">No se puede cambiar el nombre del plugin</small>
              )}
            </div>

            <div className="form-group">
              <label>Nombre para Mostrar:</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                required
                placeholder="ej: Mi Plugin"
              />
            </div>

            <div className="form-group">
              <label>Código del Plugin:</label>
              <textarea
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required={!editingPlugin}
                rows={15}
                placeholder={`# Nota:
                # - NO hace falta importar TestPlugin, Case, Pred, Compare.
                #   El sistema los inyecta automáticamente antes de ejecutar tu código.
                # - Si importás módulos, deben estar permitidos por el sandbox.
                
                class MyPlugin(TestPlugin):
                    \"\"\"Ejemplo mínimo de plugin.\"\"\"
                
                    def obtener_casos(self, config):
                        # Debe devolver Iterable[Case]
                        # Guardá el "truth" esperado dentro de caso.data (ej: caso.data["label"])
                        return [
                            Case(
                                id="case_1",
                                data={
                                    "input_text": "hola mundo",
                                    "label": "T1"
                                }
                            )
                        ]
                
                    def ejecutar_test(self, caso, config):
                        # Debe devolver Pred
                        # ok=False si hubo error; value puede ser None si no hay predicción
                        predicted = "T1"  # TODO: tu lógica real
                        return Pred(
                            ok=True,
                            value=predicted,
                            status="success",
                            raw={"prediction": predicted},
                            meta={"model": "demo-like"}
                        )
                
                    def comparar_resultados(self, caso, pred, config):
                        # Debe devolver Compare
                        truth = caso.data.get("label")
                
                        if not pred.ok:
                            return Compare(
                                match=False,
                                truth=truth,
                                pred=None,
                                reason="Error en ejecución",
                                detail={"status": pred.status, "meta": pred.meta}
                            )
                
                        match = (truth == pred.value)
                        return Compare(
                            match=match,
                            truth=truth,
                            pred=pred.value,
                            reason="Match" if match else f"Truth: {truth} / Pred: {pred.value}",
                            detail={"case_id": caso.id}
                        )
    }`}
              />
              {editingPlugin && (
                <small className="form-help">
                  Dejar vacío para no cambiar el código
                </small>
              )}
            </div>
            <small className="form-help">
              El código debe definir una clase que herede de <code>TestPlugin</code> y retorne
              objetos <code>Case</code>, <code>Pred</code> y <code>Compare</code> (no diccionarios).
            </small>

            <div className="form-group">
              <label>Config Schema (JSON):</label>
              <textarea
                value={configSchemaJson}
                onChange={(e) => setConfigSchemaJson(e.target.value)}
                rows={8}
                placeholder='{"param1": "string", "param2": "int"}'
              />
              <small className="form-help">
                Define los parámetros de configuración del plugin (ej: {"{"} "param1": "string", "param2": "int" {"}"})
              </small>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editingPlugin ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : plugins.length === 0 ? (
        <div className="empty-state">No hay plugins aún</div>
      ) : (
        <div className="plugins-table-container">
          <table className="plugins-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Display Name</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Última Actualización</th>
                <th>Config Schema</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => (
                <tr key={plugin.plugin_name}>
                  <td className="plugin-name">
                    <strong>{plugin.plugin_name}</strong>
                  </td>
                  <td>{plugin.display_name}</td>
                  <td>
                    <span className={`status status-${plugin.status}`}>
                      {plugin.status}
                    </span>
                    {plugin.error_message && (
                      <>
                        {(plugin.error_message.includes('Missing dependency') ||
                          plugin.error_message.includes('Dependency not allowed')) && (
                            <span className="dependency-error-badge">
                              {plugin.error_message.includes('Missing dependency')
                                ? 'Dependencia faltante'
                                : 'Dependencia no permitida'}
                            </span>
                          )}
                        <div className="error-message" title={plugin.error_message}>
                          ⚠️ {plugin.error_message.substring(0, 50)}
                          {plugin.error_message.length > 50 ? '...' : ''}
                        </div>
                      </>
                    )}
                  </td>
                  <td>{formatDate(plugin.created_at)}</td>
                  <td>{formatDate(plugin.updated_at)}</td>
                  <td>
                    <code className="config-schema">
                      {JSON.stringify(plugin.config_schema)}
                    </code>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEditClick(plugin)}
                        disabled={plugin.plugin_name === 'demo'}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleTest(plugin.plugin_name)}
                        disabled={testingPlugin === plugin.plugin_name}
                      >
                        {testingPlugin === plugin.plugin_name ? 'Probando...' : 'Probar'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(plugin.plugin_name)}
                        disabled={plugin.plugin_name === 'demo'}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PluginsPage

