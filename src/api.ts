export interface GroupResult {
  groupId: string
  evaluationCount: number
  averageCents: number | null
}

export interface EvaluationDetail {
  id: string
  evaluatorName: string
  ratings: number[]
  comments: string[]
  generalComment: string
  totalCents: number
  createdAt: string
}

export interface GroupDetail extends GroupResult {
  evaluations: EvaluationDetail[]
}

export interface AdminEvaluation {
  id: string
  evaluatorName: string
  groupId: string
  totalCents: number
  createdAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    if (import.meta.env.DEV) {
      throw new Error('No se pudo conectar con el servicio local. Inicia la app con npm run dev para levantar también el Worker.')
    }
    throw new Error('No se pudo conectar con el servicio. Revisa tu conexión e intenta de nuevo.')
  }
  let data: { error?: string } & T
  try {
    data = await response.json() as { error?: string } & T
  } catch {
    if (import.meta.env.DEV && !response.ok) {
      throw new Error('El Worker local no respondió. Inicia la app con npm run dev y revisa la terminal del Worker.')
    }
    throw new Error('El servicio devolvió una respuesta inesperada.')
  }
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.')
  return data
}

export function submitEvaluation(payload: { name: string; groupId: string; ratings: number[]; comments: string[]; generalComment: string }) {
  return request<{ id: string; totalCents: number }>('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getResults() {
  return request<{ groups: GroupResult[] }>('/api/results')
}

export function getGroupDetail(groupId: string) {
  return request<GroupDetail>(`/api/results/${encodeURIComponent(groupId)}`)
}

function adminHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export function getAdminEvaluations(token: string) {
  return request<{ evaluations: AdminEvaluation[] }>('/api/admin/evaluations', { headers: adminHeaders(token) })
}

export function deleteAdminEvaluation(token: string, id: string) {
  return request<{ deletedCount: number }>(`/api/admin/evaluations/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: adminHeaders(token),
  })
}

export function resetAdminEvaluations(token: string) {
  return request<{ deletedCount: number }>('/api/admin/evaluations', {
    method: 'DELETE',
    headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'BORRAR TODO' }),
  })
}
