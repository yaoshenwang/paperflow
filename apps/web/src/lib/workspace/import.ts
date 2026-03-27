import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { listZipEntries } from '@paperflow/cli/zip'
import {
  PaperProjectSchema,
  QuestionItemSchema,
  type Block,
  type PaperProject,
  type QuestionItem,
} from '@paperflow/schema'
import { createProjectScaffold, readProject, saveQuestion, saveWorkspaceProject } from './project'
import { resolveProjectFile, slugifyQuestionId, toPosixPath } from './paths'
import type { QuestionFile, WorkspaceBlueprint, WorkspaceMode } from './types'

type ImportedBundle = {
  paper: PaperProject
  items: QuestionItem[]
  mode: WorkspaceMode
  templatePreset: string
}

type ImportedWorkspaceSummary = {
  title: string
  subject: string
  grade: string
  templatePreset: string
  mode: WorkspaceMode
  blueprint: WorkspaceBlueprint
  sections: Array<{ id: string; title: string; order: number }>
  clips: Array<{
    id: string
    questionId: string
    sectionId: string
    order: number
    score: number
    locked: boolean
    hiddenParts: Array<'answer' | 'analysis'>
    layoutHints?: {
      keepWithNext?: boolean
      forcePageBreakBefore?: boolean
      answerAreaSize?: 's' | 'm' | 'l'
    }
  }>
}

function normalizeTemplatePreset(value?: string) {
  switch ((value ?? '').trim()) {
    case 'default':
      return 'default'
    case 'school-default':
      return 'school-default'
    case 'exam_standard':
    case 'exam-standard':
    case 'practice_compact':
    case 'practice-compact':
      return 'exam-standard'
    case 'teacher_annotated':
    case 'teacher-annotated':
      return 'teacher-annotated'
    case 'answer_sheet':
    case 'answer-sheet':
      return 'answer-sheet'
    default:
      return 'school-default'
  }
}

function normalizeMode(value?: string): WorkspaceMode {
  switch ((value ?? '').trim()) {
    case 'teacher':
      return 'teacher'
    case 'answer_sheet':
      return 'answer_sheet'
    case 'solution_book':
      return 'solution_book'
    default:
      return 'student'
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function inlineNodesFromText(text: string): Block[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  return normalized
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\$\$[\s\S]*\$\$$/.test(part)) {
        return { type: 'math_block', typst: part.slice(2, -2).trim() } as const
      }

      const children = part
        .replace(/\n+/g, ' ')
        .split(/(\$[^$\n]+\$)/g)
        .filter((chunk) => chunk.length > 0)
        .map((chunk) =>
          chunk.startsWith('$') && chunk.endsWith('$')
            ? ({ type: 'math_inline', typst: chunk.slice(1, -1) } as const)
            : ({ type: 'text', text: chunk } as const),
        )

      return { type: 'paragraph', children } as const
    })
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return block.children.map((child) => (child.type === 'text' ? child.text : `$${child.typst}$`)).join('')
        case 'math_block':
          return `$$\n${block.typst}\n$$`
        case 'image':
          return `![${block.alt ?? ''}](${block.src})`
        case 'table':
          return block.rows
            .map((row) =>
              `| ${row.map((cell) => cell.map((child) => (child.type === 'text' ? child.text : `$${child.typst}$`)).join('')).join(' | ')} |`,
            )
            .join('\n')
        case 'code':
          return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
      }
    })
    .join('\n\n')
}

function optionBlocksToText(blocks: Block[]) {
  return blocksToMarkdown(blocks).replace(/\n+/g, ' ').trim()
}

function questionTypeToWorkspaceType(type: QuestionItem['taxonomy']['questionType']): QuestionFile['type'] {
  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'fill_blank':
    case 'short_answer':
    case 'essay':
    case 'proof':
    case 'computation':
    case 'true_false':
    case 'matching':
    case 'composite':
      return type
    default:
      return 'short_answer'
  }
}

