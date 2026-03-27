import { access, readFile, readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { parsePaperFile } from './paper-file.js'
import { parseQuestionFile } from './question-file.js'
import {
  RightsStatusSchema,
  ReviewStatusSchema,
  type PaperBodyNode,
  type PaperFile,
  type QuestionFile,
} from './types.js'

export type LintCheckStatus = 'pass' | 'warn' | 'fail'

export type LintCheck = {
  id: string
  name: string
  status: LintCheckStatus
  detail: string
}

export type LintSummary = {
  pass: number
  warn: number
  fail: number
  publishable: boolean
}

export type LintQuestionRecord = {
  path: string
  relativePath: string
  referencedInPaper: boolean
  exists: boolean
  source: string
  frontMatter: Record<string, unknown>
  parsed: QuestionFile | null
  parseError: string | null
}

export type LintProjectResult = {
  checks: LintCheck[]
  summary: LintSummary
  paperPath: string
  template: string
  questions: LintQuestionRecord[]
}

const QUESTION_SHORTCODE = /\{\{<\s*question\s+([^>]+?)\s*>\}\}/g
const IMAGE_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/g
const QUESTION_REQUIRED_FIELDS = ['id', 'type', 'subject'] as const
const ALLOWED_RIGHTS = new Set<string>(RightsStatusSchema.options)
const ALLOWED_REVIEW = new Set<string>(ReviewStatusSchema.options)
const PUBLISHABLE_RIGHTS = new Set<string>(['public_domain', 'cc', 'school_owned', 'licensed'])
const PUBLISHABLE_REVIEW = new Set<string>(['approved', 'published'])

type PaperRef = {
  file: string
  score?: number
  attrs?: Record<string, string>
}

export async function lintProject(rootDir: string): Promise<LintProjectResult> {
  const normalizedRoot = path.resolve(rootDir)
  const paperPath = path.join(normalizedRoot, 'paper.qmd')
  const paperSource = await readFile(paperPath, 'utf8')
  const paperFrontMatter = readFrontMatterRecord(paperSource)
  const parsedPaper = safeParsePaper(paperSource)
  const paperRefs = parsedPaper?.nodes
    ? collectPaperRefsFromNodes(parsedPaper.nodes)
    : collectPaperRefsFromSource(paperSource)
  const sectionCount = parsedPaper?.nodes
    ? parsedPaper.nodes.filter((node) => node.type === 'heading' && node.level === 2).length
    : 0
  const emptySectionCount = parsedPaper?.nodes ? countEmptySections(parsedPaper.nodes) : 0
  const questionPaths = uniqueStrings([
    ...(await discoverQuestionPaths(normalizedRoot)),
    ...paperRefs.map((ref) => path.resolve(normalizedRoot, ref.file)),
  ])
  const referencedQuestionPaths = new Set(
    paperRefs.map((ref) => normalizeRelative(normalizedRoot, path.resolve(normalizedRoot, ref.file))),
  )
  const questions = await Promise.all(
    questionPaths.map((questionPath) =>
      inspectQuestion(normalizedRoot, questionPath, referencedQuestionPaths.has(normalizeRelative(normalizedRoot, questionPath))),
    ),
  )

  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()
  const missingRequiredInPaper: string[] = []
  const missingRequiredOutsidePaper: string[] = []
  const invalidRightsInPaper: string[] = []
  const invalidRightsOutsidePaper: string[] = []
  const invalidReviewInPaper: string[] = []
  const invalidReviewOutsidePaper: string[] = []
  const missingSourceInPaper: string[] = []
  const missingSourceOutsidePaper: string[] = []
  const rawOrDraftInPaper: string[] = []
  const rawOrDraftOutsidePaper: string[] = []
  const parseErrorsInPaper: string[] = []
  const parseErrorsOutsidePaper: string[] = []
  const missingAssetsInPaper: string[] = []
  const missingAssetsOutsidePaper: string[] = []
  const blockedRights: string[] = []
  const blockedReview: string[] = []
  const missingAnswers: string[] = []
  const missingAnalysis: string[] = []

  for (const question of questions) {
    if (question.parseError) {
      if (question.referencedInPaper) {
        parseErrorsInPaper.push(`${question.relativePath}: ${question.parseError}`)
      } else {
        parseErrorsOutsidePaper.push(`${question.relativePath}: ${question.parseError}`)
      }
    }

    const id = stringValue(question.frontMatter.id)
    const type = stringValue(question.frontMatter.type)
    const subject = stringValue(question.frontMatter.subject)
    const rights = stringValue(question.frontMatter.rights)
    const review = stringValue(question.frontMatter.review)
    const sourceLabel = nestedStringValue(question.frontMatter.source, 'label')

    if (id) {
      if (seenIds.has(id)) duplicateIds.add(id)
      seenIds.add(id)
    }

    const missing = QUESTION_REQUIRED_FIELDS.filter((field) => !stringValue(question.frontMatter[field]))
    if (missing.length > 0) {
      if (question.referencedInPaper) {
        missingRequiredInPaper.push(`${question.relativePath} (${missing.join(', ')})`)
      } else {
        missingRequiredOutsidePaper.push(`${question.relativePath} (${missing.join(', ')})`)
      }
    }

    if (rights && !ALLOWED_RIGHTS.has(rights)) {
      if (question.referencedInPaper) {
        invalidRightsInPaper.push(`${question.relativePath}: ${rights}`)
      } else {
        invalidRightsOutsidePaper.push(`${question.relativePath}: ${rights}`)
      }
    }
    if (review && !ALLOWED_REVIEW.has(review)) {
      if (question.referencedInPaper) {
        invalidReviewInPaper.push(`${question.relativePath}: ${review}`)
      } else {
        invalidReviewOutsidePaper.push(`${question.relativePath}: ${review}`)
      }
    }
    if (!sourceLabel) {
      if (question.referencedInPaper) {
        missingSourceInPaper.push(question.relativePath)
      } else {
        missingSourceOutsidePaper.push(question.relativePath)
      }
    }
    if (review === 'raw' || review === 'draft') {
      if (question.referencedInPaper) {
        rawOrDraftInPaper.push(question.relativePath)
      } else {
        rawOrDraftOutsidePaper.push(question.relativePath)
      }
    }
    if (question.referencedInPaper && rights && !PUBLISHABLE_RIGHTS.has(rights)) {
      blockedRights.push(`${question.relativePath}: ${rights}`)
    }
    if (question.referencedInPaper && (!review || !PUBLISHABLE_REVIEW.has(review))) {
      blockedReview.push(`${question.relativePath}: ${review || '(missing)'}`)
    }
    if (question.referencedInPaper && !hasQuestionSection(question.parsed, 'answer')) {
      missingAnswers.push(question.relativePath)
    }
    if (question.referencedInPaper && !hasQuestionSection(question.parsed, 'analysis')) {
      missingAnalysis.push(question.relativePath)
    }

    for (const asset of collectAssets(question.source)) {
      const assetPath = path.resolve(path.dirname(question.path), asset)
      if (!(await pathExists(assetPath))) {
        if (question.referencedInPaper) {
          missingAssetsInPaper.push(`${question.relativePath}: ${asset}`)
        } else {
          missingAssetsOutsidePaper.push(`${question.relativePath}: ${asset}`)
        }
      }
    }

    if (!id || !type || !subject) {
      continue
    }
  }

  const discoveredRelativePaths = new Set(
    questions.filter((question) => question.exists).map((question) => normalizeRelative(normalizedRoot, question.path)),
  )
  const missingFiles = paperRefs
    .map((ref) => ref.file)
    .filter((file) => !discoveredRelativePaths.has(normalizeRelative(normalizedRoot, path.resolve(normalizedRoot, file))))
  const duplicateRefs = duplicateStrings(paperRefs.map((ref) => ref.file))
  const unscoredRefs = paperRefs
    .filter((ref) => typeof ref.score !== 'number' || Number.isNaN(ref.score))
    .map((ref) => ref.file)
  const template = nestedStringValue(paperFrontMatter.paperflow, 'template') || 'school-default'
  const templateExists = await pathExists(path.join(normalizedRoot, 'templates', template))
  const paperflowRecord = recordValue(paperFrontMatter.paperflow)
  const paperMode = stringValue(paperflowRecord.mode)
  const paperQuestions = questions.filter((question) => question.referencedInPaper && question.parsed)
  const studentLeaks =
    (paperMode === 'student' || paperMode === 'answer_sheet')
      && (booleanValue(paperflowRecord.show_answer) || booleanValue(paperflowRecord.show_analysis))
  const duplicateSourceLabels = duplicateStrings(
    paperQuestions.map((question) => nestedStringValue(question.frontMatter.source, 'label')).filter(Boolean),
  )
  const denseSourceLabels = countDenseDuplicates(
    paperQuestions.map((question) => nestedStringValue(question.frontMatter.source, 'label')).filter(Boolean),
    3,
  )
  const nearDuplicatePairs = collectNearDuplicatePairs(paperQuestions)
  const blueprintRecord = recordValue(paperflowRecord.blueprint)
  const blueprintDifficulty = readDifficultyDistribution(blueprintRecord.difficultyDistribution)
  const blueprintKnowledge = stringArrayValue(blueprintRecord.knowledgeCoverage)
  const difficultyDelta = computeDifficultyDelta(
    paperQuestions.map((question) => question.parsed?.frontMatter.difficulty).filter(isNumber),
    blueprintDifficulty,
  )
  const missingKnowledge = computeMissingKnowledge(paperQuestions, blueprintKnowledge)
  const answerAreaRisk = collectAnswerAreaRisk(paperRefs, paperQuestions, normalizedRoot)
  const regionPreference = stringArrayValue(blueprintRecord.regionPreference)
  const yearRange = readYearRange(blueprintRecord.yearRange)
  const sourcePreferenceMismatches = collectSourcePreferenceMismatches(paperQuestions, regionPreference, yearRange)

  const checks: LintCheck[] = [
    buildCheck(
      'paper_parse',
      'paper.qmd 解析',
      parsedPaper ? 'pass' : 'fail',
      parsedPaper
        ? `已解析 ${paperRefs.length} 个 question 引用`
        : 'paper.qmd front matter 或 shortcode 解析失败',
    ),
    buildCheck(
      'question_parse',
      '题目文件解析',
      scopedStatus(parseErrorsInPaper, parseErrorsOutsidePaper),
      scopedDetail(
        parseErrorsInPaper,
        parseErrorsOutsidePaper,
        `已解析 ${questions.length} 个 question file`,
        '解析失败',
        '未入卷文件解析失败',
      ),
    ),
    buildCheck(
      'required_fields',
      '题目字段完整性',
      scopedStatus(missingRequiredInPaper, missingRequiredOutsidePaper),
      scopedDetail(
        missingRequiredInPaper,
        missingRequiredOutsidePaper,
        `已检查 ${questions.length} 道题`,
        '缺少 id/type/subject',
        '未入卷文件缺少 id/type/subject',
      ),
    ),
    buildCheck(
      'duplicate_ids',
      '重复题号',
      duplicateIds.size === 0 ? 'pass' : 'fail',
      duplicateIds.size === 0 ? '无重复 id' : `重复 id: ${Array.from(duplicateIds).join(', ')}`,
    ),
    buildCheck(
      'missing_files',
      '引用文件完整性',
      missingFiles.length === 0 ? 'pass' : 'fail',
      missingFiles.length === 0 ? '所有 question file 引用有效' : `缺失文件: ${missingFiles.join(', ')}`,
    ),
    buildCheck(
      'template',
      '模板存在性',
      templateExists ? 'pass' : 'fail',
      templateExists ? `模板 ${template} 可用` : `缺失模板 templates/${template}`,
    ),
    buildCheck(
      'rights',
      'rights 合法性',
      scopedStatus(invalidRightsInPaper, invalidRightsOutsidePaper),
      scopedDetail(
        invalidRightsInPaper,
        invalidRightsOutsidePaper,
        'rights 字段合法',
        'rights 非法',
        '未入卷文件 rights 非法',
      ),
    ),
    buildCheck(
      'review',
      'review 合法性',
      scopedStatus(invalidReviewInPaper, invalidReviewOutsidePaper),
      scopedDetail(
        invalidReviewInPaper,
        invalidReviewOutsidePaper,
        'review 字段合法',
        'review 非法',
        '未入卷文件 review 非法',
      ),
    ),
    buildCheck(
      'source',
      '来源完整性',
      scopedStatus(missingSourceInPaper, missingSourceOutsidePaper),
      scopedDetail(
        missingSourceInPaper,
        missingSourceOutsidePaper,
        '所有入卷题目包含来源',
        '缺少 source.label',
        '未入卷文件缺少 source.label',
      ),
    ),
    buildCheck(
      'section_empty',
      '空 section',
      parsedPaper ? (emptySectionCount === 0 ? 'pass' : 'warn') : 'warn',
      parsedPaper
        ? emptySectionCount === 0
          ? `所有 ${Math.max(sectionCount, 1)} 个 section 均有题目`
          : `${emptySectionCount} 个空 section`
        : 'paper.qmd 未成功解析，跳过 section 检查',
    ),
    buildCheck(
      'score',
      '赋分完整性',
      unscoredRefs.length === 0 ? 'pass' : 'warn',
      unscoredRefs.length === 0 ? '所有题目引用都已赋分' : `${unscoredRefs.length} 个引用缺少 score`,
    ),
    buildCheck(
      'duplicate_refs',
      '重复题引用',
      duplicateRefs.length === 0 ? 'pass' : 'warn',
      duplicateRefs.length === 0 ? '无重复题引用' : `重复引用: ${duplicateRefs.join(', ')}`,
    ),
    buildCheck(
      'raw_review',
      'review=raw/draft',
      rawOrDraftInPaper.length > 0 || rawOrDraftOutsidePaper.length > 0 ? 'warn' : 'pass',
      rawOrDraftInPaper.length > 0
        ? `${rawOrDraftInPaper.length} 道入卷题尚未完成校验`
        : rawOrDraftOutsidePaper.length > 0
          ? `${rawOrDraftOutsidePaper.length} 道未入卷题尚未完成校验`
          : '无 raw/draft 题目',
    ),
    buildCheck(
      'publish_review',
      '正式发布审核门槛',
      blockedReview.length === 0 ? 'pass' : 'fail',
      blockedReview.length === 0
        ? '所有题目 reviewStatus 均满足 approved/published'
        : summarizeList(blockedReview, '未达 approved/published'),
    ),
    buildCheck(
      'publish_rights',
      '正式发布版权门槛',
      blockedRights.length === 0 ? 'pass' : 'fail',
      blockedRights.length === 0
        ? '所有题目 rightsStatus 均可正式发布'
        : summarizeList(blockedRights, '版权状态禁止正式发布'),
    ),
    buildCheck(
      'answer_complete',
      '答案完整性',
      missingAnswers.length === 0 ? 'pass' : 'fail',
      missingAnswers.length === 0 ? '所有题目包含答案' : summarizeList(missingAnswers, '缺少答案'),
    ),
    buildCheck(
      'analysis_complete',
      '解析完整性',
      missingAnalysis.length === 0 ? 'pass' : 'warn',
      missingAnalysis.length === 0 ? '所有题目包含解析' : `${missingAnalysis.length} 道题缺少解析`,
    ),
    buildCheck(
      'assets',
      '资源文件',
      scopedStatus(missingAssetsInPaper, missingAssetsOutsidePaper),
      scopedDetail(
        missingAssetsInPaper,
        missingAssetsOutsidePaper,
        '未发现失效 assets',
        '失效资源',
        '未入卷文件存在失效资源',
      ),
    ),
    buildCheck(
      'student_visibility',
      '学生卷答案泄露',
      studentLeaks ? 'fail' : 'pass',
      studentLeaks ? 'student/answer_sheet 模式下 show_answer 或 show_analysis 仍为 true' : '学生卷模式未发现答案泄露配置',
    ),
    buildCheck(
      'duplicate_source_density',
      '同源题过密',
      denseSourceLabels.length > 0 ? 'warn' : 'pass',
      denseSourceLabels.length > 0
        ? `同一来源重复过密: ${denseSourceLabels.join(', ')}`
        : duplicateSourceLabels.length > 0
          ? `存在重复来源但未超阈值: ${duplicateSourceLabels.join(', ')}`
          : '未发现同源题过密',
    ),
    buildCheck(
      'similarity_density',
      '相似题过密',
      nearDuplicatePairs.length >= 2 ? 'warn' : 'pass',
      nearDuplicatePairs.length > 0 ? summarizeList(nearDuplicatePairs, '高相似题对') : '未发现明显相似题堆积',
    ),
    buildCheck(
      'difficulty_target',
      '难度分布偏差',
      difficultyDelta == null ? 'pass' : difficultyDelta > 0.28 ? 'fail' : difficultyDelta > 0.16 ? 'warn' : 'pass',
      difficultyDelta == null
        ? '未配置 blueprint 难度目标或缺少足够难度数据'
        : `实际分布与 blueprint 最大偏差 ${Math.round(difficultyDelta * 100)}%`,
    ),
    buildCheck(
      'knowledge_target',
      '知识点覆盖偏差',
      missingKnowledge.length === 0 ? 'pass' : missingKnowledge.length >= 2 ? 'fail' : 'warn',
      missingKnowledge.length === 0 ? '已覆盖 blueprint 指定知识点' : `缺失知识点: ${missingKnowledge.join(', ')}`,
    ),
    buildCheck(
      'source_preference',
      '来源偏好偏差',
      sourcePreferenceMismatches.length === 0 ? 'pass' : 'warn',
      sourcePreferenceMismatches.length === 0
        ? '已满足 blueprint 的地区 / 年份偏好'
        : summarizeList(sourcePreferenceMismatches, '偏离来源偏好'),
    ),
    buildCheck(
      'answer_area',
      '答题区与 OCR 风险',
      answerAreaRisk.length === 0 ? 'pass' : 'warn',
      answerAreaRisk.length === 0 ? '主观题答题区配置完整' : summarizeList(answerAreaRisk, '主观题未指定 answer-area-size'),
    ),
  ]

  const summary: LintSummary = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    publishable: checks.every((check) => check.status !== 'fail'),
  }

  return {
    checks,
    summary,
    paperPath,
    template,
    questions,
  }
}

