import { groupById, groups } from '../src/shared/groups'
import { isValidRatings, totalCents } from '../src/shared/rubric'

interface Env {
  DB: D1Database
  ALLOWED_ORIGIN?: string
  ADMIN_TOKEN?: string
}

interface EvaluationInput {
  name?: unknown
  groupId?: unknown
  ratings?: unknown
  comments?: unknown
  generalComment?: unknown
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin')
  const allowed = origin && (origin === new URL(request.url).origin || origin === env.ALLOWED_ORIGIN)
  return allowed ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  } : { 'Vary': 'Origin' }
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const supplied = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!env.ADMIN_TOKEN || !supplied || supplied.length > 512) return false
  const encoder = new TextEncoder()
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_TOKEN)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ])
  const expected = new Uint8Array(expectedHash)
  const actual = new Uint8Array(suppliedHash)
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ actual[index]
  return difference === 0
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)
    const origin = request.headers.get('Origin')

    if (origin && origin !== url.origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'Origen no permitido.' }, 403, cors)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    try {
      if (url.pathname.startsWith('/api/admin/')) {
        if (!env.ADMIN_TOKEN) return json({ error: 'La administración aún no está configurada.' }, 503, cors)
        if (!await isAdmin(request, env)) return json({ error: 'Clave de administración incorrecta.' }, 401, cors)

        if (url.pathname === '/api/admin/evaluations' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT id, evaluator_name, group_id, total_cents, created_at FROM evaluations ORDER BY created_at DESC, id DESC',
          ).all<{
            id: string
            evaluator_name: string
            group_id: string
            total_cents: number
            created_at: string
          }>()
          return json({ evaluations: results.map((row) => ({
            id: row.id,
            evaluatorName: row.evaluator_name,
            groupId: row.group_id,
            totalCents: row.total_cents,
            createdAt: row.created_at,
          })) }, 200, cors)
        }

        if (url.pathname === '/api/admin/evaluations' && request.method === 'DELETE') {
          if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
            return json({ error: 'Confirma el borrado en formato JSON.' }, 415, cors)
          }
          let confirmation: unknown
          try {
            confirmation = await request.json()
          } catch {
            return json({ error: 'La confirmación no es válida.' }, 400, cors)
          }
          if (!confirmation || typeof confirmation !== 'object' || !('confirm' in confirmation) || confirmation.confirm !== 'BORRAR TODO') {
            return json({ error: 'Escribe BORRAR TODO para confirmar.' }, 400, cors)
          }
          const result = await env.DB.prepare('DELETE FROM evaluations').run()
          return json({ deletedCount: result.meta.changes }, 200, cors)
        }

        if (url.pathname.startsWith('/api/admin/evaluations/') && request.method === 'DELETE') {
          const id = url.pathname.slice('/api/admin/evaluations/'.length)
          if (!id || id.includes('/')) return json({ error: 'Evaluación no encontrada.' }, 404, cors)
          const result = await env.DB.prepare('DELETE FROM evaluations WHERE id = ?').bind(id).run()
          if (result.meta.changes === 0) return json({ error: 'Evaluación no encontrada.' }, 404, cors)
          return json({ deletedCount: 1 }, 200, cors)
        }

        return json({ error: 'Ruta no encontrada.' }, 404, cors)
      }

      if (url.pathname === '/api/results' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT group_id, COUNT(*) AS evaluation_count, SUM(total_cents) AS sum_cents FROM evaluations GROUP BY group_id',
        ).all<{ group_id: string; evaluation_count: number; sum_cents: number }>()
        const totals = new Map(results.map((row) => [row.group_id, row]))
        return json({ groups: groups.map((group) => {
          const row = totals.get(group.id)
          return {
            groupId: group.id,
            evaluationCount: row?.evaluation_count ?? 0,
            averageCents: row ? row.sum_cents / row.evaluation_count : null,
          }
        }) }, 200, cors)
      }

      if (url.pathname.startsWith('/api/results/') && request.method === 'GET') {
        const groupId = url.pathname.slice('/api/results/'.length)
        if (!groupById.has(groupId)) return json({ error: 'Grupo no encontrado.' }, 404, cors)
        const { results } = await env.DB.prepare(
          'SELECT id, evaluator_name, ratings_json, comments_json, general_comment, total_cents, created_at FROM evaluations WHERE group_id = ? ORDER BY created_at DESC, id DESC',
        ).bind(groupId).all<{
          id: string
          evaluator_name: string
          ratings_json: string
          comments_json: string
          general_comment: string
          total_cents: number
          created_at: string
        }>()
        const sumCents = results.reduce((sum, row) => sum + row.total_cents, 0)
        return json({
          groupId,
          evaluationCount: results.length,
          averageCents: results.length ? sumCents / results.length : null,
          evaluations: results.map((row) => ({
            id: row.id,
            evaluatorName: row.evaluator_name,
            ratings: JSON.parse(row.ratings_json),
            comments: JSON.parse(row.comments_json),
            generalComment: row.general_comment,
            totalCents: row.total_cents,
            createdAt: row.created_at,
          })),
        }, 200, cors)
      }

      if (url.pathname === '/api/evaluations' && request.method === 'POST') {
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
          return json({ error: 'Envía los datos en formato JSON.' }, 415, cors)
        }
        const body = await request.text()
        if (body.length > 65536) return json({ error: 'La solicitud es demasiado grande.' }, 413, cors)
        let input: EvaluationInput
        try {
          input = JSON.parse(body) as EvaluationInput
        } catch {
          return json({ error: 'El JSON no es válido.' }, 400, cors)
        }
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          return json({ error: 'La evaluación no es válida.' }, 400, cors)
        }
        const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
        if (name.length < 1 || name.length > 80) {
          return json({ error: 'Ingresa un nombre de hasta 80 caracteres.' }, 400, cors)
        }
        if (typeof input.groupId !== 'string' || !groupById.has(input.groupId)) {
          return json({ error: 'Selecciona un grupo válido.' }, 400, cors)
        }
        if (!isValidRatings(input.ratings)) {
          return json({ error: 'Califica los ocho criterios con un nivel válido.' }, 400, cors)
        }
        if (!Array.isArray(input.comments) || input.comments.length !== 8 ||
          !input.comments.every((comment) => typeof comment === 'string' && comment.trim().length <= 1000)) {
          return json({ error: 'Los comentarios de los criterios no son válidos.' }, 400, cors)
        }
        if (typeof input.generalComment !== 'string' || input.generalComment.trim().length > 2000) {
          return json({ error: 'El comentario general no es válido.' }, 400, cors)
        }
        const comments = (input.comments as string[]).map((comment) => comment.trim())
        const generalComment = input.generalComment.trim()
        const score = totalCents(input.ratings)
        const id = crypto.randomUUID()
        await env.DB.prepare(
          'INSERT INTO evaluations (id, evaluator_name, group_id, ratings_json, comments_json, general_comment, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(id, name, input.groupId, JSON.stringify(input.ratings), JSON.stringify(comments), generalComment, score).run()
        return json({ id, totalCents: score }, 201, cors)
      }

      return json({ error: 'Ruta no encontrada.' }, 404, cors)
    } catch (error) {
      console.error('API error', error)
      return json({ error: 'No se pudo completar la solicitud. Intenta de nuevo.' }, 500, cors)
    }
  },
}