function questionItemToQuestionFile(item: QuestionItem, scoreSuggest: number | null): QuestionFile {
  return {
    id: item.id,
    path: '',
    relativePath: toPosixPath(path.join('questions', `${slugifyQuestionId(item.id)}.md`)),
    type: questionTypeToWorkspaceType(item.taxonomy.questionType),
    subject: item.taxonomy.subject,
    grade: item.taxonomy.grade,
    difficulty: item.taxonomy.difficulty ?? null,
    scoreSuggest,
    knowledge: item.taxonomy.knowledgeIds,
    source: {
      label: item.provenance.sourceLabel,
      year: item.provenance.year,
      region: item.provenance.region,
      exam: item.provenance.examName,
      school: item.provenance.school,
    },
    rights: item.rightsStatus,
    review: item.quality.reviewStatus,
    tags: Array.from(new Set([...item.taxonomy.knowledgeIds, ...item.taxonomy.abilityTags])),
    layout: {
      optionCols: item.content.options && item.content.options.length > 4 ? 1 : 2,
      keepWithNext: false,
      forcePageBreakBefore: false,
    },
    stem: blocksToMarkdown(item.content.stem),
    options: item.content.options?.map((option) => ({
      label: option.label,
      text: optionBlocksToText(option.content),
    })) ?? [],
    answer: blocksToMarkdown(item.content.answer ?? []),
    analysis: blocksToMarkdown(item.content.analysis ?? []),
    frontmatter: {},
  }
}

function parseJsonBundle(raw: string): ImportedBundle {
  const payload = JSON.parse(raw) as Record<string, unknown>
  const paper = PaperProjectSchema.parse(payload.paper)
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => QuestionItemSchema.parse(item))
    : []

  if (items.length === 0) {
    throw new Error('JSON import requires `items` in Paperflow export format')
  }

  const source = payload.source && typeof payload.source === 'object'
    ? (payload.source as Record<string, unknown>)
    : undefined

  return {
    paper,
    items,
    mode: normalizeMode(
      typeof payload.mode === 'string'
        ? payload.mode
        : typeof paper.outputModes[0] === 'string'
          ? paper.outputModes[0]
          : undefined,
    ),
    templatePreset: normalizeTemplatePreset(
      typeof source?.templatePreset === 'string'
        ? source.templatePreset
        : paper.templatePreset,
    ),
  }
}

function extractAttribute(xml: string, attribute: string) {
  const match = xml.match(new RegExp(`${attribute}="([^"]*)"`, 'i'))
  return match ? decodeXmlEntities(match[1]) : ''
}

function htmlToBlocks(fragment: string) {
  const withMath = fragment.replace(
    /<annotation[^>]*encoding="application\/x-typst"[^>]*>([\s\S]*?)<\/annotation>/gi,
    (_, value: string) => `$${decodeXmlEntities(value).trim()}$`,
  )
  const withImages = withMath.replace(
    /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    (_, src: string, alt: string) => `\n\n![${decodeXmlEntities(alt)}](${decodeXmlEntities(src)})\n\n`,
  )
  const plain = decodeXmlEntities(
    withImages
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )

  return inlineNodesFromText(plain)
}

