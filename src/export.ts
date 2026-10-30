import type { GroupResult } from './api'
import type { Group } from './shared/groups'
import { formatPoints } from './shared/rubric'

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function consolidatedCsv(groups: Group[], results: GroupResult[], section: string): string {
  const resultById = new Map(results.map((result) => [result.groupId, result]))
  const rows = groups
    .filter((group) => section === 'all' || String(group.section) === section)
    .map((group) => {
      const result = resultById.get(group.id)
      return [
        group.id,
        group.section,
        group.number,
        group.name,
        group.date,
        result?.evaluationCount ?? 0,
        result?.averageCents == null ? '' : formatPoints(result.averageCents),
      ].map(csvCell).join(',')
    })
  return [
    ['ID', 'Sección', 'Grupo', 'Nombre', 'Fecha de presentación', 'Evaluaciones', 'Promedio (0-8)'].map(csvCell).join(','),
    ...rows,
  ].join('\r\n') + '\r\n'
}
