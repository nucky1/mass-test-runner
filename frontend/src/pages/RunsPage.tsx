import { useState, useEffect, useRef } from 'react'
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

  // Ref para input file oculto (Importar JSON)
  const importFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadRuns()
    loadPlugins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling para runs en ejecución
  useEffect(() => {
    const hasRunningRuns = runs.some(run => run.status === 'running')
    if (!hasRunningRuns) return

    const interval = setInterval(() => {
      loadRuns()
    }, 2000) // Actualizar cada 2 segundos

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs])

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
        const defaultPlugin =
          data.find((p) => p.plugin_name === formData.plugin_name) || data[0]
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
      setFormData({
        plugin_name: pluginName,
        config: {},
      })
    }
  }

  const handleConfigChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }))
  }

  // --- JSON import/export helpers ---

  const castValueByType = (type: string, value: any) => {
    if (value === null || value === undefined) return value

    switch (type) {
      case 'int': {
        if (typeof value === 'number') return Math.trunc(value)
        const n = parseInt(String(value), 10)
        return Number.isFinite(n) ? n : ''
      }
      case 'float': {
        if (typeof value === 'number') return value
        const n = parseFloat(String(value))
        return Number.isFinite(n) ? n : ''
      }
      case 'bool': {
        if (typeof value === 'boolean') return value
        const s = String(value).toLowerCase().trim()
        return s === 'true' || s === '1' || s === 'yes' || s === 'y'
      }
      default:
        // string u otros
        return String(value)
    }
  }

  const applyJsonConfig = (jsonConfig: Record<string, any>) => {
    const schema = selectedPlugin?.config_schema || {}
    const nextConfig: Record<string, any> = { ...(formData.config as Record<string, any>) }

    // Si hay schema, casteamos keys conocidas y mantenemos extras
    if (schema && Object.keys(schema).length > 0) {
      for (const [key, type] of Object.entries(schema)) {
        if (key in jsonConfig) {
          nextConfig[key] = castValueByType(type as string, jsonConfig[key])
        }
      }
      // Extras (keys que vienen en JSON pero no están en el schema)
      for (const [key, val] of Object.entries(jsonConfig)) {
        if (!(key in schema)) {
          nextConfig[key] = val
        }
      }
    } else {
      Object.assign(nextConfig, jsonConfig)
    }

    setFormData((prev) => ({
      ...prev,
      config: nextConfig,
    }))
  }

  const handleJsonUpload = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert('El JSON debe ser un objeto (ej: {"param":"valor"})')
        return
      }

      applyJsonConfig(parsed as Record<string, any>)
      alert('Configuración cargada desde JSON ✅')
    } catch (err: any) {
      console.error('Error parsing JSON config:', err)
      alert(`No se pudo leer el JSON: ${err?.message || 'Error desconocido'}`)
    }
  }

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(formData.config, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.plugin_name}_config.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderConfigField = (key: string, type: string) => {
    const value = (formData.config as any)[key] ?? (type === 'bool' ? false : '')
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
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
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
                {/* Header con título + botones en la misma línea */}
                <div className="config-header-row">
                  <h3>Configuración</h3>

                  <div className="config-actions">
                    {/* input file oculto */}
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".json,application/json"
                      className="config-file-input-hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleJsonUpload(f)
                        // permitir re-subir el mismo archivo
                        e.currentTarget.value = ''
                      }}
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      onClick={() => importFileRef.current?.click()}
                      title="Importar configuración desde un JSON"
                    >
                      Importar JSON
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      onClick={handleExportConfig}
                      title="Exportar la configuración actual a un JSON"
                    >
                      Exportar JSON
                    </button>
                  </div>
                </div>

                <small className="form-help">
                  Podés importar un archivo JSON para completar automáticamente el formulario.
                  Las claves se castearán según el <code>config_schema</code> del plugin.
                </small>

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
                <th>Progreso</th>
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
                    <span className={`status status-${run.status}`}>{run.status}</span>
                  </td>
                  <td>{formatDate(run.created_at)}</td>
                  <td>
                    {run.status === 'running' && run.processed_cases !== null && run.processed_cases !== undefined ? (
                      <div>
                        <div>{run.processed_cases} / {run.total_cases || '?'}</div>
                        {run.total_cases && run.total_cases > 0 && (
                          <div className="progress-text">
                            {((run.processed_cases / run.total_cases) * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>{run.total_cases}</div>
                    )}
                  </td>
                  <td>{formatPercent(run.accuracy)}</td>
                  <td>{formatPercent(run.coverage)}</td>
                  <td>{formatPercent(run.error_rate)}</td>
                  <td>{run.mismatches}</td>
                  <td>{run.errors}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => navigate(`/runs/${run.run_id}`)}>
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
