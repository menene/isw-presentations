<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { deleteAdminEvaluation, getAdminEvaluations, getGroupDetail, getResults, resetAdminEvaluations, submitEvaluation, type AdminEvaluation, type GroupDetail, type GroupResult } from './api'
import { consolidatedCsv } from './export'
import { competitionStats } from './stats'
import { groups, groupById, groupLabel } from './shared/groups'
import { criteria, formatPoints, levelNames, maxTotalCents, pointsForLevel } from './shared/rubric'

type Page = 'evaluar' | 'resultados' | 'detalle' | 'exportar' | 'stats' | 'admin'
const page = ref<Page>('evaluar')
const name = ref('')
const groupId = ref('')
const ratings = ref<(number | null)[]>(Array(criteria.length).fill(null))
const comments = ref<string[]>(Array(criteria.length).fill(''))
const generalComment = ref('')
const submitting = ref(false)
const submitError = ref('')
const submitted = ref<{ groupName: string; totalCents: number } | null>(null)
const results = ref<GroupResult[]>([])
const resultsLoading = ref(false)
const resultsError = ref('')
const detailGroupId = ref('')
const detail = ref<GroupDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const exportSection = ref('all')
const adminToken = ref('')
const adminUnlocked = ref(false)
const adminEvaluations = ref<AdminEvaluation[]>([])
const adminLoading = ref(false)
const adminBusy = ref('')
const adminError = ref('')
const adminSuccess = ref('')
const adminFilter = ref('all')
const resetPhrase = ref('')
const selectedCount = computed(() => ratings.value.filter((rating) => rating !== null).length)
const liveCents = computed(() => criteria.reduce((sum, criterion, index) => {
  const level = ratings.value[index]
  return sum + (level === null ? 0 : pointsForLevel(criterion, level))
}, 0))
const complete = computed(() => name.value.trim().length > 0 && name.value.trim().length <= 80 &&
  !!groupId.value && selectedCount.value === criteria.length)
const groupResultById = computed(() => new Map(results.value.map((result) => [result.groupId, result])))
const totalEvaluations = computed(() => results.value.reduce((sum, result) => sum + result.evaluationCount, 0))
const dates = [...new Set(groups.map((group) => group.date))]
const detailGroup = computed(() => groupById.get(detailGroupId.value))
const exportGroups = computed(() => groups.filter((group) => exportSection.value === 'all' || String(group.section) === exportSection.value))
const exportEvaluationCount = computed(() => exportGroups.value.reduce((sum, group) => sum + (groupResultById.value.get(group.id)?.evaluationCount ?? 0), 0))
const exportReady = computed(() => !resultsLoading.value && !resultsError.value && results.value.length === groups.length)
const stats = computed(() => competitionStats(groups, results.value))
const filteredAdminEvaluations = computed(() => adminEvaluations.value.filter((evaluation) => adminFilter.value === 'all' || evaluation.groupId === adminFilter.value))

