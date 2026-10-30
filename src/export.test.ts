import { describe, expect, it } from 'vitest'
import { consolidatedCsv } from './export'
import { groups } from './shared/groups'

describe('consolidated CSV', () => {
  const results = [
    { groupId: 's30-g3', evaluationCount: 2, averageCents: 637.5 },
    { groupId: 's10-g7', evaluationCount: 0, averageCents: null },
  ]

  it('exports all groups with averages and empty values for unevaluated groups', () => {
    const lines = consolidatedCsv(groups, results, 'all').trim().split('\r\n')
    expect(lines).toHaveLength(22)
    expect(lines[1]).toContain('"6.38"')
    expect(lines[2]).toContain('"0",""')
  })

  it('limits rows to the selected section', () => {
    const lines = consolidatedCsv(groups, results, '10').trim().split('\r\n')
    expect(lines).toHaveLength(7)
    expect(lines.slice(1).every((line) => line.includes('"s10-'))).toBe(true)
  })

  it('escapes quotes in CSV cells', () => {
    const csv = consolidatedCsv([{ ...groups[0], name: 'Proyecto "A", final' }], results, 'all')
    expect(csv).toContain('"Proyecto ""A"", final"')
  })
})
