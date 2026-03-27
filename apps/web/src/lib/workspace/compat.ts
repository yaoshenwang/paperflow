import type { Block, PaperProject, QuestionClip, QuestionItem, SectionNode } from '@paperflow/schema'
import { normalizeWorkspaceBlueprint } from './blueprint'
import type { ProjectSnapshot, QuestionFile, WorkspaceMode } from './types'
import { createQuestionSummary } from './project'

const RIGHTS_MAP = new Set(['public_domain', 'cc', 'school_owned', 'licensed', 'restricted', 'prohibited'])
const REVIEW_MAP = new Set(['raw', 'draft', 'parsed', 'tagged', 'checked', 'approved', 'published', 'archived'])
const MATH_COMMANDS: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  log: 'log',
  ln: 'ln',
  sqrt: 'sqrt',
  pi: 'pi',
  alpha: 'alpha',
  beta: 'beta',
  gamma: 'gamma',
  theta: 'theta',
  lambda: 'lambda',
  mu: 'mu',
  sigma: 'sigma',
  Delta: 'Delta',
  delta: 'delta',
  times: 'times',
  cdot: 'dot',
  leq: '<=',
  geq: '>=',
  neq: '!=',
  approx: 'approx',
  infty: 'infinity',
}

function normalizeRenderTemplatePreset(value?: string) {
  switch ((value ?? '').trim()) {
    case 'exam-standard':
    case 'exam_standard':
    case 'school-default':
      return 'exam_standard'
    case 'teacher-annotated':
    case 'teacher_annotated':
      return 'teacher_annotated'
    case 'answer-sheet':
    case 'answer_sheet':
      return 'answer_sheet'
    case 'practice-compact':
    case 'practice_compact':
      return 'practice_compact'
    case 'default':
      return 'default'
    default:
      return 'default'
  }
}

function normalizeTypstMath(value: string) {
  let next = value.trim()
  next = next.replace(/\\(sin|cos|tan|cot|log|ln|sqrt|pi|alpha|beta|gamma|theta|lambda|mu|sigma|Delta|delta|times|cdot|leq|geq|neq|approx|infty)\b/g, (_, command: string) => MATH_COMMANDS[command] ?? command)
  next = next.replace(/\\circ\b/g, 'degree')
  next = next.replace(/\\qquad\b/g, 'quad')
  next = next.replace(/\\quad\b/g, 'quad')
  next = next.replace(/\\left\b/g, '')
  next = next.replace(/\\right\b/g, '')
  next = next.replace(/\\,/g, ' ')
  next = next.replace(/\\underline\{([^{}]+)\}/g, (_, inner: string) => `underline(${normalizeTypstMath(inner)})`)
  next = next.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator: string, denominator: string) => `(${normalizeTypstMath(numerator)})/(${normalizeTypstMath(denominator)})`)
  return next
}

function toInlineNodes(text: string) {
  const nodes: Array<
    | { type: 'text'; text: string }
    | { type: 'math_inline'; typst: string }
  > = []
  const value = text.trim()
  if (!value) return [{ type: 'text' as const, text: '' }]

  const parts = value.split(/(\$[^$]+\$)/g).filter(Boolean)
  for (const part of parts) {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      nodes.push({ type: 'math_inline', typst: normalizeTypstMath(part.slice(1, -1)) })
      continue
    }
    nodes.push({ type: 'text', text: part })
  }

  return nodes
}

