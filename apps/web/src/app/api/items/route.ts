import path from 'node:path'
import { NextRequest } from 'next/server'
import { questionFromMarkdown, readProject, savePaper, saveQuestion } from '@/lib/workspace/project'
import { resolveProjectFile, resolveProjectPath, slugifyQuestionId, toPosixPath } from '@/lib/workspace/paths'
import { questionToWorkspaceQuestion } from '@/lib/workspace/view-model'
import type { QuestionFile } from '@/lib/workspace/types'

type SearchTier = 'exact' | 'replacement' | 'parallel'

type RankedQuestion = {
  question: QuestionFile
  tier?: SearchTier
  score: number
  reason?: string
  similarCount: number
}

type SampleProjectContext = {
  subject?: string
  grade?: string
  questionTypes: Set<string>
  knowledge: Set<string>
  region?: string
  yearRange?: [number, number]
}

function questionHaystack(question: QuestionFile) {
  return [
    question.id,
    question.subject,
    question.grade,
    question.type,
    question.stem,
    question.answer,
    question.analysis,
    question.source.label ?? '',
    question.source.exam ?? '',
    question.source.region ?? '',
    question.knowledge.join(' '),
    question.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

function tokenizeQuery(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[\s,，。；;、/|]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  )
}

function scoreQueryMatch(question: QuestionFile, query: string) {
  if (!query.trim()) return 0
  const haystack = questionHaystack(question)
  const normalized = query.trim().toLowerCase()
  const tokens = tokenizeQuery(normalized)
  let score = 0

  if (haystack.includes(normalized)) score += 8
  tokens.forEach((token) => {
    if (haystack.includes(token)) score += 2
  })

  if (question.id.toLowerCase() === normalized) score += 8
  if ((question.source.label ?? '').toLowerCase().includes(normalized)) score += 4
  return score
}

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item)).length
}

function similarityScore(base: QuestionFile, candidate: QuestionFile) {
  let score = 0
  const sharedKnowledge = overlapCount(base.knowledge, candidate.knowledge)

  if (base.subject === candidate.subject) score += 2
  if (base.grade === candidate.grade) score += 2
  if (base.type === candidate.type) score += 4
  score += sharedKnowledge * 2

  if (base.difficulty != null && candidate.difficulty != null) {
    score += Math.max(0, 2 - Math.abs(base.difficulty - candidate.difficulty) * 5)
  }

  if (base.source.label && candidate.source.label && base.source.label !== candidate.source.label) {
    score += 1
  }

  return {
    score,
    sharedKnowledge,
    sameType: base.type === candidate.type,
    differentSource: Boolean(base.source.label && candidate.source.label && base.source.label !== candidate.source.label),
  }
}

function countSimilarItems(current: QuestionFile, questions: QuestionFile[]) {
  return questions.filter((candidate) => {
    if (candidate.id === current.id) return false
    const similarity = similarityScore(current, candidate)
    return similarity.sameType && (similarity.sharedKnowledge > 0 || similarity.score >= 8)
  }).length
}

