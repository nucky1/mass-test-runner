import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface RunConfig {
  plugin_name: string
  config: Record<string, any>
}

export interface RunSummary {
  run_id: string
  plugin_name: string
  status: string
  created_at: string
  accuracy: number | null
  coverage: number | null
  error_rate: number | null
  total_cases: number
  mismatches: number
  errors: number
  processed_cases?: number | null
}

export interface RunProgress {
  run_id: string
  status: string
  total_cases: number | null
  processed_cases: number
  progress_percent: number | null
}

export interface RunDetail {
  case_id: string
  case_data: Record<string, any>
  truth: string | null
  pred_value: string | null
  pred_ok: boolean
  pred_status: string
  match: boolean
  mismatch_reason: string | null
  raw: string | null
  meta: Record<string, any>
  comment: string | null
  tag: string | null
  reviewed: boolean
}

export interface CommentRequest {
  comment?: string | null
  tag?: string | null
  reviewed?: boolean
}

export interface PluginCreate {
  plugin_name: string
  display_name: string
  code: string
  config_schema: Record<string, any>
}

export interface PluginUpdate {
  display_name?: string | null
  code?: string | null
  config_schema?: Record<string, any> | null
  status?: string | null
}

export interface PluginInfo {
  plugin_name: string
  display_name: string
  status: string
  error_message: string | null
  config_schema: Record<string, any>
  created_at: string
  updated_at: string
  last_test_at: string | null
}

export const apiService = {
  // Crear un nuevo run (ejecuta en background)
  createRun: async (config: RunConfig): Promise<{ run_id: string; status: string; message: string }> => {
    const response = await api.post('/api/runs', config)
    return response.data
  },

  // Obtener progreso de un run
  getRunProgress: async (runId: string): Promise<RunProgress> => {
    const response = await api.get(`/api/runs/${runId}/progress`)
    return response.data
  },

  // Listar runs
  listRuns: async (limit = 100, offset = 0): Promise<RunSummary[]> => {
    const response = await api.get('/api/runs', {
      params: { limit, offset },
    })
    return response.data
  },

  // Obtener un run
  getRun: async (runId: string): Promise<RunSummary> => {
    const response = await api.get(`/api/runs/${runId}`)
    return response.data
  },

  // Obtener detalles de un run
  getRunDetails: async (
    runId: string,
    filter?: 'mismatch' | 'all' | 'error',
    limit = 100,
    offset = 0
  ): Promise<RunDetail[]> => {
    const response = await api.get(`/api/runs/${runId}/details`, {
      params: { filter, limit, offset },
    })
    return response.data
  },

  // Agregar comentario
  addComment: async (
    runId: string,
    caseId: string,
    commentReq: CommentRequest
  ) => {
    const response = await api.post(
      `/api/runs/${runId}/details/${caseId}/comment`,
      commentReq
    )
    return response.data
  },

  // Exportar CSV
  exportCSV: async (runId: string): Promise<Blob> => {
    const response = await api.get(`/api/runs/${runId}/export.csv`, {
      responseType: 'blob',
    })
    return response.data
  },

  // ===== PLUGINS =====
  // Listar plugins
  listPlugins: async (): Promise<PluginInfo[]> => {
    const response = await api.get('/api/plugins')
    console.log(response.data)
    return response.data
  },

  // Obtener un plugin
  getPlugin: async (pluginName: string): Promise<PluginInfo> => {
    const response = await api.get(`/api/plugins/${pluginName}`)
    return response.data
  },

  // Crear plugin
  createPlugin: async (pluginData: PluginCreate): Promise<PluginInfo> => {
    const response = await api.post('/api/plugins', pluginData)
    return response.data
  },

  // Actualizar plugin
  updatePlugin: async (pluginName: string, pluginData: PluginUpdate): Promise<PluginInfo> => {
    const response = await api.put(`/api/plugins/${pluginName}`, pluginData)
    return response.data
  },

  // Eliminar plugin
  deletePlugin: async (pluginName: string): Promise<void> => {
    await api.delete(`/api/plugins/${pluginName}`)
  },

  // Probar plugin
  testPlugin: async (pluginName: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/api/plugins/${pluginName}/test`)
    return response.data
  },

  // Obtener dependencias permitidas
  getPluginDeps: async (): Promise<{
    allowed: string[]
    builtin: string[]
    note: string
  }> => {
    const response = await api.get('/api/plugins/deps')
    return response.data
  },
}

export default api
