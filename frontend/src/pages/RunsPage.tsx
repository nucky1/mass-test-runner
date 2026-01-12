import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService, RunSummary, RunConfig, PluginInfo } from '../services/api'
import './RunsPage.css'

function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<RunConfig>({
    plugin_name: 'demo',
    config: {},
  })
  const navigate = useNavigate()

  useEffect(() => {
    loadRuns()
    loadPlugins()
  }, [])

  const loadRuns = async () => {
    try {
      setLoading(true)
      const data = await apiService.listRuns()
      setRuns(data)
    } catch (error) {
      console.error('Error loading runs:', error)
      alert('Error al cargar runs')
    } finally {
      setLoading(false)
    }
  }

  const loadPlugins = async () => {
    try {
      const data = await apiService.listPlugins()
      setPlugins(data)
      // Si hay plugins, seleccionar el primero por defecto y actualizar selectedPlugin
      if (data.length > 0) {
        const defaultPlugin = data.find((p) => p.plugin_name === formData.plugin_name) || data[0]
        setSelectedPlugin(defaultPlugin)
        if (formData.plugin_name !== defaultPlugin.plugin_name) {
          setFormData({
            plugin_name: defaultPlugin.plugin_name,
            config: {},
          })
        }
      }
    } catch (error) {
      console.error('Error loading plugins:', error)
      alert('Error al cargar plugins')
    }
  }

  const handlePluginChange = (pluginName: string) => {
    const plugin = plugins.find((p) => p.plugin_name === pluginName)
    if (plugin) {
      setSelectedPlugin(plugin)
      // Inicializar config vacío
      const newConfig: Record<string, any> = {}
      setFormData({
        plugin_name: pluginName,
        config: newConfig,
      })
    }
  }

  const handleConfigChange = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value,
      },
    })
  }

  const renderConfigField = (key: string, type: string) => {
    const value = formData.config[key] ?? (type === 'bool' ? false : '')
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

    if (type === 'int') {
      return (
        <div key={key} className="form-group">
          <label>{label}:</label>
          <input
            type="number"
            value={value === '' || value === undefined ? '' : value}
            onChange={(e) => {
              const val = e.target.value
              handleConfigChange(key, val === '' ? '' : parseInt(val, 10) || 0)
            }}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        </div>
      )
    } else if (type === 'float') {
      return (
        <div key={key} className="form-group">
          <label>{label}:</label>
          <input
            type="number"
            step="0.01"
            value={value === '' || value === undefined ? '' : value}
            onChange={(e) => {
              const val = e.target.value
              handleConfigChange(key, val === '' ? '' : parseFloat(val) || 0)
            }}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        </div>
      )
    } else if (type === 'bool') {
      return (
        <div key={key} className="form-group">
          <label>
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => handleConfigChange(key, e.target.checked)}
            />
            {label}
          </label>
        </div>
      )
    } else {
      // string u otros tipos
      return (
        <div key={key} className="form-group">
          <label>{label}:</label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleConfigChange(key, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        </div>
      )
    }
  }

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreating(true)
      const result = await apiService.createRun(formData)
      setShowForm(false)
      // Redirigir al detalle del run creado
      navigate(`/runs/${result.run_id}`)
    } catch (error: any) {
      console.error('Error creating run:', error)
      alert(`Error al crear run: ${error.response?.data?.detail || error.message}`)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES')
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="runs-page">
      <div className="page-header">
        <h1>Ejecuciones</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nueva Ejecución'}
        </button>
      </div>

      {showForm && (
        <div className="create-form">
          <h2>Crear Nueva Ejecución</h2>
          <form onSubmit={handleCreateRun}>
            <div className="form-group">
              <label>Plugin:</label>
              <select
                value={formData.plugin_name}
                onChange={(e) => handlePluginChange(e.target.value)}
                required
              >
                {plugins.map((plugin) => (
                  <option key={plugin.plugin_name} value={plugin.plugin_name}>
                    {plugin.display_name} ({plugin.plugin_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedPlugin && Object.keys(selectedPlugin.config_schema).length > 0 && (
              <div className="config-section">
                <h3>Configuración</h3>
                {Object.entries(selectedPlugin.config_schema).map(([key, type]) =>
                  renderConfigField(key, type as string)
                )}
              </div>
            )}

            {selectedPlugin && Object.keys(selectedPlugin.config_schema).length === 0 && (
              <div className="config-section">
                <p className="no-config">Este plugin no requiere configuración</p>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creando...' : 'Crear Ejecución'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : runs.length === 0 ? (
        <div className="empty-state">No hay ejecuciones aún</div>
      ) : (
        <div className="runs-table-container">
          <table className="runs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Plugin</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Casos</th>
                <th>Accuracy</th>
                <th>Coverage</th>
                <th>Error Rate</th>
                <th>Mismatches</th>
                <th>Errores</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id}>
                  <td className="run-id">{run.run_id.substring(0, 8)}...</td>
                  <td>{run.plugin_name}</td>
                  <td>
                    <span className={`status status-${run.status}`}>
                      {run.status}
                    </span>
                  </td>
                  <td>{formatDate(run.created_at)}</td>
                  <td>{run.total_cases}</td>
                  <td>{formatPercent(run.accuracy)}</td>
                  <td>{formatPercent(run.coverage)}</td>
                  <td>{formatPercent(run.error_rate)}</td>
                  <td>{run.mismatches}</td>
                  <td>{run.errors}</td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => navigate(`/runs/${run.run_id}`)}
                    >
                      Ver
                    </button>
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

export default RunsPage