function rankQuestion(
  question: QuestionFile,
  allQuestions: QuestionFile[],
  query: string,
  relatedQuestion?: QuestionFile,
  sampleProject?: SampleProjectContext,
): RankedQuestion | null {
  const queryScore = scoreQueryMatch(question, query)
  const related = relatedQuestion ? similarityScore(relatedQuestion, question) : null
  const similarCount = countSimilarItems(question, allQuestions)
  let sampleScore = 0
  let sampleReason: string | undefined

  if (sampleProject) {
    if (sampleProject.questionTypes.has(question.type)) sampleScore += 3
    const sharedKnowledge = question.knowledge.filter((entry) => sampleProject.knowledge.has(entry))
    sampleScore += sharedKnowledge.length * 2
    if (sampleProject.subject && question.subject === sampleProject.subject) sampleScore += 1
    if (sampleProject.grade && question.grade === sampleProject.grade) sampleScore += 1
    if (sampleProject.region && question.source.region === sampleProject.region) sampleScore += 1
    if (
      sampleProject.yearRange
      && typeof question.source.year === 'number'
      && question.source.year >= sampleProject.yearRange[0]
      && question.source.year <= sampleProject.yearRange[1]
    ) {
      sampleScore += 1
    }
    if (sampleScore > 0) {
      sampleReason = sharedKnowledge.length > 0
        ? `命中样卷结构，知识点重合 ${sharedKnowledge.length} 项`
        : '命中样卷题型 / 来源偏好'
    }
  }

  if (!query.trim() && !relatedQuestion && !sampleProject) {
    return {
      question,
      score: question.review === 'approved' ? 4 : 0,
      similarCount,
    } satisfies RankedQuestion
  }

  if (queryScore >= 8) {
    return {
      question,
      tier: 'exact',
      score: queryScore + (related?.score ?? 0) + sampleScore,
      reason: '命中关键词或来源信息',
      similarCount,
    } satisfies RankedQuestion
  }

  if (related && related.sameType && (related.sharedKnowledge > 0 || related.score >= 9)) {
    return {
      question,
      tier: 'replacement',
      score: related.score + queryScore + sampleScore,
      reason: `与当前题同题型，知识点重合 ${related.sharedKnowledge} 项`,
      similarCount,
    } satisfies RankedQuestion
  }

  if (related && related.sameType && related.differentSource) {
    return {
      question,
      tier: 'parallel',
      score: related.score + queryScore + sampleScore,
      reason: '同题型但来源不同，适合作为平行卷候选',
      similarCount,
    } satisfies RankedQuestion
  }

  if (sampleProject && sampleScore > 0) {
    return {
      question,
      tier: queryScore > 0 ? 'replacement' : 'parallel',
      score: sampleScore + queryScore,
      reason: sampleReason,
      similarCount,
    } satisfies RankedQuestion
  }

  if (queryScore > 0) {
    return {
      question,
      tier: 'replacement',
      score: queryScore,
      reason: '匹配到部分关键词',
      similarCount,
    } satisfies RankedQuestion
  }

  return null
}

function toQuestionDraft(projectPath: string, input: Record<string, unknown>): QuestionFile {
  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `q-${Date.now()}`
  const relativePath = typeof input.relativePath === 'string' && input.relativePath.trim()
    ? input.relativePath.trim()
    : typeof input.sourcePath === 'string' && input.sourcePath.trim()
      ? input.sourcePath.trim()
    : toPosixPath(path.join('questions', `${slugifyQuestionId(id)}.md`))
  const absolutePath = resolveProjectFile(projectPath, relativePath)

  return {
    id,
    path: absolutePath,
    relativePath,
    type: typeof input.type === 'string' && input.type.trim() ? input.type.trim() : 'single_choice',
    subject: typeof input.subject === 'string' && input.subject.trim() ? input.subject.trim() : 'math',
    grade: typeof input.grade === 'string' && input.grade.trim() ? input.grade.trim() : 'high-1',
    difficulty: typeof input.difficulty === 'number' ? input.difficulty : 0.5,
    scoreSuggest: typeof input.scoreSuggest === 'number' ? input.scoreSuggest : 5,
    knowledge: Array.isArray(input.knowledge) ? input.knowledge.filter((value): value is string => typeof value === 'string') : [],
    source: typeof input.source === 'object' && input.source
      ? {
          label: typeof (input.source as { label?: unknown }).label === 'string' ? (input.source as { label: string }).label : '',
          year: typeof (input.source as { year?: unknown }).year === 'number' ? (input.source as { year: number }).year : undefined,
          region: typeof (input.source as { region?: unknown }).region === 'string' ? (input.source as { region: string }).region : undefined,
        }
      : {
          label: typeof input.sourceLabel === 'string' ? input.sourceLabel : '',
        },
    rights: typeof input.rights === 'string' && input.rights.trim() ? input.rights.trim() : 'school_owned',
    review: typeof input.review === 'string' && input.review.trim()
      ? input.review.trim()
      : typeof input.status === 'string' && input.status.trim()
        ? input.status.trim()
        : 'draft',
    tags: Array.isArray(input.tags) ? input.tags.filter((value): value is string => typeof value === 'string') : [],
    layout: typeof input.layout === 'object' && input.layout
      ? {
          optionCols: typeof (input.layout as { optionCols?: unknown }).optionCols === 'number'
            ? (input.layout as { optionCols: number }).optionCols
            : undefined,
          keepWithNext: typeof (input.layout as { keepWithNext?: unknown }).keepWithNext === 'boolean'
            ? (input.layout as { keepWithNext: boolean }).keepWithNext
            : false,
          forcePageBreakBefore: typeof (input.layout as { forcePageBreakBefore?: unknown }).forcePageBreakBefore === 'boolean'
            ? (input.layout as { forcePageBreakBefore: boolean }).forcePageBreakBefore
            : false,
        }
      : {},
    stem: typeof input.stem === 'string' ? input.stem : '',
    options: Array.isArray(input.options)
      ? input.options
          .filter((entry): entry is { label?: unknown; text?: unknown } => !!entry && typeof entry === 'object')
          .map((entry, index) => ({
            label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : String.fromCharCode(65 + index),
            text: typeof entry.text === 'string' ? entry.text : '',
          }))
      : [],
    answer: typeof input.answer === 'string' ? input.answer : '',
    analysis: typeof input.analysis === 'string' ? input.analysis : '',
    frontmatter: {},
  }
}