function changePage(): void {
  const path = location.pathname.replace(/\/$/, '') || '/'
  const detailMatch = path.match(/^\/resultados\/([^/]+)$/)
  if (detailMatch) {
    page.value = 'detalle'
    detailGroupId.value = detailMatch[1]
    if (groupById.has(detailGroupId.value)) void loadDetail()
    else { detail.value = null; detailError.value = 'Grupo no encontrado.' }
  } else if (path === '/exportar') {
    page.value = 'exportar'
    void loadResults()
  } else if (path === '/stats') {
    page.value = 'stats'
    void loadResults()
  } else if (path === '/admin') {
    page.value = 'admin'
    if (adminToken.value) void loadAdminEvaluations()
  } else if (path === '/resultados') {
    page.value = 'resultados'
    void loadResults()
  } else {
    page.value = 'evaluar'
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleInternalLink(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (!(event.target instanceof Element)) return
  const anchor = event.target.closest('a')
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return
  const url = new URL(anchor.href)
  if (url.origin !== location.origin || !/^\/(evaluar|resultados(?:\/[^/]+)?|stats|exportar|admin)\/?$/.test(url.pathname)) return
  event.preventDefault()
  if (url.pathname !== location.pathname) history.pushState(null, '', url.pathname)
  changePage()
}

async function loadAdminEvaluations(): Promise<void> {
  if (!adminToken.value) return
  adminLoading.value = true
  adminError.value = ''
  adminSuccess.value = ''
  try {
    adminEvaluations.value = (await getAdminEvaluations(adminToken.value)).evaluations
    adminUnlocked.value = true
  } catch (error) {
    adminUnlocked.value = false
    adminError.value = error instanceof Error ? error.message : 'No se pudieron cargar las evaluaciones.'
  } finally {
    adminLoading.value = false
  }
}

function lockAdmin(): void {
  adminToken.value = ''
  adminUnlocked.value = false
  adminEvaluations.value = []
  adminError.value = ''
  adminSuccess.value = ''
  resetPhrase.value = ''
}

async function removeEvaluation(evaluation: AdminEvaluation): Promise<void> {
  const group = groupById.get(evaluation.groupId)
  if (!window.confirm(`¿Eliminar la evaluación de ${evaluation.evaluatorName} para ${group?.name ?? evaluation.groupId}? Esta acción no se puede deshacer.`)) return
  adminBusy.value = evaluation.id
  adminError.value = ''
  adminSuccess.value = ''
  try {
    await deleteAdminEvaluation(adminToken.value, evaluation.id)
    adminEvaluations.value = adminEvaluations.value.filter((item) => item.id !== evaluation.id)
    adminSuccess.value = 'Evaluación eliminada.'
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : 'No se pudo eliminar la evaluación.'
  } finally {
    adminBusy.value = ''
  }
}

async function resetEvaluations(): Promise<void> {
  if (resetPhrase.value !== 'BORRAR TODO' || adminBusy.value) return
  if (!window.confirm(`¿Eliminar definitivamente las ${adminEvaluations.value.length} evaluaciones?`)) return
  adminBusy.value = 'reset'
  adminError.value = ''
  adminSuccess.value = ''
  try {
    const result = await resetAdminEvaluations(adminToken.value)
    adminEvaluations.value = []
    resetPhrase.value = ''
    adminSuccess.value = `Se eliminaron ${result.deletedCount} evaluaciones.`
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : 'No se pudo vaciar la base de evaluaciones.'
  } finally {
    adminBusy.value = ''
  }
}

async function loadDetail(): Promise<void> {
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  try {
    detail.value = await getGroupDetail(detailGroupId.value)
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : 'No se pudo cargar el detalle.'
  } finally {
    detailLoading.value = false
  }
}

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala',
  }).format(date)
}

function barWidth(cents: number): string {
  return `${Math.max(0, Math.min(100, cents / 8))}%`
}