function parseQtiItem(xml: string): QuestionItem {
  const identifier = extractAttribute(xml, 'identifier') || `qti-${Date.now()}`
  const title = extractAttribute(xml, 'title') || identifier
  const bodyMatch = xml.match(/<qti-item-body[^>]*>([\s\S]*?)<\/qti-item-body>/i)
  const body = bodyMatch?.[1] ?? ''
  const choiceInteractionMatch = body.match(/<qti-choice-interaction[\s\S]*?<\/qti-choice-interaction>/i)
  const extendedText = /<qti-extended-text-interaction/i.test(body)
  const stemFragment = body
    .replace(/<qti-choice-interaction[\s\S]*?<\/qti-choice-interaction>/gi, '')
    .replace(/<qti-extended-text-interaction[^>]*\/>/gi, '')
    .trim()

  const options = choiceInteractionMatch
    ? Array.from(
        choiceInteractionMatch[0].matchAll(/<qti-simple-choice[^>]*identifier="([^"]+)"[^>]*>([\s\S]*?)<\/qti-simple-choice>/gi),
      ).map((match) => ({
        label: decodeXmlEntities(match[1]),
        content: htmlToBlocks(match[2]),
      }))
    : undefined

  const correct = xml.match(/<qti-correct-response>\s*<qti-value>([\s\S]*?)<\/qti-value>\s*<\/qti-correct-response>/i)

  return QuestionItemSchema.parse({
    id: identifier,
    canonicalId: identifier,
    sourceDocumentId: `${identifier}-source`,
    sourceLocator: { page: 1 },
    taxonomy: {
      subject: 'unknown',
      grade: 'unknown',
      knowledgeIds: [],
      abilityTags: [],
      questionType: options ? 'single_choice' : extendedText ? 'short_answer' : 'essay',
    },
    content: {
      stem: htmlToBlocks(stemFragment),
      options,
      answer: correct ? htmlToBlocks(decodeXmlEntities(correct[1])) : undefined,
      analysis: undefined,
      assets: [],
    },
    provenance: {
      sourceLabel: title,
    },
    quality: {
      reviewStatus: 'parsed',
      answerVerified: Boolean(correct),
    },
    rightsStatus: 'licensed',
  })
}