function mergeQuestion(existing: QuestionFile, body: Record<string, unknown>) {
  const nextSourceLabel = typeof body.sourceLabel === 'string'
    ? body.sourceLabel
    : existing.source.label
  const nextReview = typeof body.status === 'string'
    ? body.status
    : typeof body.review === 'string'
      ? body.review
      : existing.review

  return {
    ...existing,
    subject: typeof body.subject === 'string' ? body.subject : existing.subject,
    grade: typeof body.grade === 'string' ? body.grade : existing.grade,
    type: typeof body.type === 'string' ? body.type : existing.type,
    source: {
      ...existing.source,
      label: nextSourceLabel,
      year: typeof body.sourceYear === 'number' ? body.sourceYear : existing.source.year,
      region: typeof body.sourceRegion === 'string' ? body.sourceRegion : existing.source.region,
      exam: typeof body.sourceExam === 'string' ? body.sourceExam : existing.source.exam,
    },
    review: nextReview,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((value): value is string => typeof value === 'string')
      : existing.tags,
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const projectPath = resolveProjectPath(params.get('projectPath'))
  const query = params.get('q')?.trim()
  const subject = params.get('subject')?.trim()
  const grade = params.get('grade')?.trim()
  const type = params.get('type')?.trim()
  const review = params.get('review')?.trim()
  const rights = params.get('rights')?.trim()
  const knowledge = params.get('knowledge')?.trim()
  const relatedToQuestionId = params.get('relatedToQuestionId')?.trim()
  const blueprintSubject = params.get('blueprintSubject')?.trim()
  const blueprintGrade = params.get('blueprintGrade')?.trim()
  const sampleProjectPath = params.get('sampleProjectPath')?.trim()
  const limit = Math.max(1, Math.min(200, Number(params.get('limit') ?? 50) || 50))

  const snapshot = await readProject(projectPath)
  const usedFiles = new Set(
    snapshot.paper.sections.flatMap((section) => section.questions.map((question) => question.file)),
  )
  const relatedQuestion = relatedToQuestionId
    ? snapshot.questions.find((question) => question.id === relatedToQuestionId)
    : undefined
  const sampleProject = sampleProjectPath
    ? await readProject(resolveProjectPath(sampleProjectPath))
    : undefined
  const sampleContext: SampleProjectContext | undefined = sampleProject
    ? {
        subject: sampleProject.paper.frontmatter.subject as string | undefined,
        grade: sampleProject.paper.frontmatter.grade as string | undefined,
        questionTypes: new Set(
          sampleProject.paper.sections.flatMap((section) =>
            section.questions
              .map((entry) => sampleProject.questions.find((question) => question.relativePath === entry.file)?.type)
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        knowledge: new Set(sampleProject.questions.flatMap((question) => question.knowledge)),
        region: sampleProject.questions.map((question) => question.source.region).find(Boolean),
        yearRange: (() => {
          const years = sampleProject.questions
            .map((question) => question.source.year)
            .filter((year): year is number => typeof year === 'number')
          return years.length > 0 ? [Math.min(...years), Math.max(...years)] as [number, number] : undefined
        })(),
      }
    : undefined
  const filtered = snapshot.questions.filter((question) => {
    if (query && scoreQueryMatch(question, query) <= 0 && !relatedQuestion && !sampleContext) return false
    if (subject && question.subject !== subject) return false
    if (grade && question.grade !== grade) return false
    if (type && question.type !== type) return false
    if (review && question.review !== review) return false
    if (rights && question.rights !== rights) return false
    if (knowledge && !question.knowledge.includes(knowledge) && !question.tags.includes(knowledge)) return false
    if (!query && !subject && blueprintSubject && question.subject !== blueprintSubject) return false
    if (!query && !grade && blueprintGrade && question.grade !== blueprintGrade) return false
    if (!query && !subject && !blueprintSubject && sampleContext?.subject && question.subject !== sampleContext.subject) return false
    if (!query && !grade && !blueprintGrade && sampleContext?.grade && question.grade !== sampleContext.grade) return false
    if (relatedQuestion && question.id === relatedQuestion.id) return false
    return true
  })
  const ranked = filtered
    .map((question) => rankQuestion(question, snapshot.questions, query ?? '', relatedQuestion, sampleContext))
    .filter((entry): entry is RankedQuestion => entry !== null)
    .sort((left, right) => {
      const tierRank = { exact: 0, replacement: 1, parallel: 2, undefined: 3 }
      const leftTier = left.tier ?? 'undefined'
      const rightTier = right.tier ?? 'undefined'
      if (tierRank[leftTier] !== tierRank[rightTier]) {
        return tierRank[leftTier] - tierRank[rightTier]
      }
      return right.score - left.score
    })
    .slice(0, limit)
  const items = ranked.map(({ question, tier, reason, similarCount }) => ({
    ...questionToWorkspaceQuestion(question),
    usedInPaper: usedFiles.has(question.relativePath),
    matchTier: tier,
    matchReason: reason,
    similarCount,
  }))

  return Response.json({
    items,
    total: items.length,
    relatedToQuestionId,
    sampleProjectPath,
  })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectPath?: string
    question?: Record<string, unknown>
    sectionId?: string
  }
  const projectPath = resolveProjectPath(body.projectPath)
  const snapshot = await readProject(projectPath)
  const question = typeof body.question?.markdown === 'string'
    ? questionFromMarkdown(
        projectPath,
        typeof body.question.sourcePath === 'string' && body.question.sourcePath.trim()
          ? body.question.sourcePath
          : `questions/${slugifyQuestionId(typeof body.question.id === 'string' ? body.question.id : `q-${Date.now()}`)}.md`,
        body.question.markdown,
      )
    : toQuestionDraft(projectPath, body.question ?? {})
  const saved = await saveQuestion(projectPath, mergeQuestion(question, body.question ?? {}))

  if (body.sectionId) {
    snapshot.paper.sections = snapshot.paper.sections.map((section) =>
      section.id === body.sectionId
        ? {
            ...section,
            questions: [
              ...section.questions,
              {
                file: saved.relativePath,
                score: saved.scoreSuggest,
                locked: false,
                hiddenParts: [],
                layoutHints: undefined,
              },
            ],
          }
        : section,
    )
    await savePaper(projectPath, snapshot.paper)
  }

  return Response.json(questionToWorkspaceQuestion(saved), { status: 201 })
}
