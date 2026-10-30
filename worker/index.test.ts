import { describe, expect, it } from 'vitest'
import worker from './index'

interface Row { id: string; groupId: string; name: string; ratings: number[]; totalCents: number; comments: string[]; generalComment: string }

function createEnv() {
  const rows: Row[] = []
  const DB = {
    prepare(query: string) {
      if (query.startsWith('INSERT')) {
        return { bind(id: string, name: string, groupId: string, ratingsJson: string, commentsJson: string, generalComment: string, totalCents: number) {
          return { async run() { rows.push({ id, name, groupId, ratings: JSON.parse(ratingsJson) as number[], totalCents, comments: JSON.parse(commentsJson) as string[], generalComment }) } }
        } }
      }
      if (query.includes('WHERE group_id = ?')) {
        return { bind(groupId: string) { return { async all() { return { results: rows.filter((row) => row.groupId === groupId).map((row) => ({
          id: row.id,
          evaluator_name: row.name,
          ratings_json: JSON.stringify(row.ratings),
          comments_json: JSON.stringify(row.comments),
          general_comment: row.generalComment,
          total_cents: row.totalCents,
          created_at: '2026-10-30 20:00:00',
        })) } } } } }
      }
      if (query.startsWith('SELECT id, evaluator_name, group_id')) {
        return { async all() { return { results: rows.map((row) => ({
          id: row.id,
          evaluator_name: row.name,
          group_id: row.groupId,
          total_cents: row.totalCents,
          created_at: '2026-10-30 20:00:00',
        })) } } }
      }
      if (query === 'DELETE FROM evaluations WHERE id = ?') {
        return { bind(id: string) { return { async run() {
          const index = rows.findIndex((row) => row.id === id)
          if (index >= 0) rows.splice(index, 1)
          return { meta: { changes: index >= 0 ? 1 : 0 } }
        } } } }
      }
      if (query === 'DELETE FROM evaluations') {
        return { async run() {
          const count = rows.length
          rows.splice(0)
          return { meta: { changes: count } }
        } }
      }
      return { async all() {
        const totals = new Map<string, { group_id: string; evaluation_count: number; sum_cents: number }>()
        for (const row of rows) {
          const total = totals.get(row.groupId) ?? { group_id: row.groupId, evaluation_count: 0, sum_cents: 0 }
          total.evaluation_count++
          total.sum_cents += row.totalCents
          totals.set(row.groupId, total)
        }
        return { results: [...totals.values()] }
      } }
    },
  }
  return { env: { DB, ALLOWED_ORIGIN: 'https://example.github.io', ADMIN_TOKEN: 'test-admin-token' } as unknown as Parameters<typeof worker.fetch>[1], rows }
}