function buildCheck(id: string, name: string, status: LintCheckStatus, detail: string): LintCheck {
  return { id, name, status, detail }
}

function hasQuestionSection(question: QuestionFile | null, name: string) {
  return Boolean(question?.sections.find((section) => section.name === name)?.content.trim())
}

async function inspectQuestion(rootDir: string, questionPath: string, referencedInPaper: boolean): Promise<LintQuestionRecord> {
  const relativePath = normalizeRelative(rootDir, questionPath)

  try {
    const source = await readFile(questionPath, 'utf8')
    const frontMatter = readFrontMatterRecord(source)
    const parsed = safeParseQuestion(source)
    return {
      path: questionPath,
      relativePath,
      referencedInPaper,
      exists: true,
      source,
      frontMatter,
      parsed,
      parseError: parsed ? null : 'question markdown/front matter 解析失败',
    }
  } catch (error) {
    return {
      path: questionPath,
      relativePath,
      referencedInPaper,
      exists: false,
      source: '',
      frontMatter: {},
      parsed: null,
      parseError: error instanceof Error ? error.message : 'question 文件读取失败',
    }
  }
}

async function discoverQuestionPaths(rootDir: string): Promise<string[]> {
  const questionsDir = path.join(rootDir, 'questions')
  try {
    const entries = await readdir(questionsDir, { withFileTypes: true })
    return entries
      .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry: Dirent) => path.join(questionsDir, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

function safeParsePaper(source: string): PaperFile | null {
  try {
    return parsePaperFile(source)
  } catch {
    return null
  }
}

function safeParseQuestion(source: string): QuestionFile | null {
  try {
    return parseQuestionFile(source)
  } catch {
    return null
  }
}

function readFrontMatterRecord(source: string): Record<string, unknown> {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!match?.[1]) return {}

  const parsed = YAML.parse(match[1])
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
}

function collectPaperRefsFromNodes(nodes: PaperBodyNode[]): PaperRef[] {
  return nodes
    .filter((node): node is Extract<PaperBodyNode, { type: 'question' }> => node.type === 'question')
    .map((node) => ({ file: node.file, score: node.score, attrs: node.attrs }))
}

function collectPaperRefsFromSource(source: string): PaperRef[] {
  const refs: PaperRef[] = []

  for (;;) {
    const match = QUESTION_SHORTCODE.exec(source)
    if (!match?.[1]) break
    const attrs = parseAttrs(match[1])
    const file = attrs.file ?? attrs.path
    if (!file) continue
    const score = attrs.score ? Number(attrs.score) : undefined
    refs.push({
      file,
      score: Number.isFinite(score) ? score : undefined,
      attrs,
    })
  }

  return refs
}

function parseAttrs(payload: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const matcher = /([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g

  for (;;) {
    const match = matcher.exec(payload)
    if (!match) break
    const key = match[1]
    const value = match[2]
    if (key) {
      attrs[key] = value.replace(/\\"/g, '"')
    }
  }

  return attrs
}

function countEmptySections(nodes: PaperBodyNode[]): number {
  let emptySections = 0
  let currentHasQuestion = false
  let hasSeenSection = false

  for (const node of nodes) {
    if (node.type === 'heading' && node.level === 2) {
      if (hasSeenSection && !currentHasQuestion) {
        emptySections += 1
      }
      hasSeenSection = true
      currentHasQuestion = false
      continue
    }

    if (node.type === 'question') {
      currentHasQuestion = true
    }
  }

  if (hasSeenSection && !currentHasQuestion) {
    emptySections += 1
  }

  return emptySections
}

function collectAssets(source: string): string[] {
  return Array.from(source.matchAll(IMAGE_PATTERN), (match) => match[1])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function summarizeList(values: string[], label: string): string {
  const uniqueValues = uniqueStrings(values)
  const preview = uniqueValues.slice(0, 5).join(', ')
  return uniqueValues.length <= 5 ? `${label}: ${preview}` : `${label}: ${preview} ...（共 ${uniqueValues.length} 项）`
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }

  return Array.from(duplicates)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function scopedStatus(inPaper: string[], outsidePaper: string[]): LintCheckStatus {
  if (inPaper.length > 0) return 'fail'
  if (outsidePaper.length > 0) return 'warn'
  return 'pass'
}

function scopedDetail(
  inPaper: string[],
  outsidePaper: string[],
  passDetail: string,
  failLabel: string,
  warnLabel: string,
): string {
  if (inPaper.length > 0) {
    return summarizeList(inPaper, failLabel)
  }
  if (outsidePaper.length > 0) {
    return summarizeList(outsidePaper, warnLabel)
  }
  return passDetail
}

function countDenseDuplicates(values: string[], threshold: number): string[] {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return Array.from(counts.entries())
    .filter(([, count]) => count >= threshold)
    .map(([value, count]) => `${value} × ${count}`)
}

function collectNearDuplicatePairs(questions: LintQuestionRecord[]): string[] {
  const pairs: string[] = []
  for (let index = 0; index < questions.length; index += 1) {
    const current = questions[index]?.parsed
    if (!current) continue
    for (let offset = index + 1; offset < questions.length; offset += 1) {
      const candidate = questions[offset]?.parsed
      if (!candidate) continue
      if (current.frontMatter.type !== candidate.frontMatter.type) continue
      const currentKnowledge = new Set(current.frontMatter.knowledge ?? [])
      const sharedKnowledge = (candidate.frontMatter.knowledge ?? []).filter((item) => currentKnowledge.has(item))
      const sameSource = nestedStringValue(current.frontMatter.source, 'label')
        && nestedStringValue(current.frontMatter.source, 'label') === nestedStringValue(candidate.frontMatter.source, 'label')
      if (sharedKnowledge.length > 0 && sameSource) {
        pairs.push(`${current.frontMatter.id} ~ ${candidate.frontMatter.id}`)
      }
    }
  }
  return uniqueStrings(pairs)
}

function readDifficultyDistribution(value: unknown) {
  const record = recordValue(value)
  const easy = Number(record.easy)
  const medium = Number(record.medium)
  const hard = Number(record.hard)
  if (!Number.isFinite(easy) || !Number.isFinite(medium) || !Number.isFinite(hard)) return null
  const total = easy + medium + hard
  if (total <= 0) return null
  return {
    easy: easy / total,
    medium: medium / total,
    hard: hard / total,
  }
}

function computeDifficultyDelta(values: number[], target: { easy: number; medium: number; hard: number } | null) {
  if (!target || values.length === 0) return null
  const buckets = { easy: 0, medium: 0, hard: 0 }
  values.forEach((value) => {
    if (value <= 0.4) buckets.easy += 1
    else if (value <= 0.7) buckets.medium += 1
    else buckets.hard += 1
  })
  const actual = {
    easy: buckets.easy / values.length,
    medium: buckets.medium / values.length,
    hard: buckets.hard / values.length,
  }
  return Math.max(
    Math.abs(actual.easy - target.easy),
    Math.abs(actual.medium - target.medium),
    Math.abs(actual.hard - target.hard),
  )
}

function computeMissingKnowledge(questions: LintQuestionRecord[], targetKnowledge: string[]) {
  if (targetKnowledge.length === 0) return []
  const existing = new Set(
    questions.flatMap((question) => question.parsed?.frontMatter.knowledge ?? []),
  )
  return targetKnowledge.filter((item) => !existing.has(item))
}

function collectAnswerAreaRisk(paperRefs: PaperRef[], paperQuestions: LintQuestionRecord[], rootDir: string) {
  const subjectiveTypes = new Set(['short_answer', 'essay', 'proof', 'computation', 'composite'])
  const questionByRelative = new Map(paperQuestions.map((question) => [question.relativePath, question]))
  return paperRefs.flatMap((ref) => {
    const relativePath = normalizeRelative(rootDir, path.resolve(rootDir, ref.file))
    const question = questionByRelative.get(relativePath)?.parsed
    if (!question) return []
    if (!subjectiveTypes.has(question.frontMatter.type)) return []
    const answerAreaSize = ref.attrs?.['answer-area-size'] ?? question.frontMatter.layout?.answer_area_size
    return answerAreaSize ? [] : [question.frontMatter.id]
  })
}

function readYearRange(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [start, end] = value
  if (!isNumber(start) || !isNumber(end)) return null
  return [start, end]
}

function collectSourcePreferenceMismatches(
  questions: LintQuestionRecord[],
  regions: string[],
  yearRange: [number, number] | null,
) {
  if (regions.length === 0 && !yearRange) return []
  return questions.flatMap((question) => {
    const source = recordValue(question.frontMatter.source)
    const problems: string[] = []
    const region = stringValue(source.region)
    const year = Number(source.year)
    if (regions.length > 0 && region && !regions.includes(region)) {
      problems.push(`${question.relativePath}: region=${region}`)
    }
    if (yearRange && Number.isFinite(year) && (year < yearRange[0] || year > yearRange[1])) {
      problems.push(`${question.relativePath}: year=${year}`)
    }
    return problems
  })
}

function nestedStringValue(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') return ''
  return stringValue((value as Record<string, unknown>)[key])
}

function normalizeRelative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/')
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}