function downloadCsv(): void {
  if (!exportReady.value) return
  const csv = consolidatedCsv(groups, results.value, exportSection.value)
  const file = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `resultados-cc3091-${exportSection.value === 'all' ? 'todas-las-secciones' : `seccion-${exportSection.value}`}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function loadResults(): Promise<void> {
  resultsLoading.value = true
  resultsError.value = ''
  try {
    results.value = (await getResults()).groups
  } catch (error) {
    resultsError.value = error instanceof Error ? error.message : 'No se pudieron cargar los resultados.'
  } finally {
    resultsLoading.value = false
  }
}

async function submit(): Promise<void> {
  if (!complete.value || submitting.value) return
  submitError.value = ''
  submitting.value = true
  try {
    const selectedGroup = groupById.get(groupId.value)!
    const result = await submitEvaluation({
      name: name.value.trim(),
      groupId: groupId.value,
      ratings: ratings.value as number[],
      comments: comments.value,
      generalComment: generalComment.value,
    })
    submitted.value = { groupName: groupLabel(selectedGroup), totalCents: result.totalCents }
    ratings.value = Array(criteria.length).fill(null)
    comments.value = Array(criteria.length).fill('')
    generalComment.value = ''
    groupId.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'No se pudo guardar la evaluación.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (location.hash.startsWith('#/')) {
    history.replaceState(null, '', `${location.hash.slice(1)}${location.search}`)
  } else if (location.pathname === '/') {
    history.replaceState(null, '', `/evaluar${location.search}`)
  }
  changePage()
  window.addEventListener('popstate', changePage)
  document.addEventListener('click', handleInternalLink)
})
onUnmounted(() => {
  window.removeEventListener('popstate', changePage)
  document.removeEventListener('click', handleInternalLink)
})
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/evaluar" aria-label="Inicio · evaluación de presentaciones">
          <span class="brand-mark">CC3091</span>
          <span class="brand-copy">Proyecto de software <span class="brand-separator">/</span> Presentación final</span>
        </a>
        <nav class="main-nav" aria-label="Navegación principal">
          <a href="/evaluar" :class="{ active: page === 'evaluar' }" :aria-current="page === 'evaluar' ? 'page' : undefined">Evaluar</a>
          <a href="/resultados" :class="{ active: page === 'resultados' || page === 'detalle' }" :aria-current="page === 'resultados' || page === 'detalle' ? 'page' : undefined">Resultados</a>
          <a href="/stats" :class="{ active: page === 'stats' }" :aria-current="page === 'stats' ? 'page' : undefined">Stats</a>
          <a href="/exportar" :class="{ active: page === 'exportar' }" :aria-current="page === 'exportar' ? 'page' : undefined">Exportar</a>
          <a href="/admin" :class="{ active: page === 'admin' }" :aria-current="page === 'admin' ? 'page' : undefined">Admin</a>
        </nav>
      </div>
    </header>

    <main>
      <template v-if="page === 'evaluar'">
        <section class="page-intro content-wrap">
          <p class="eyebrow">Rúbrica de presentación final</p>
          <h1>Evaluación de presentaciones</h1>
          <p>Selecciona un grupo, califica los ocho criterios y deja tus observaciones. Cada evaluación se suma al promedio final.</p>
          <div class="intro-meta"><span>8 criterios</span><span>8.00 puntos posibles</span><span>14 minutos de presentación</span></div>
        </section>

        <div class="content-wrap">
          <div v-if="submitted" class="success-banner" role="status">
            <div class="success-icon">✓</div>
            <div><strong>Evaluación enviada</strong><p>{{ submitted.groupName }} · {{ formatPoints(submitted.totalCents) }} / 8.00 puntos</p></div>
            <button type="button" class="text-button" @click="submitted = null">Cerrar</button>
          </div>

          <form @submit.prevent="submit" novalidate>
            <div class="section-heading"><div><p class="section-kicker">01 / IDENTIFICACIÓN</p><h2>Antes de comenzar</h2><p>Solo necesitamos tu nombre y el grupo que vas a evaluar.</p></div></div>
            <div class="identity-card">
              <div class="field"><label for="evaluator-name">Tu nombre <span aria-hidden="true">*</span></label><input id="evaluator-name" v-model="name" type="text" maxlength="80" autocomplete="name" placeholder="Escribe tu nombre" required /></div>
              <div class="field"><label for="group-select">Grupo a evaluar <span aria-hidden="true">*</span></label><select id="group-select" v-model="groupId" required><option value="" disabled>Selecciona un grupo</option><optgroup v-for="date in dates" :key="date" :label="date"><option v-for="group in groups.filter((item) => item.date === date)" :key="group.id" :value="group.id">{{ groupLabel(group) }}</option></optgroup></select></div>
              <p class="identity-note">Cada envío cuenta como una evaluación independiente. Tu nombre y comentarios se mostrarán en el detalle público del grupo.</p>
            </div>

            <div class="section-heading rubric-heading"><div><p class="section-kicker">02 / RÚBRICA</p><h2>Evalúa la presentación</h2><p>Elige un nivel para cada criterio. Puedes consultar la descripción completa antes de decidir.</p></div><div class="progress-chip">{{ selectedCount }} de 8 criterios</div></div>
            <div class="rubric-list">
              <article v-for="(criterion, index) in criteria" :key="criterion.id" class="criterion-card">
                <div class="criterion-top"><span class="criterion-number">{{ String(criterion.id).padStart(2, '0') }}</span><div class="criterion-title"><h3>{{ criterion.title }}</h3><span>Máximo {{ formatPoints(criterion.maxCents) }} pts</span></div><span v-if="ratings[index] !== null" class="criterion-score">{{ formatPoints(pointsForLevel(criterion, ratings[index]!)) }} <small>pts</small></span></div>
                <fieldset class="level-fieldset"><legend class="sr-only">Nivel para {{ criterion.title }}</legend><label v-for="(level, value) in levelNames" :key="value" class="level-option" :class="{ chosen: ratings[index] === value }"><input v-model="ratings[index]" type="radio" :name="`criterion-${criterion.id}`" :value="value" /><span class="level-name">{{ level }}</span><span class="level-points">{{ formatPoints(pointsForLevel(criterion, value)) }}</span></label></fieldset>
                <p v-if="ratings[index] !== null" class="selected-description"><span>Descripción seleccionada</span>{{ criterion.descriptions[ratings[index]!] }}</p>
                <details class="rubric-details"><summary>Ver descripciones de todos los niveles <span aria-hidden="true">＋</span></summary><div class="description-list"><div v-for="(description, value) in criterion.descriptions" :key="value"><strong>{{ levelNames[value] }} · {{ formatPoints(pointsForLevel(criterion, value)) }} pts</strong><p>{{ description }}</p></div></div></details>
                <div class="comment-field"><label :for="`comment-${criterion.id}`">Comentario sobre este criterio <span>(opcional)</span></label><textarea :id="`comment-${criterion.id}`" v-model="comments[index]" maxlength="1000" rows="3" placeholder="¿Qué observaste en este criterio?"></textarea></div>
              </article>
            </div>

            <section class="general-comment"><p class="section-kicker">03 / CIERRE</p><h2>Comentario general</h2><p>Agrega una observación final sobre la presentación.</p><label class="sr-only" for="general-comment">Comentario general</label><textarea id="general-comment" v-model="generalComment" maxlength="2000" rows="5" placeholder="Fortalezas, oportunidades de mejora o cualquier observación adicional…"></textarea></section>
            <div class="submit-panel"><div class="score-summary"><span>Tu calificación</span><div><strong>{{ formatPoints(liveCents) }}</strong><span> / {{ formatPoints(maxTotalCents) }}</span></div><small>{{ selectedCount }} de 8 criterios calificados</small></div><div class="submit-actions"><p v-if="submitError" class="error-message" role="alert">{{ submitError }}</p><button type="submit" class="primary-button" :disabled="!complete || submitting">{{ submitting ? 'Enviando…' : 'Enviar evaluación' }} <span aria-hidden="true">→</span></button><small>Revisa tus respuestas antes de enviar.</small></div></div>
          </form>
        </div>
      </template>

      <template v-else-if="page === 'resultados'">
        <section class="page-intro content-wrap results-intro">
          <p class="eyebrow">Resultados generales</p>
          <h1>Resultados por grupo</h1>
          <p>Promedio de todas las evaluaciones recibidas para cada grupo, sobre 8 puntos.</p>
        </section>
        <div class="content-wrap results-content">
          <div class="results-overview">
            <div><span class="overview-label">PRESENTACIONES</span><strong>{{ groups.length }}</strong><small>grupos registrados</small></div>
            <div><span class="overview-label">EVALUACIONES</span><strong>{{ totalEvaluations }}</strong><small>respuestas recibidas</small></div>
            <button type="button" class="refresh-button" :disabled="resultsLoading" @click="loadResults">{{ resultsLoading ? 'Actualizando…' : '↻ Actualizar resultados' }}</button>
          </div>
          <p v-if="resultsError" class="error-message results-error" role="alert">{{ resultsError }}</p>
          <div v-if="resultsLoading && results.length === 0" class="empty-state">Cargando resultados…</div>
          <template v-else>
            <section v-for="date in dates" :key="date" class="date-section">
              <div class="date-heading"><h2>{{ date }}</h2><span>{{ groups.filter((group) => group.date === date).length }} grupos</span></div>
              <div class="results-list">
                <div v-for="group in groups.filter((item) => item.date === date)" :key="group.id" class="result-row">
                  <div class="result-group"><span class="group-badge">{{ group.section }} / {{ group.number }}</span><div><strong>{{ group.name }}</strong><small>Sección {{ group.section }} · Grupo {{ group.number }}</small></div></div>
                  <div class="result-end">
                    <div class="result-value">
                      <template v-if="groupResultById.get(group.id)?.evaluationCount"><strong>{{ formatPoints(groupResultById.get(group.id)!.averageCents!) }} <span>/ 8.00</span></strong><small>{{ groupResultById.get(group.id)!.evaluationCount }} {{ groupResultById.get(group.id)!.evaluationCount === 1 ? 'evaluación' : 'evaluaciones' }}</small></template>
                      <span v-else class="no-results">Sin evaluaciones</span>
                    </div>
                    <a class="detail-link" :href="`/resultados/${group.id}`">Ver detalle <span aria-hidden="true">→</span></a>
                  </div>
                </div>
              </div>
            </section>
          </template>
        </div>
      </template>

      <template v-else-if="page === 'detalle'">
        <div class="content-wrap detail-page">
          <a class="back-link" href="/resultados">← Volver a resultados</a>
          <div v-if="detailGroup" class="detail-heading">
            <p class="eyebrow">Sección {{ detailGroup.section }} · Grupo {{ detailGroup.number }}</p>
            <h1>{{ detailGroup.name }}</h1>
            <p>Detalle de todas las evaluaciones recibidas para este grupo.</p>
          </div>
          <p v-if="detailError" class="error-message" role="alert">{{ detailError }}</p>
          <div v-else-if="detailLoading" class="empty-state">Cargando evaluaciones…</div>
          <template v-else-if="detail">
            <div class="detail-summary">
              <div><span>Promedio final</span><strong>{{ detail.averageCents === null ? '—' : formatPoints(detail.averageCents) }} <small>/ 8.00</small></strong></div>
              <div><span>Evaluaciones recibidas</span><strong>{{ detail.evaluationCount }}</strong></div>
            </div>
            <div class="detail-section-title"><h2>Votos y comentarios</h2><span>{{ detail.evaluationCount }} {{ detail.evaluationCount === 1 ? 'evaluación' : 'evaluaciones' }}</span></div>
            <div v-if="detail.evaluations.length === 0" class="empty-state bordered">Este grupo aún no tiene evaluaciones.</div>
            <details v-for="evaluation in detail.evaluations" :key="evaluation.id" class="vote-card" open>
              <summary>
                <span class="vote-person"><strong>{{ evaluation.evaluatorName }}</strong><small>{{ formatDate(evaluation.createdAt) }}</small></span>
                <span class="vote-total">{{ formatPoints(evaluation.totalCents) }} <small>/ 8.00</small></span>
                <span class="vote-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div class="vote-body">
                <div v-for="(criterion, index) in criteria" :key="criterion.id" class="vote-criterion">
                  <div class="vote-criterion-heading"><strong>{{ criterion.id }}. {{ criterion.title }}</strong><span>{{ levelNames[evaluation.ratings[index]] }} · {{ formatPoints(pointsForLevel(criterion, evaluation.ratings[index])) }} / {{ formatPoints(criterion.maxCents) }}</span></div>
                  <p v-if="evaluation.comments[index]">{{ evaluation.comments[index] }}</p>
                </div>
                <div class="vote-general"><strong>Comentario general</strong><p>{{ evaluation.generalComment || 'Sin comentario general.' }}</p></div>
              </div>
            </details>
          </template>
        </div>
      </template>

      <template v-else-if="page === 'stats'">
        <section class="page-intro content-wrap results-intro">
          <p class="eyebrow">Competencia entre secciones</p>
          <h1>Stats de presentaciones</h1>
          <p>Compara los resultados de las secciones y descubre qué grupo lleva la mejor calificación.</p>
        </section>
        <div class="content-wrap stats-content">
          <div class="stats-toolbar"><span>Resultados sobre 8.00 puntos</span><button type="button" class="refresh-button" :disabled="resultsLoading" @click="loadResults">{{ resultsLoading ? 'Actualizando…' : '↻ Actualizar stats' }}</button></div>
          <p v-if="resultsError" class="error-message results-error" role="alert">{{ resultsError }}</p>
          <div v-if="resultsLoading && results.length === 0" class="empty-state">Cargando estadísticas…</div>
          <template v-else-if="!resultsError && results.length === groups.length">
            <div v-if="stats.bestGroups.length === 0" class="empty-state bordered">Todavía no hay evaluaciones. Las estadísticas aparecerán cuando se califique el primer grupo.</div>
            <template v-else>
              <div class="stats-feature-grid">
                <article class="stats-feature"><p class="section-kicker">{{ stats.bestGroups.length === 1 ? 'MEJOR GRUPO' : 'GRUPOS EMPATADOS EN PRIMER LUGAR' }}</p><div v-for="entry in stats.bestGroups" :key="entry.group.id" class="feature-entry"><a :href="`/resultados/${entry.group.id}`">{{ entry.group.name }} <span aria-hidden="true">↗</span></a><span>Sección {{ entry.group.section }} · Grupo {{ entry.group.number }} · {{ entry.evaluationCount }} {{ entry.evaluationCount === 1 ? 'evaluación' : 'evaluaciones' }}</span></div><strong class="feature-score">{{ formatPoints(stats.bestGroups[0].averageCents) }} <small>/ 8.00</small></strong></article>
                <article class="stats-feature"><p class="section-kicker">{{ stats.winningSections.length === 1 ? 'SECCIÓN LÍDER' : 'SECCIONES EMPATADAS' }}</p><div v-for="entry in stats.winningSections" :key="entry.section" class="feature-entry"><strong>Sección {{ entry.section }}</strong><span>{{ entry.evaluatedGroups }} de {{ entry.totalGroups }} grupos evaluados</span></div><strong class="feature-score">{{ formatPoints(stats.winningSections[0].averageCents!) }} <small>/ 8.00</small></strong></article>
              </div>

              <section class="stats-chart-card"><div class="stats-chart-heading"><div><h2>Secciones frente a frente</h2><p>Promedio de los grupos evaluados en cada sección.</p></div></div><div class="chart-list"><div v-for="section in stats.sections" :key="section.section" class="chart-row"><div class="chart-row-top"><strong>Sección {{ section.section }}</strong><span>{{ section.averageCents === null ? 'Sin evaluaciones' : `${formatPoints(section.averageCents)} / 8.00` }}</span></div><div class="chart-track" role="meter" :aria-label="`Promedio de la sección ${section.section}`" :aria-valuenow="section.averageCents === null ? 0 : section.averageCents / 100" aria-valuemin="0" aria-valuemax="8"><div class="chart-fill" :class="{ leading: stats.winningSections.some((winner) => winner.section === section.section) }" :style="{ width: barWidth(section.averageCents ?? 0) }"></div></div><small>{{ section.evaluatedGroups }} de {{ section.totalGroups }} grupos evaluados · {{ section.evaluationCount }} {{ section.evaluationCount === 1 ? 'voto' : 'votos' }}</small></div></div><p class="stats-note">Cada grupo evaluado aporta el mismo peso al promedio de su sección. Los grupos sin votos aún no cuentan.</p></section>

              <section class="stats-chart-card"><div class="stats-chart-heading"><div><h2>Grupos mejor calificados</h2><p>Los cinco mejores promedios entre todos los grupos evaluados.</p></div></div><div class="chart-list"><div v-for="(entry, index) in stats.topGroups" :key="entry.group.id" class="chart-row"><div class="chart-row-top"><a :href="`/resultados/${entry.group.id}`"><span class="chart-rank">{{ index + 1 }}.</span> {{ entry.group.name }} <small>· Sección {{ entry.group.section }}</small></a><span>{{ formatPoints(entry.averageCents) }} / 8.00</span></div><div class="chart-track" role="meter" :aria-label="`Promedio de ${entry.group.name}`" :aria-valuenow="entry.averageCents / 100" aria-valuemin="0" aria-valuemax="8"><div class="chart-fill" :class="{ leading: index === 0 }" :style="{ width: barWidth(entry.averageCents) }"></div></div><small>{{ entry.evaluationCount }} {{ entry.evaluationCount === 1 ? 'evaluación' : 'evaluaciones' }}</small></div></div></section>
            </template>
          </template>
        </div>
      </template>

      <template v-else-if="page === 'admin'">
        <section class="page-intro content-wrap results-intro"><p class="eyebrow">Administración</p><h1>Admin</h1><p>Revisa y elimina evaluaciones individuales, o vacía todas las evaluaciones guardadas. Estas acciones requieren la clave de administración.</p></section>
        <div class="content-wrap admin-content">
          <form v-if="!adminUnlocked" class="admin-login" @submit.prevent="loadAdminEvaluations"><h2>Acceso de administración</h2><p>Ingresa la clave configurada en el Worker. La clave permanece solo en esta pestaña y se borra al recargar.</p><div class="field"><label for="admin-token">Clave de administración</label><input id="admin-token" v-model="adminToken" type="password" autocomplete="current-password" placeholder="Clave de administración" required /></div><button type="submit" class="primary-button" :disabled="!adminToken || adminLoading">{{ adminLoading ? 'Verificando…' : 'Entrar' }} <span aria-hidden="true">→</span></button></form>
          <template v-else>
            <div class="admin-toolbar"><div><strong>{{ adminEvaluations.length }}</strong><span>{{ adminEvaluations.length === 1 ? 'evaluación guardada' : 'evaluaciones guardadas' }}</span></div><div class="admin-toolbar-actions"><button type="button" class="refresh-button" :disabled="adminLoading || !!adminBusy" @click="loadAdminEvaluations">{{ adminLoading ? 'Actualizando…' : '↻ Actualizar' }}</button><button type="button" class="refresh-button" @click="lockAdmin">Salir</button></div></div>
            <section class="admin-list-section"><div class="admin-list-heading"><div><h2>Evaluaciones</h2><p>Elimina solo la respuesta que selecciones. Los promedios se recalculan automáticamente.</p></div><div class="field"><label for="admin-group-filter">Filtrar por grupo</label><select id="admin-group-filter" v-model="adminFilter"><option value="all">Todos los grupos</option><option v-for="group in groups" :key="group.id" :value="group.id">{{ groupLabel(group) }}</option></select></div></div><div v-if="filteredAdminEvaluations.length === 0" class="empty-state bordered">No hay evaluaciones para mostrar.</div><div v-else class="admin-list"><div v-for="evaluation in filteredAdminEvaluations" :key="evaluation.id" class="admin-row"><div class="admin-row-main"><strong>{{ evaluation.evaluatorName }}</strong><span>{{ groupById.get(evaluation.groupId) ? groupLabel(groupById.get(evaluation.groupId)!) : evaluation.groupId }}</span><small>{{ formatDate(evaluation.createdAt) }}</small></div><div class="admin-row-actions"><strong>{{ formatPoints(evaluation.totalCents) }} <small>/ 8.00</small></strong><button type="button" class="delete-button" :disabled="!!adminBusy" @click="removeEvaluation(evaluation)">{{ adminBusy === evaluation.id ? 'Eliminando…' : 'Eliminar' }}</button></div></div></div></section>
            <section class="admin-reset"><h2>Borrar todas las evaluaciones</h2><p>Esto elimina todas las respuestas y deja los promedios vacíos. Se conservan los grupos y la estructura de la base de datos. No se puede deshacer.</p><label for="reset-phrase">Escribe <strong>BORRAR TODO</strong> para confirmar</label><div class="reset-controls"><input id="reset-phrase" v-model="resetPhrase" type="text" autocomplete="off" placeholder="BORRAR TODO" /><button type="button" class="danger-button" :disabled="resetPhrase !== 'BORRAR TODO' || !!adminBusy || adminEvaluations.length === 0" @click="resetEvaluations">{{ adminBusy === 'reset' ? 'Borrando…' : 'Borrar todas' }}</button></div></section>
          </template>
          <p v-if="adminError" class="error-message admin-message" role="alert">{{ adminError }}</p><p v-if="adminSuccess" class="admin-success admin-message" role="status">{{ adminSuccess }}</p>
        </div>
      </template>

      <template v-else>
        <section class="page-intro content-wrap results-intro"><p class="eyebrow">Exportación</p><h1>Exportar resultados</h1><p>Descarga un CSV con el promedio y la cantidad de evaluaciones de cada grupo. Elige todas las secciones o una sola.</p></section>
        <div class="content-wrap export-content">
          <div class="export-card">
            <div class="field export-select"><label for="export-section">Sección</label><select id="export-section" v-model="exportSection"><option value="all">Todas las secciones</option><option value="10">Sección 10</option><option value="20">Sección 20</option><option value="30">Sección 30</option></select></div>
            <div class="export-stats"><strong>{{ exportGroups.length }}</strong><span>grupos</span><strong>{{ exportEvaluationCount }}</strong><span>evaluaciones</span></div>
            <button type="button" class="primary-button" :disabled="!exportReady" @click="downloadCsv">Descargar CSV <span aria-hidden="true">↓</span></button>
          </div>
          <p v-if="resultsError" class="error-message results-error" role="alert">{{ resultsError }}</p>
          <p v-if="resultsLoading" class="empty-state">Cargando resultados…</p>
          <template v-else-if="exportReady">
            <div class="export-preview-heading"><h2>Vista previa</h2><p>Una fila por grupo. El promedio queda vacío si todavía no hay evaluaciones.</p></div>
            <div class="export-table-wrap"><table class="export-table"><thead><tr><th>Sección</th><th>Grupo</th><th>Nombre</th><th>Evaluaciones</th><th>Promedio / 8</th></tr></thead><tbody><tr v-for="group in exportGroups" :key="group.id"><td>{{ group.section }}</td><td>{{ group.number }}</td><td>{{ group.name }}</td><td>{{ groupResultById.get(group.id)?.evaluationCount ?? 0 }}</td><td>{{ groupResultById.get(group.id)?.averageCents == null ? '—' : formatPoints(groupResultById.get(group.id)!.averageCents!) }}</td></tr></tbody></table></div>
          </template>
        </div>
      </template>
    </main>
    <footer class="site-footer"><div class="content-wrap"><span>CC3091 · Proyecto de software</span><span>Rúbrica de presentación final · 8 puntos</span></div></footer>
  </div>
</template>
