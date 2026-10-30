import { describe, expect, it } from 'vitest'
import { competitionStats } from './stats'
import { groups } from './shared/groups'

describe('section competition stats', () => {
  it('ranks sections by the average of their evaluated groups', () => {
    const stats = competitionStats(groups, [
      { groupId: 's10-g7', averageCents: 800, evaluationCount: 1 },
      { groupId: 's10-g5', averageCents: 400, evaluationCount: 10 },
      { groupId: 's20-g5', averageCents: 650, evaluationCount: 2 },
    ])
    expect(stats.sections[0]).toMatchObject({ section: 20, averageCents: 650, evaluatedGroups: 1 })
    expect(stats.sections[1]).toMatchObject({ section: 10, averageCents: 600, evaluatedGroups: 2 })
    expect(stats.sections[2]).toMatchObject({ section: 30, averageCents: null, evaluatedGroups: 0 })
    expect(stats.bestGroups[0].group.id).toBe('s10-g7')
    expect(stats.winningSections[0].section).toBe(20)
  })

  it('shows ties and excludes groups without evaluations', () => {
    const stats = competitionStats(groups, [
      { groupId: 's10-g7', averageCents: 700, evaluationCount: 2 },
      { groupId: 's20-g5', averageCents: 700, evaluationCount: 3 },
      { groupId: 's30-g3', averageCents: null, evaluationCount: 0 },
    ])
    expect(stats.bestGroups).toHaveLength(2)
    expect(stats.winningSections).toHaveLength(2)
    expect(stats.topGroups).toHaveLength(2)
  })

  it('has no winner before any evaluation', () => {
    const stats = competitionStats(groups, [])
    expect(stats.bestGroups).toHaveLength(0)
    expect(stats.winningSections).toHaveLength(0)
    expect(stats.sections.every((section) => section.averageCents === null)).toBe(true)
  })
})
