export interface Group {
  id: string
  section: number
  number: number
  name: string
  date: string
}

export const groups: Group[] = [
  { id: 's30-g3', section: 30, number: 3, name: 'Parroquia San Pedro Nolasco', date: '3 de noviembre' },
  { id: 's10-g7', section: 10, number: 7, name: 'Waro', date: '3 de noviembre' },
  { id: 's20-g5', section: 20, number: 5, name: 'DMhub', date: '3 de noviembre' },
  { id: 's20-g6', section: 20, number: 6, name: 'VidaSana', date: '3 de noviembre' },
  { id: 's20-g3', section: 20, number: 3, name: 'Kontrol', date: '3 de noviembre' },
  { id: 's30-g7', section: 30, number: 7, name: 'Gestión de proyectos para Donaciones', date: '3 de noviembre' },
  { id: 's10-g5', section: 10, number: 5, name: 'Havit', date: '3 de noviembre' },
  { id: 's10-g6', section: 10, number: 6, name: 'ServiGT', date: '6 de noviembre' },
  { id: 's30-g5', section: 30, number: 5, name: 'Inventario y Ventas San Miguel', date: '6 de noviembre' },
  { id: 's10-g1', section: 10, number: 1, name: 'Swap', date: '6 de noviembre' },
  { id: 's20-g7', section: 20, number: 7, name: 'Agroconecta', date: '6 de noviembre' },
  { id: 's20-g1', section: 20, number: 1, name: 'Victoria', date: '10 de noviembre' },
  { id: 's30-g1', section: 30, number: 1, name: 'Farmacia', date: '10 de noviembre' },
  { id: 's20-g2', section: 20, number: 2, name: 'Organízate', date: '10 de noviembre' },
  { id: 's20-g4', section: 20, number: 4, name: 'VisaGuide', date: '10 de noviembre' },
  { id: 's30-g6', section: 30, number: 6, name: 'Sistema de Gestión de Donaciones', date: '10 de noviembre' },
  { id: 's10-g2', section: 10, number: 2, name: 'Tele Progreso', date: '10 de noviembre' },
  { id: 's20-g8', section: 20, number: 8, name: 'Flowdesk', date: '10 de noviembre' },
  { id: 's30-g4', section: 30, number: 4, name: 'SecureGate', date: '13 de noviembre' },
  { id: 's10-g3', section: 10, number: 3, name: 'Nexus Residencial', date: '13 de noviembre' },
  { id: 's30-g2', section: 30, number: 2, name: 'Medinet', date: '13 de noviembre' },
]

export const groupById = new Map(groups.map((group) => [group.id, group]))

export function groupLabel(group: Group): string {
  return `Sección ${group.section} · Grupo ${group.number} · ${group.name}`
}