function markdownToBlocks(markdown: string): Block[] {
  const text = markdown.trim()
  if (!text) return []

  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const image = chunk.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (image) {
        return {
          type: 'image' as const,
          alt: image[1] || undefined,
          src: image[2],
        }
      }

      if (chunk.startsWith('```') && chunk.endsWith('```')) {
        const lines = chunk.split('\n')
        const language = lines[0].replace(/^```/, '').trim() || undefined
        return {
          type: 'code' as const,
          language,
          code: lines.slice(1, -1).join('\n'),
        }
      }

      if (chunk.startsWith('$$') && chunk.endsWith('$$')) {
        return {
          type: 'math_block' as const,
          typst: normalizeTypstMath(chunk.slice(2, -2).trim()),
        }
      }

      return {
        type: 'paragraph' as const,
        children: toInlineNodes(chunk),
      }
    })
}

function normalizeQuestionType(type: string): QuestionItem['taxonomy']['questionType'] {
  switch (type) {
    case 'choice':
    case 'single_choice':
      return 'single_choice'
    case 'multiple_choice':
      return 'multiple_choice'
    case 'fill_blank':
      return 'fill_blank'
    case 'essay':
      return 'essay'
    case 'proof':
      return 'proof'
    case 'computation':
      return 'computation'
    case 'true_false':
      return 'true_false'
    case 'matching':
      return 'matching'
    case 'composite':
      return 'composite'
    default:
      return 'short_answer'
  }
}

export function questionToLegacyItem(question: QuestionFile): QuestionItem {
  return {
    id: question.id,
    canonicalId: question.id,
    sourceDocumentId: question.source.label ? `source-${question.id}` : `source-${question.id}`,
    sourceLocator: { page: 1 },
    taxonomy: {
      subject: question.subject,
      grade: question.grade,
      knowledgeIds: question.knowledge,
      abilityTags: question.tags,
      questionType: normalizeQuestionType(question.type),
      difficulty: question.difficulty ?? undefined,
    },
    content: {
      stem: markdownToBlocks(question.stem),
      options: question.options.length > 0
        ? question.options.map((option) => ({
            label: option.label,
            content: markdownToBlocks(option.text),
          }))
        : undefined,
      answer: question.answer ? markdownToBlocks(question.answer) : undefined,
      analysis: question.analysis ? markdownToBlocks(question.analysis) : undefined,
      assets: [],
    },
    provenance: {
      sourceLabel: question.source.label || '',
      region: question.source.region,
      year: question.source.year,
    },
    quality: {
      reviewStatus: REVIEW_MAP.has(question.review)
        ? (question.review as QuestionItem['quality']['reviewStatus'])
        : 'draft',
      answerVerified: Boolean(question.answer.trim()),
    },
    rightsStatus: RIGHTS_MAP.has(question.rights)
      ? (question.rights as QuestionItem['rightsStatus'])
      : 'school_owned',
  }
}

export function projectToLegacyPaper(snapshot: ProjectSnapshot, mode: WorkspaceMode) {
  const itemByFile = new Map(snapshot.questions.map((question) => [question.relativePath, question]))
  const blueprint = normalizeWorkspaceBlueprint(snapshot.paper.paperflow.blueprint, snapshot)
  const sections: SectionNode[] = []
  const clips: QuestionClip[] = []

  snapshot.paper.sections.forEach((section, sectionIndex) => {
    sections.push({
      id: section.id,
      title: section.title,
      order: sectionIndex,
    })

    section.questions.forEach((questionRef, questionIndex) => {
      const question = itemByFile.get(questionRef.file)
      clips.push({
        id: `clip-${sectionIndex + 1}-${questionIndex + 1}`,
        questionItemId: question?.id ?? questionRef.file,
        sectionId: section.id,
        order: questionIndex,
        score: questionRef.score ?? question?.scoreSuggest ?? 0,
        locked: questionRef.locked,
        hiddenParts: questionRef.hiddenParts,
        altItemIds: [],
        layoutHints: questionRef.layoutHints ?? (question
          ? {
              keepWithNext: question.layout.keepWithNext,
              forcePageBreakBefore: question.layout.forcePageBreakBefore,
              answerAreaSize: question.layout.answerAreaSize,
            }
          : undefined),
      })
    })
  })

  const items = snapshot.questions.map(questionToLegacyItem)
  const totalScore = clips.reduce((sum, clip) => sum + clip.score, 0)
  const paper: PaperProject = {
    id: 'workspace-paper',
    orgId: 'local',
    title: snapshot.paper.title,
    blueprint: {
      subject: blueprint.subject || snapshot.questions[0]?.subject || 'unknown',
      grade: blueprint.grade || snapshot.questions[0]?.grade || 'unknown',
      totalScore: blueprint.totalScore || totalScore,
      duration: blueprint.duration,
      sections: blueprint.sections.map((section) => ({
        ...section,
        questionType: normalizeQuestionType(section.questionType),
      })),
      difficultyDistribution: blueprint.difficultyDistribution,
      knowledgeCoverage: blueprint.knowledgeCoverage,
      sourcePreference: blueprint.sourcePreference,
      excludedSources: blueprint.excludedSources,
      excludedKnowledge: blueprint.excludedKnowledge,
      regionPreference: blueprint.regionPreference,
      yearRange: blueprint.yearRange,
      parallelVersions: blueprint.parallelVersions,
      outputModes: blueprint.outputModes ?? [mode],
    },
    sections,
    clips,
    templatePreset: normalizeRenderTemplatePreset(snapshot.paper.paperflow.templatePreset),
    outputModes: blueprint.outputModes ?? [mode],
    version: 1,
    status: 'draft',
  }

  return {
    paper,
    items,
    summaries: snapshot.questions.map(createQuestionSummary),
  }
}