function parseQtiBundle(entries: Array<{ path: string; data: Buffer }>): ImportedBundle {
  const testEntry = entries.find((entry) => entry.path === 'assessment-test.xml')
  if (!testEntry) {
    throw new Error('QTI package is missing assessment-test.xml')
  }

  const itemsByFile = new Map(
    entries
      .filter((entry) => entry.path.endsWith('.xml') && entry.path !== 'assessment-test.xml')
      .map((entry) => [path.basename(entry.path), parseQtiItem(entry.data.toString('utf8'))]),
  )

  const testXml = testEntry.data.toString('utf8')
  const sectionMatches = Array.from(
    testXml.matchAll(/<qti-assessment-section[^>]*identifier="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/qti-assessment-section>/gi),
  )

  const sections = sectionMatches.length > 0
    ? sectionMatches.map((match, index) => ({
        id: match[1] || `section-${index + 1}`,
        title: decodeXmlEntities(match[2]) || `Section ${index + 1}`,
        order: index,
      }))
    : [{ id: 'section-1', title: 'Imported Section', order: 0 }]

  const clips = sectionMatches.flatMap((match, sectionIndex) =>
    Array.from(
      match[3].matchAll(/<qti-assessment-item-ref[^>]*identifier="([^"]+)"[^>]*href="([^"]+)"[^>]*\/>/gi),
    ).map((itemMatch, order) => {
      const item = itemsByFile.get(path.basename(itemMatch[2]))
      if (!item) {
        throw new Error(`QTI package references missing item: ${itemMatch[2]}`)
      }
      return {
        id: itemMatch[1],
        questionItemId: item.id,
        sectionId: sections[sectionIndex]?.id ?? 'section-1',
        order,
        score: 0,
        locked: false,
        hiddenParts: [],
        altItemIds: [],
      }
    }),
  )

  const items = Array.from(itemsByFile.values())
  const paper = PaperProjectSchema.parse({
    id: extractAttribute(testXml, 'identifier') || 'imported-qti',
    orgId: 'local',
    title: extractAttribute(testXml, 'title') || '导入试卷',
    blueprint: {
      subject: 'unknown',
      grade: 'unknown',
      totalScore: 0,
      sections: sections.map((section) => ({
        questionType: 'short_answer',
        count: clips.filter((clip) => clip.sectionId === section.id).length || 1,
        scorePerItem: 0,
      })),
      outputModes: ['student'],
    },
    sections,
    clips,
    templatePreset: 'default',
    outputModes: ['student'],
    version: 1,
    status: 'draft',
  })

  return {
    paper,
    items,
    mode: 'student',
    templatePreset: 'school-default',
  }
}

function summarizeImportedWorkspace(bundle: ImportedBundle): ImportedWorkspaceSummary {
  return {
    title: bundle.paper.title,
    subject: bundle.paper.blueprint.subject,
    grade: bundle.paper.blueprint.grade,
    templatePreset: bundle.templatePreset,
    mode: bundle.mode,
    blueprint: {
      subject: bundle.paper.blueprint.subject,
      grade: bundle.paper.blueprint.grade,
      totalScore: bundle.paper.blueprint.totalScore,
      duration: bundle.paper.blueprint.duration,
      sections: bundle.paper.blueprint.sections.map((section) => ({
        questionType: section.questionType,
        count: section.count,
        scorePerItem: section.scorePerItem,
      })),
      difficultyDistribution: bundle.paper.blueprint.difficultyDistribution,
      knowledgeCoverage: bundle.paper.blueprint.knowledgeCoverage,
      sourcePreference: bundle.paper.blueprint.sourcePreference,
      excludedSources: bundle.paper.blueprint.excludedSources,
      excludedKnowledge: bundle.paper.blueprint.excludedKnowledge,
      regionPreference: bundle.paper.blueprint.regionPreference,
      yearRange: bundle.paper.blueprint.yearRange,
      parallelVersions: bundle.paper.blueprint.parallelVersions,
      outputModes: bundle.paper.blueprint.outputModes,
    },
    sections: bundle.paper.sections
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((section) => ({
        id: section.id,
        title: section.title,
        order: section.order,
      })),
    clips: bundle.paper.clips.map((clip) => ({
      id: clip.id,
      questionId: clip.questionItemId,
      sectionId: clip.sectionId,
      order: clip.order,
      score: clip.score,
      locked: clip.locked,
      hiddenParts: clip.hiddenParts,
      layoutHints: clip.layoutHints,
    })),
  }
}

async function materializeBundle(projectPath: string, bundle: ImportedBundle) {
  const summary = summarizeImportedWorkspace(bundle)
  await createProjectScaffold(projectPath, {
    title: summary.title,
    subject: summary.subject,
    grade: summary.grade,
    template: summary.templatePreset,
    mode: summary.mode,
    withSampleQuestions: false,
  })

  const suggestedScoreById = new Map<string, number | null>()
  summary.clips.forEach((clip) => {
    if (!suggestedScoreById.has(clip.questionId)) {
      suggestedScoreById.set(clip.questionId, clip.score)
    }
  })

  const questionPaths = new Map<string, string>()
  for (const item of bundle.items) {
    const file = questionItemToQuestionFile(item, suggestedScoreById.get(item.id) ?? null)
    const saved = await saveQuestion(projectPath, file)
    questionPaths.set(item.id, saved.relativePath)
  }

  await saveWorkspaceProject(projectPath, {
    title: summary.title,
    subject: summary.subject,
    grade: summary.grade,
    templatePreset: summary.templatePreset,
    mode: summary.mode,
    blueprint: summary.blueprint,
    sections: summary.sections,
    clips: summary.clips,
    questions: bundle.items.map((item) => ({
      id: item.id,
      sourcePath: questionPaths.get(item.id),
    })),
  })

  return readProject(projectPath)
}

export async function importProjectZip(projectPath: string, sourcePath: string) {
  const entries = await listZipEntries(sourcePath)

  for (const entry of entries) {
    if (entry.path.endsWith('/')) continue
    const outputPath = resolveProjectFile(projectPath, entry.path)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, entry.data)
  }

  return readProject(projectPath)
}

export async function importWorkspaceJson(projectPath: string, sourcePath: string) {
  const raw = await readFile(sourcePath, 'utf8')
  return materializeBundle(projectPath, parseJsonBundle(raw))
}

export async function importWorkspaceQti(projectPath: string, sourcePath: string) {
  const entries = await listZipEntries(sourcePath)
  return materializeBundle(projectPath, parseQtiBundle(entries))
}
