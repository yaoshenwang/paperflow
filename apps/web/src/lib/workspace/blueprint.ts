import type { ProjectSnapshot, WorkspaceBlueprint, WorkspaceBlueprintDifficulty, WorkspaceMode } from './types'

const OUTPUT_MODES: WorkspaceMode[] = ['student', 'teacher', 'answer_sheet', 'solution_book']
const REGION_TOKENS = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '全国',
  '江苏',
  '浙江',
  '广东',
  '山东',
  '四川',
  '湖北',
  '湖南',
  '河北',
  '河南',
  '陕西',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return items.length > 0 ? Array.from(new Set(items)) : undefined
}

function clampUnit(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeDifficulty(value: unknown): WorkspaceBlueprintDifficulty | undefined {
  const record = asRecord(value)
  const easy = numberValue(record.easy)
  const medium = numberValue(record.medium)
  const hard = numberValue(record.hard)

  if (easy == null || medium == null || hard == null) return undefined
  const total = easy + medium + hard
  if (total <= 0) return undefined

  return {
    easy: clampUnit(easy / total, 0.6),
    medium: clampUnit(medium / total, 0.3),
    hard: clampUnit(hard / total, 0.1),
  }
}

function normalizeSectionSpecs(value: unknown, fallback: WorkspaceBlueprint['sections']) {
  if (!Array.isArray(value)) return fallback
  const sections = value
    .map((entry) => {
      const record = asRecord(entry)
      const questionType = textValue(record.questionType)
      const count = Math.max(1, Math.round(numberValue(record.count) ?? 0))
      const scorePerItem = Math.max(0, numberValue(record.scorePerItem) ?? 0)
      if (!questionType) return null
      return {
        questionType,
        count,
        scorePerItem,
      }
    })
    .filter((entry): entry is WorkspaceBlueprint['sections'][number] => Boolean(entry))

  return sections.length > 0 ? sections : fallback
}

function normalizeOutputModes(value: unknown, fallback: WorkspaceMode[]) {
  if (!Array.isArray(value)) return fallback
  const modes = value.filter((entry): entry is WorkspaceMode => OUTPUT_MODES.includes(entry as WorkspaceMode))
  return modes.length > 0 ? Array.from(new Set(modes)) : fallback
}

function bucketDifficulty(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  if (value <= 0.4) return 'easy'
  if (value <= 0.7) return 'medium'
  return 'hard'
}

function buildDefaultSections(snapshot: ProjectSnapshot) {
  const questionByPath = new Map(snapshot.questions.map((question) => [question.relativePath, question]))
  const grouped = new Map<string, { count: number; scoreTotal: number }>()

  snapshot.paper.sections.forEach((section) => {
    section.questions.forEach((entry) => {
      const question = questionByPath.get(entry.file)
      const questionType = question?.type ?? 'essay'
      const current = grouped.get(questionType) ?? { count: 0, scoreTotal: 0 }
      current.count += 1
      current.scoreTotal += entry.score ?? question?.scoreSuggest ?? 0
      grouped.set(questionType, current)
    })
  })

  const sections = Array.from(grouped.entries()).map(([questionType, stats]) => ({
    questionType,
    count: stats.count,
    scorePerItem: stats.count > 0 ? Number((stats.scoreTotal / stats.count).toFixed(2)) : 0,
  }))

  return sections.length > 0
    ? sections
    : [{
        questionType: snapshot.questions[0]?.type ?? 'essay',
        count: 0,
        scorePerItem: snapshot.questions[0]?.scoreSuggest ?? 0,
      }]
}

export function deriveWorkspaceBlueprint(snapshot: ProjectSnapshot): WorkspaceBlueprint {
  const questionByPath = new Map(snapshot.questions.map((question) => [question.relativePath, question]))
  const referenced = snapshot.paper.sections.flatMap((section) =>
    section.questions
      .map((entry) => questionByPath.get(entry.file))
      .filter((question): question is ProjectSnapshot['questions'][number] => Boolean(question)),
  )
  const totalScore = snapshot.paper.sections.reduce(
    (sum, section) =>
      sum + section.questions.reduce((sectionSum, question) => sectionSum + (question.score ?? 0), 0),
    0,
  )
  const buckets = { easy: 0, medium: 0, hard: 0 }
  const knowledge = new Set<string>()
  const regions = new Set<string>()
  const years: number[] = []

  referenced.forEach((question) => {
    const bucket = bucketDifficulty(question.difficulty)
    if (bucket) buckets[bucket] += 1
    question.knowledge.forEach((item) => knowledge.add(item))
    if (question.source.region) regions.add(question.source.region)
    if (typeof question.source.year === 'number') years.push(question.source.year)
  })

  const difficultyTotal = buckets.easy + buckets.medium + buckets.hard

  return {
    subject: textValue(snapshot.paper.frontmatter.subject, referenced[0]?.subject ?? snapshot.questions[0]?.subject ?? ''),
    grade: textValue(snapshot.paper.frontmatter.grade, referenced[0]?.grade ?? snapshot.questions[0]?.grade ?? ''),
    totalScore,
    sections: buildDefaultSections(snapshot),
    difficultyDistribution: difficultyTotal > 0
      ? {
          easy: Number((buckets.easy / difficultyTotal).toFixed(3)),
          medium: Number((buckets.medium / difficultyTotal).toFixed(3)),
          hard: Number((buckets.hard / difficultyTotal).toFixed(3)),
        }
      : undefined,
    knowledgeCoverage: knowledge.size > 0 ? Array.from(knowledge) : undefined,
    regionPreference: regions.size > 0 ? Array.from(regions) : undefined,
    yearRange: years.length > 0 ? [Math.min(...years), Math.max(...years)] : undefined,
    outputModes: [snapshot.paper.paperflow.mode],
  }
}

export function normalizeWorkspaceBlueprint(raw: unknown, snapshot: ProjectSnapshot): WorkspaceBlueprint {
  const fallback = deriveWorkspaceBlueprint(snapshot)
  const record = asRecord(raw)

  return {
    intent: textValue(record.intent),
    subject: textValue(record.subject, fallback.subject),
    grade: textValue(record.grade, fallback.grade),
    totalScore: Math.max(0, numberValue(record.totalScore) ?? fallback.totalScore),
    duration: numberValue(record.duration) ?? fallback.duration,
    sections: normalizeSectionSpecs(record.sections, fallback.sections),
    difficultyDistribution: normalizeDifficulty(record.difficultyDistribution) ?? fallback.difficultyDistribution,
    knowledgeCoverage: stringArray(record.knowledgeCoverage) ?? fallback.knowledgeCoverage,
    sourcePreference: stringArray(record.sourcePreference),
    excludedSources: stringArray(record.excludedSources),
    excludedKnowledge: stringArray(record.excludedKnowledge),
    regionPreference: stringArray(record.regionPreference) ?? fallback.regionPreference,
    yearRange: Array.isArray(record.yearRange) && record.yearRange.length === 2
      && typeof record.yearRange[0] === 'number' && typeof record.yearRange[1] === 'number'
      ? [record.yearRange[0], record.yearRange[1]]
      : fallback.yearRange,
    parallelVersions: numberValue(record.parallelVersions),
    outputModes: normalizeOutputModes(record.outputModes, fallback.outputModes ?? OUTPUT_MODES),
  }
}

function parseQuestionTypeIntent(intent: string) {
  const sections: WorkspaceBlueprint['sections'] = []
  const specs: Array<{ pattern: RegExp; questionType: string; scorePerItem: number }> = [
    { pattern: /选择题?\s*(\d+)\s*道/g, questionType: 'single_choice', scorePerItem: 5 },
    { pattern: /填空题?\s*(\d+)\s*道/g, questionType: 'fill_blank', scorePerItem: 5 },
    { pattern: /(?:解答|计算)题?\s*(\d+)\s*道/g, questionType: 'computation', scorePerItem: 12 },
    { pattern: /证明题?\s*(\d+)\s*道/g, questionType: 'proof', scorePerItem: 12 },
    { pattern: /简答题?\s*(\d+)\s*道/g, questionType: 'short_answer', scorePerItem: 8 },
  ]

  specs.forEach(({ pattern, questionType, scorePerItem }) => {
    const match = pattern.exec(intent)
    if (!match?.[1]) return
    sections.push({
      questionType,
      count: Math.max(1, Number(match[1])),
      scorePerItem,
    })
  })

  return sections
}

function parseKnowledgeTokens(intent: string) {
  const matches = Array.from(intent.matchAll(/([\u4e00-\u9fa5A-Za-z0-9]+(?:[\/、][\u4e00-\u9fa5A-Za-z0-9]+)+)/g))
  const tokens = matches
    .flatMap((match) => match[1]?.split(/[\/、]/g) ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 1)

  return tokens.length > 0 ? Array.from(new Set(tokens)) : undefined
}

function parseDifficultyDistribution(intent: string) {
  const match = intent.match(/难度\s*(\d+)\s*[:：]\s*(\d+)\s*[:：]\s*(\d+)/)
  if (!match) return undefined
  const easy = Number(match[1])
  const medium = Number(match[2])
  const hard = Number(match[3])
  const total = easy + medium + hard
  if (total <= 0) return undefined
  return {
    easy: Number((easy / total).toFixed(3)),
    medium: Number((medium / total).toFixed(3)),
    hard: Number((hard / total).toFixed(3)),
  }
}

function parseYearRange(intent: string) {
  const explicit = intent.match(/(20\d{2})\s*[-到至]\s*(20\d{2})/)
  if (explicit) {
    return [Number(explicit[1]), Number(explicit[2])] as [number, number]
  }

  const recent = intent.match(/近\s*(\d+)\s*年/)
  if (!recent?.[1]) return undefined
  const years = Math.max(1, Number(recent[1]))
  const end = new Date().getFullYear()
  return [end - years + 1, end] as [number, number]
}

function parseRegions(intent: string) {
  const regions = REGION_TOKENS.filter((token) => intent.includes(token))
  return regions.length > 0 ? regions : undefined
}

function parseExcludedSources(intent: string) {
  const matches = Array.from(intent.matchAll(/不要([^，。；]+)/g))
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean)
  return matches.length > 0 ? Array.from(new Set(matches)) : undefined
}

