import type { GroupResult } from './api'
import type { Group } from './shared/groups'

export interface RankedGroup {
  group: Group
  averageCents: number
  evaluationCount: number
}

export interface SectionStanding {
  section: number
  averageCents: number | null
  evaluatedGroups: number
  totalGroups: number
  evaluationCount: number
}

export interface CompetitionStats {
  sections: SectionStanding[]
  topGroups: RankedGroup[]
  bestGroups: RankedGroup[]
  winningSections: SectionStanding[]
}

export function competitionStats(groups: Group[], results: GroupResult[]): CompetitionStats {
  const resultById = new Map(results.map((result) => [result.groupId, result]))
  const rankedGroups = groups.flatMap((group) => {
    const result = resultById.get(group.id)
    return result?.averageCents == null || result.evaluationCount === 0 ? [] : [{
      group,
      averageCents: result.averageCents,
      evaluationCount: result.evaluationCount,
    }]
  }).sort((a, b) => b.averageCents - a.averageCents || a.group.section - b.group.section || a.group.number - b.group.number)

  const sections = [...new Set(groups.map((group) => group.section))].map((section) => {
    const sectionGroups = groups.filter((group) => group.section === section)
    const evaluated = rankedGroups.filter((entry) => entry.group.section === section)
    return {
      section,
      averageCents: evaluated.length ? evaluated.reduce((sum, entry) => sum + entry.averageCents, 0) / evaluated.length : null,
      evaluatedGroups: evaluated.length,
      totalGroups: sectionGroups.length,
      evaluationCount: evaluated.reduce((sum, entry) => sum + entry.evaluationCount, 0),
    }
  }).sort((a, b) => (b.averageCents ?? -1) - (a.averageCents ?? -1) || a.section - b.section)

  const bestScore = rankedGroups[0]?.averageCents
  const winningScore = sections[0]?.averageCents
  return {
    sections,
    topGroups: rankedGroups.slice(0, 5),
    bestGroups: bestScore === undefined ? [] : rankedGroups.filter((entry) => entry.averageCents === bestScore),
    winningSections: winningScore == null ? [] : sections.filter((entry) => entry.averageCents === winningScore),
  }
}
