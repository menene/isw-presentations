export const levelNames = ['Sin evidencia', 'Deficiente', 'Regular', 'Bueno', 'Excelente'] as const

export interface Criterion {
  id: number
  title: string
  maxCents: number
  descriptions: readonly [string, string, string, string, string]
}

export const criteria: Criterion[] = [
  {
    id: 1, title: 'Hilo narrativo de toda la presentación', maxCents: 112,
    descriptions: [
      'No hay exposición suficiente para evaluar el hilo narrativo.',
      'Hay un orden mínimo, pero las partes se relacionan débilmente y el propósito se pierde.',
      'Hay secciones desconectadas o repetidas; cuesta seguir la historia completa.',
      'La historia se entiende de principio a fin, aunque algunas transiciones o el cierre son débiles.',
      'Conecta problema, solución y evidencia durante toda la exposición; usa transiciones claras y un cierre que retoma el propósito.',
    ],
  },
  {
    id: 2, title: 'Problemática del cliente', maxCents: 96,
    descriptions: [
      'No menciona un cliente ni su problema.',
      'Menciona un posible cliente o problema, pero sin datos ni claridad suficiente.',
      'Problema genérico o supuesto; cliente y usuarios poco definidos.',
      'Describe cliente y problema con evidencia parcial o consecuencias poco claras.',
      'Identifica cliente y usuarios concretos, evidencia su problema y explica sus consecuencias actuales.',
    ],
  },
  {
    id: 3, title: 'Valor e impacto de negocio', maxCents: 80,
    descriptions: [
      'No menciona beneficios ni impacto para el negocio.',
      'Menciona un beneficio vago sin explicar para quién ni cómo se produciría.',
      'Afirma beneficios generales sin base, métrica o supuesto verificable.',
      'Explica el valor esperado con una métrica o estimación; faltan supuestos o comparación.',
      'Compara con la situación actual; estima el impacto con una métrica pertinente y explica supuestos, beneficiarios y alternativas.',
    ],
  },
  {
    id: 4, title: 'Solución, demo y resultados UX', maxCents: 256,
    descriptions: [
      'No muestra el producto ni resultados de evaluación con usuarios.',
      'Muestra una función aislada sin explicar su utilidad y alude a UX sin resultados.',
      'Recorre pantallas sin vincularlas al problema o cita opiniones de usuarios sin resultados concretos.',
      'Demuestra flujos útiles y presenta retroalimentación de usuarios; falta evidencia o algún cambio derivado.',
      'Demuestra cómo la solución resuelve el problema con flujos reales integrados a la historia; muestra pruebas con usuarios, resultados y mejoras.',
    ],
  },
  {
    id: 5, title: 'Justificación tecnológica', maxCents: 80,
    descriptions: [
      'No menciona las tecnologías utilizadas.',
      'Nombra alguna tecnología, pero no explica por qué la escogió.',
      'Enumera herramientas con razones genéricas o sin relación con el proyecto.',
      'Justifica las tecnologías principales; la comparación o los criterios quedan incompletos.',
      'Explica por qué eligió tecnologías según requisitos, costos y alternativas pertinentes.',
    ],
  },
  {
    id: 6, title: 'Participación del equipo', maxCents: 80,
    descriptions: [
      'El equipo no presenta ninguna parte evaluable.',
      'Participa una parte del equipo con intervenciones mínimas o poco preparadas.',
      'Uno o dos integrantes concentran la exposición; otros intervienen mínimamente.',
      'Todos participan, con distribución desigual o alguna parte poco dominada.',
      'Todos exponen una parte sustancial, dominan su contenido y realizan relevos fluidos.',
    ],
  },
  {
    id: 7, title: 'Dinamismo y profesionalismo', maxCents: 48,
    descriptions: [
      'No hay exposición oral que permita evaluar este criterio.',
      'Exposición difícil de seguir por lectura continua, poca claridad o mal manejo del tiempo.',
      'Lectura frecuente, ritmo lento, poca formalidad o desajuste notable de tiempo.',
      'Presentación formal y clara con lectura ocasional, ritmo irregular o leve desajuste de tiempo.',
      'Ritmo ágil, voz clara, contacto visual, lenguaje y vestimenta apropiados; evita leer y respeta el tiempo.',
    ],
  },
  {
    id: 8, title: 'Calidad del apoyo visual', maxCents: 48,
    descriptions: [
      'No presenta apoyo visual.',
      'Los visuales distraen y dificultan entender el contenido.',
      'Diapositivas saturadas que se leen en vez de apoyar la exposición.',
      'Visuales útiles con algunas diapositivas cargadas o difíciles de leer.',
      'Visuales legibles, consistentes y con poco texto que ayudan a entender la historia.',
    ],
  },
]

export const maxTotalCents = criteria.reduce((sum, criterion) => sum + criterion.maxCents, 0)

export function pointsForLevel(criterion: Criterion, level: number): number {
  return (criterion.maxCents / 4) * level
}

export function totalCents(ratings: readonly number[]): number {
  return criteria.reduce((sum, criterion, index) => sum + pointsForLevel(criterion, ratings[index]), 0)
}

export function isValidRatings(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === criteria.length &&
    value.every((level) => Number.isInteger(level) && level >= 0 && level <= 4)
}

export function formatPoints(cents: number): string {
  return (cents / 100).toFixed(2)
}
