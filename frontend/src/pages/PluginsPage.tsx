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

  useEffect(() => {
    loadPlugins()
  }, [])

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
                placeholder={`def execute(case_data, config):
    # Tu código aquí
    return {
        "ok": True,
        "value": "resultado",
        "status": "success",
        "raw": None,
        "meta": {}
    }`}
              />
              {editingPlugin && (
                <small className="form-help">
                  Dejar vacío para no cambiar el código
                </small>
              )}
            </div>

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
                      <div className="error-message" title={plugin.error_message}>
                        ⚠️ {plugin.error_message.substring(0, 50)}
                        {plugin.error_message.length > 50 ? '...' : ''}
                      </div>
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

