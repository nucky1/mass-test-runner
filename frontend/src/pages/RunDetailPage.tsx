import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService, RunSummary, RunDetail } from '../services/api'
import './RunDetailPage.css'

type TabType = 'summary' | 'mismatches' | 'all' | 'errors'

function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunSummary | null>(null)
  const [details, setDetails] = useState<RunDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [selectedCase, setSelectedCase] = useState<RunDetail | null>(null)
  const [commentForm, setCommentForm] = useState({
    comment: '',
    tag: '',
    reviewed: false,
  })

  useEffect(() => {
    if (runId) {
      loadRun()
      loadDetails()
    }
  }, [runId, activeTab])

  const loadRun = async () => {
    if (!runId) return
    try {
      const data = await apiService.getRun(runId)
      setRun(data)
    } catch (error) {
      console.error('Error loading run:', error)
      alert('Error al cargar run')
    }
  }

  const loadDetails = async () => {
    if (!runId) return
    try {
      setLoading(true)
      const filter =
        activeTab === 'summary' ? undefined : activeTab === 'all' ? 'all' : activeTab
      const data = await apiService.getRunDetails(runId, filter as any)
      setDetails(data)
    } catch (error) {
      console.error('Error loading details:', error)
      alert('Error al cargar detalles')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!runId) return
    try {
      const blob = await apiService.exportCSV(runId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `run_${runId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Error al exportar CSV')
    }
  }

  const handleSaveComment = async () => {
    if (!runId || !selectedCase) return
    try {
      await apiService.addComment(runId, selectedCase.case_id, commentForm)
      setSelectedCase(null)
      setCommentForm({ comment: '', tag: '', reviewed: false })
      loadDetails()
      loadRun()
    } catch (error) {
      console.error('Error saving comment:', error)
      alert('Error al guardar comentario')
    }
  }

  const openCaseDetail = (detail: RunDetail) => {
    setSelectedCase(detail)
    setCommentForm({
      comment: detail.comment || '',
      tag: detail.tag || '',
      reviewed: detail.reviewed,
    })
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  if (!run) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <div className="run-detail-page">
      <div className="detail-header">
        <button className="btn btn-sm" onClick={() => navigate('/')}>
          ← Volver
        </button>
        <h1>Run: {run.run_id.substring(0, 8)}...</h1>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          Exportar CSV
        </button>
      </div>

      <div className="metrics-panel">
        <div className="metric">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">{formatPercent(run.accuracy)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Coverage</div>
          <div className="metric-value">{formatPercent(run.coverage)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Error Rate</div>
          <div className="metric-value">{formatPercent(run.error_rate)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total Casos</div>
          <div className="metric-value">{run.total_cases}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Mismatches</div>
          <div className="metric-value">{run.mismatches}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Errores</div>
          <div className="metric-value">{run.errors}</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Resumen
        </button>
        <button
          className={`tab ${activeTab === 'mismatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('mismatches')}
        >
          Mismatches ({run.mismatches})
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Todos ({run.total_cases})
        </button>
        <button
          className={`tab ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          Errores ({run.errors})
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="details-table-container">
          <table className="details-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Truth</th>
                <th>Pred</th>
                <th>Match</th>
                <th>Status</th>
                <th>Revisado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail) => (
                <tr key={detail.case_id}>
                  <td className="case-id">{detail.case_id}</td>
                  <td>{detail.truth || '-'}</td>
                  <td>{detail.pred_value || '-'}</td>
                  <td>
                    <span className={detail.match ? 'match-yes' : 'match-no'}>
                      {detail.match ? '✓' : '✗'}
                    </span>
                  </td>
                  <td>
                    <span className={`status status-${detail.pred_status}`}>
                      {detail.pred_status}
                    </span>
                  </td>
                  <td>{detail.reviewed ? '✓' : '-'}</td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => openCaseDetail(detail)}
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

      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del Caso: {selectedCase.case_id}</h2>
              <button
                className="btn-close"
                onClick={() => setSelectedCase(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>Datos del Caso</h3>
                <pre>{JSON.stringify(selectedCase.case_data, null, 2)}</pre>
              </div>
              <div className="detail-section">
                <h3>Comparación</h3>
                <div className="comparison">
                  <div>
                    <strong>Truth:</strong> {selectedCase.truth || '-'}
                  </div>
                  <div>
                    <strong>Pred:</strong> {selectedCase.pred_value || '-'}
                  </div>
                  <div>
                    <strong>Match:</strong>{' '}
                    <span
                      className={
                        selectedCase.match ? 'match-yes' : 'match-no'
                      }
                    >
                      {selectedCase.match ? 'Sí' : 'No'}
                    </span>
                  </div>
                  {selectedCase.mismatch_reason && (
                    <div>
                      <strong>Razón:</strong> {selectedCase.mismatch_reason}
                    </div>
                  )}
                </div>
              </div>
              {selectedCase.raw && (
                <div className="detail-section">
                  <h3>Raw Response</h3>
                  <pre>{selectedCase.raw}</pre>
                </div>
              )}
              {Object.keys(selectedCase.meta).length > 0 && (
                <div className="detail-section">
                  <h3>Metadata</h3>
                  <pre>{JSON.stringify(selectedCase.meta, null, 2)}</pre>
                </div>
              )}
              <div className="detail-section">
                <h3>Comentarios</h3>
                <div className="comment-form">
                  <div className="form-group">
                    <label>Comentario:</label>
                    <textarea
                      value={commentForm.comment}
                      onChange={(e) =>
                        setCommentForm({ ...commentForm, comment: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tag:</label>
                    <input
                      type="text"
                      value={commentForm.tag}
                      onChange={(e) =>
                        setCommentForm({ ...commentForm, tag: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={commentForm.reviewed}
                        onChange={(e) =>
                          setCommentForm({
                            ...commentForm,
                            reviewed: e.target.checked,
                          })
                        }
                      />
                      Revisado
                    </label>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveComment}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RunDetailPage