function parseSourcePreference(intent: string) {
  const preferences: string[] = []
  if (/真题优先/.test(intent)) preferences.push('真题')
  if (/校本/.test(intent)) preferences.push('校本题库')
  if (/模拟/.test(intent) && /优先/.test(intent)) preferences.push('模拟题')
  return preferences.length > 0 ? preferences : undefined
}

function parseOutputModes(intent: string) {
  const modes = new Set<WorkspaceMode>()
  if (/学生卷/.test(intent)) modes.add('student')
  if (/教师卷/.test(intent)) modes.add('teacher')
  if (/答题卡/.test(intent)) modes.add('answer_sheet')
  if (/解析册/.test(intent)) modes.add('solution_book')
  return modes.size > 0 ? Array.from(modes) : OUTPUT_MODES
}

export function blueprintFromIntent(intent: string, fallback?: Partial<WorkspaceBlueprint>) {
  const trimmedIntent = intent.trim()
  const subjectMatch = trimmedIntent.match(/(数学|语文|英语|物理|化学|生物|历史|地理|政治)/)
  const gradeMatch = trimmedIntent.match(/(高一|高二|高三|初一|初二|初三|七年级|八年级|九年级)/)
  const totalScoreMatch = trimmedIntent.match(/(\d+)\s*分/)
  const durationMatch = trimmedIntent.match(/(\d+)\s*(分钟|min)/i)
  const sections = parseQuestionTypeIntent(trimmedIntent)
  const totalScore = totalScoreMatch?.[1]
    ? Number(totalScoreMatch[1])
    : sections.reduce((sum, section) => sum + section.count * section.scorePerItem, 0)

  const blueprint: WorkspaceBlueprint = {
    intent: trimmedIntent,
    subject: subjectMatch?.[1] ?? fallback?.subject ?? '数学',
    grade: gradeMatch?.[1] ?? fallback?.grade ?? '高一',
    totalScore: totalScore || fallback?.totalScore || 100,
    duration: durationMatch?.[1] ? Number(durationMatch[1]) : fallback?.duration ?? 120,
    sections: sections.length > 0 ? sections : fallback?.sections ?? [],
    difficultyDistribution: parseDifficultyDistribution(trimmedIntent) ?? fallback?.difficultyDistribution,
    knowledgeCoverage: parseKnowledgeTokens(trimmedIntent) ?? fallback?.knowledgeCoverage,
    sourcePreference: parseSourcePreference(trimmedIntent) ?? fallback?.sourcePreference,
    excludedSources: parseExcludedSources(trimmedIntent) ?? fallback?.excludedSources,
    excludedKnowledge: fallback?.excludedKnowledge,
    regionPreference: parseRegions(trimmedIntent) ?? fallback?.regionPreference,
    yearRange: parseYearRange(trimmedIntent) ?? fallback?.yearRange,
    parallelVersions: /平行卷|AB卷|A卷B卷/.test(trimmedIntent)
      ? Math.max(2, fallback?.parallelVersions ?? 2)
      : fallback?.parallelVersions,
    outputModes: parseOutputModes(trimmedIntent),
  }

  const questionCount = blueprint.sections.reduce((sum, section) => sum + section.count, 0)
  const explanation = [
    `${blueprint.subject}${blueprint.grade}`,
    `总分 ${blueprint.totalScore}`,
    blueprint.duration ? `${blueprint.duration} 分钟` : null,
    questionCount > 0 ? `${questionCount} 道题` : null,
    blueprint.regionPreference?.length ? `${blueprint.regionPreference.join(' / ')} 优先` : null,
  ].filter(Boolean).join('，')

  return { blueprint, explanation: explanation || '已生成基础组卷蓝图。' }
}