function adminRequest(path = '/api/admin/evaluations', method = 'GET', token = 'test-admin-token', body?: unknown) {
  return new Request(`https://api.example.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: 'https://example.github.io' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function post(body: unknown, origin = 'https://example.github.io') {
  return new Request('https://api.example.com/api/evaluations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  })
}

function evaluation(ratings: number[]) {
  return { name: 'Ana', groupId: 's30-g3', ratings, comments: ['Buen inicio', ...Array(7).fill('')], generalComment: 'Presentación clara' }
}

describe('evaluation API', () => {
  it('counts repeated submissions and returns only aggregate results', async () => {
    const { env, rows } = createEnv()
    const first = await worker.fetch(post(evaluation(Array(8).fill(4))), env)
    const second = await worker.fetch(post(evaluation(Array(8).fill(0))), env)
    expect([first.status, second.status]).toEqual([201, 201])
    expect(rows).toHaveLength(2)
    expect(rows[0].comments[0]).toBe('Buen inicio')
    expect(rows[0].generalComment).toBe('Presentación clara')
    const response = await worker.fetch(new Request('https://api.example.com/api/results'), env)
    const body = await response.json() as { groups: { groupId: string; evaluationCount: number; averageCents: number | null }[] }
    expect(body.groups.find((group) => group.groupId === 's30-g3')).toEqual({ groupId: 's30-g3', evaluationCount: 2, averageCents: 400 })
    expect(JSON.stringify(body)).not.toContain('Ana')
    expect(JSON.stringify(body)).not.toContain('Presentación clara')
    expect(body.groups.find((group) => group.groupId === 's10-g7')?.averageCents).toBeNull()
  })

  it('rejects invalid ratings and groups without saving', async () => {
    const { env, rows } = createEnv()
    expect((await worker.fetch(post(evaluation(Array(7).fill(4))), env)).status).toBe(400)
    expect((await worker.fetch(post({ ...evaluation(Array(8).fill(4)), groupId: 'unknown' }), env)).status).toBe(400)
    expect((await worker.fetch(post({ ...evaluation(Array(8).fill(4)), comments: ['uno'] }), env)).status).toBe(400)
    expect((await worker.fetch(post({ ...evaluation(Array(8).fill(4)), comments: ['x'.repeat(1001), ...Array(7).fill('')] }), env)).status).toBe(400)
    expect((await worker.fetch(post({ ...evaluation(Array(8).fill(4)), generalComment: 'x'.repeat(2001) }), env)).status).toBe(400)
    expect(rows).toHaveLength(0)
  })

  it('accepts the full comment length allowed by the form', async () => {
    const { env, rows } = createEnv()
    const response = await worker.fetch(post({ ...evaluation(Array(8).fill(4)), comments: Array(8).fill('x'.repeat(1000)), generalComment: 'y'.repeat(2000) }), env)
    expect(response.status).toBe(201)
    expect(rows[0].comments[7]).toHaveLength(1000)
    expect(rows[0].generalComment).toHaveLength(2000)
  })

  it('returns all votes and comments for one group only', async () => {
    const { env } = createEnv()
    await worker.fetch(post(evaluation(Array(8).fill(4))), env)
    await worker.fetch(post({ ...evaluation(Array(8).fill(0)), groupId: 's10-g7' }), env)
    const response = await worker.fetch(new Request('https://api.example.com/api/results/s30-g3'), env)
    const detail = await response.json() as { evaluationCount: number; averageCents: number; evaluations: { evaluatorName: string; ratings: number[]; comments: string[]; generalComment: string }[] }
    expect(response.status).toBe(200)
    expect(detail.evaluationCount).toBe(1)
    expect(detail.averageCents).toBe(800)
    expect(detail.evaluations[0]).toMatchObject({ evaluatorName: 'Ana', ratings: Array(8).fill(4), generalComment: 'Presentación clara' })
    expect(detail.evaluations[0].comments[0]).toBe('Buen inicio')
    expect((await worker.fetch(new Request('https://api.example.com/api/results/unknown'), env)).status).toBe(404)
  })

  it('rejects requests from other browser origins', async () => {
    const { env, rows } = createEnv()
    const response = await worker.fetch(post(evaluation(Array(8).fill(4)), 'https://other.example'), env)
    expect(response.status).toBe(403)
    expect(rows).toHaveLength(0)
  })

  it('accepts same-origin requests without a separate allowed origin', async () => {
    const { env, rows } = createEnv()
    const sameOriginEnv = { ...env, ALLOWED_ORIGIN: undefined }
    const request = post(evaluation(Array(8).fill(4)), 'https://api.example.com')
    expect((await worker.fetch(request, sameOriginEnv)).status).toBe(201)
    expect(rows).toHaveLength(1)
    expect((await worker.fetch(post(evaluation(Array(8).fill(4)), 'https://other.example'), sameOriginEnv)).status).toBe(403)
  })

  it('protects the admin list and deletion endpoints', async () => {
    const { env, rows } = createEnv()
    await worker.fetch(post(evaluation(Array(8).fill(4))), env)
    expect((await worker.fetch(adminRequest(undefined, 'GET', 'wrong'), env)).status).toBe(401)
    expect((await worker.fetch(adminRequest('/api/admin/evaluations', 'DELETE', 'wrong', { confirm: 'BORRAR TODO' }), env)).status).toBe(401)
    expect(rows).toHaveLength(1)
    const list = await worker.fetch(adminRequest(), env)
    expect(list.status).toBe(200)
    expect((await list.json() as { evaluations: unknown[] }).evaluations).toHaveLength(1)
  })

  it('deletes one evaluation and updates aggregate results', async () => {
    const { env, rows } = createEnv()
    const created = await worker.fetch(post(evaluation(Array(8).fill(4))), env)
    const { id } = await created.json() as { id: string }
    await worker.fetch(post(evaluation(Array(8).fill(0))), env)
    expect((await worker.fetch(adminRequest(`/api/admin/evaluations/${id}`, 'DELETE'), env)).status).toBe(200)
    expect(rows).toHaveLength(1)
    expect((await worker.fetch(adminRequest(`/api/admin/evaluations/${id}`, 'DELETE'), env)).status).toBe(404)
    const result = await worker.fetch(new Request('https://api.example.com/api/results'), env)
    const body = await result.json() as { groups: { groupId: string; averageCents: number; evaluationCount: number }[] }
    expect(body.groups.find((group) => group.groupId === 's30-g3')).toMatchObject({ averageCents: 0, evaluationCount: 1 })
  })

  it('requires typed confirmation before clearing evaluations', async () => {
    const { env, rows } = createEnv()
    await worker.fetch(post(evaluation(Array(8).fill(4))), env)
    expect((await worker.fetch(adminRequest('/api/admin/evaluations', 'DELETE', 'test-admin-token', { confirm: 'no' }), env)).status).toBe(400)
    expect(rows).toHaveLength(1)
    const response = await worker.fetch(adminRequest('/api/admin/evaluations', 'DELETE', 'test-admin-token', { confirm: 'BORRAR TODO' }), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deletedCount: 1 })
    expect(rows).toHaveLength(0)
  })
})
