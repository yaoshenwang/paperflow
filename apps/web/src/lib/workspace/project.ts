import { copyFile, mkdir, readdir, rm, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import {
  createProjectScaffold as createExamProjectScaffold,
  parseQuestionFile,
  readProject as readExamProject,
  writeProjectPaper,
  writeQuestionFile,
  type PaperBodyNode,
  type PaperFile as ExamPaperFile,
  type QuestionFile as ExamQuestionFile,
} from '@paperflow/exam-markdown'
import { normalizeWorkspaceBlueprint } from './blueprint'
import type { PaperFile, ProjectSnapshot, QuestionFile, WorkspaceBlueprint, WorkspaceMode } from './types'
import { resolveProjectFile, slugifyQuestionId, toPosixPath } from './paths'

type InitOptions = {
  title: string
  subject?: string
  grade?: string
  template?: string
  mode?: WorkspaceMode
  withSampleQuestions?: boolean
}

type WorkspacePersistInput = {
  title: string
  subject: string
  grade: string
  templatePreset: string
  mode: WorkspaceMode
  blueprint?: WorkspaceBlueprint
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
  questions: Array<{ id: string; sourcePath?: string }>
}

const DEFAULT_QUESTION = {
  type: 'single_choice',
  subject: 'math',
  grade: 'high-1',
  difficulty: 0.5,
  scoreSuggest: 5,
  knowledge: ['functions'],
  source: { label: '示例题', year: new Date().getFullYear(), region: '本地' },
  rights: 'school_owned',
  review: 'approved',
  tags: ['demo'],
  layout: { optionCols: 2, keepWithNext: false },
  stem: '这是一个示例题干。你可以在右侧或 Source 模式里直接改 markdown。',
  options: [
    { label: 'A', text: '选项 A' },
    { label: 'B', text: '选项 B' },
    { label: 'C', text: '选项 C' },
    { label: 'D', text: '选项 D' },
  ],
  answer: 'A',
  analysis: '这是示例解析。',
}

const DEFAULT_TEMPLATE_FOLDER = 'school-default'

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true })
}

function getSectionContent(file: ExamQuestionFile, name: string) {
  return file.sections.find((section) => section.name === name)?.content ?? ''
}

function parseQuestionOptions(file: ExamQuestionFile) {
  const content = getSectionContent(file, 'options')
  if (!content.trim()) return []

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^- ([A-Z])\.\s*(.+)$/)
      if (match) {
        return {
          label: match[1],
          text: match[2].trim(),
        }
      }

      return {
        label: String.fromCharCode(65 + index),
        text: line.replace(/^- /, '').trim(),
      }
    })
}

function normalizeTemplatePreset(value?: string) {
  switch ((value ?? '').trim()) {
    case 'exam_standard':
      return 'exam-standard'
    case 'teacher_annotated':
      return 'teacher-annotated'
    case 'answer_sheet':
      return 'answer-sheet'
    case 'default':
    case 'school-default':
    case 'exam-standard':
    case 'teacher-annotated':
    case 'answer-sheet':
      return value!.trim()
    default:
      return 'school-default'
  }
}

function templatePresetToFrontMatter(value?: string) {
  switch ((value ?? '').trim()) {
    case 'exam-standard':
      return 'exam_standard'
    case 'teacher-annotated':
      return 'teacher_annotated'
    case 'answer-sheet':
      return 'answer_sheet'
    case 'default':
    case 'school-default':
      return value!.trim()
    default:
      return 'school-default'
  }
}

function attrBoolean(attrs: Record<string, string> | undefined, key: string) {
  const value = attrs?.[key]
  return value === 'true' || value === '1' || value === 'yes'
}

function attrText(attrs: Record<string, string> | undefined, key: string) {
  const value = attrs?.[key]?.trim()
  return value ? value : undefined
}

function frontMatterString(value: unknown, fallback?: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function mapQuestion(rootDir: string, relativePath: string, file: ExamQuestionFile): QuestionFile {
  const frontMatter = file.frontMatter
  return {
    id: frontMatter.id,
    path: resolveProjectFile(rootDir, relativePath),
    relativePath: toPosixPath(relativePath),
    type: frontMatter.type,
    subject: frontMatter.subject,
    grade: frontMatter.grade,
    difficulty: frontMatter.difficulty ?? null,
    scoreSuggest: frontMatter.score_suggest ?? null,
    knowledge: frontMatter.knowledge ?? [],
    source: frontMatter.source ?? {},
    rights: frontMatter.rights ?? 'school_owned',
    review: frontMatter.review ?? 'draft',
    tags: frontMatter.tags ?? [],
    layout: {
      optionCols: frontMatter.layout?.option_cols,
      keepWithNext: frontMatter.layout?.keep_with_next,
      forcePageBreakBefore: frontMatter.layout?.force_page_break_before,
      answerAreaSize: frontMatter.layout?.answer_area_size,
    },
    stem: getSectionContent(file, 'stem'),
    options: parseQuestionOptions(file),
    answer: getSectionContent(file, 'answer'),
    analysis: getSectionContent(file, 'analysis'),
    frontmatter: frontMatter,
  }
}

export function questionFromMarkdown(projectPath: string, relativePath: string, source: string) {
  return mapQuestion(projectPath, relativePath, parseQuestionFile(source))
}

function mapPaper(rootDir: string, paper: ExamPaperFile): PaperFile {
  const paperflow = (paper.frontMatter.paperflow ?? {}) as Record<string, unknown>
  const sections: PaperFile['sections'] = []
  let currentSection: {
    id: string
    title: string
    questions: PaperFile['sections'][number]['questions']
  } | null = null

  const ensureDefaultSection = () => {
    if (!currentSection) {
      currentSection = {
        id: 'sec-1',
        title: '未命名部分',
        questions: [],
      }
    }
  }

  for (const node of paper.nodes) {
    if (node.type === 'heading' && node.level === 2) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        id: `sec-${sections.length + 1}`,
        title: node.title,
        questions: [],
      }
      continue
    }

    if (node.type === 'question') {
      ensureDefaultSection()
      const hiddenParts: Array<'answer' | 'analysis'> = []
      if (attrBoolean(node.attrs, 'hide-answer')) hiddenParts.push('answer')
      if (attrBoolean(node.attrs, 'hide-analysis')) hiddenParts.push('analysis')
      currentSection!.questions.push({
        file: toPosixPath(node.file),
        score: typeof node.score === 'number' ? node.score : null,
        locked: attrBoolean(node.attrs, 'locked'),
        hiddenParts,
        layoutHints: {
          keepWithNext: attrBoolean(node.attrs, 'keep-with-next') || undefined,
          forcePageBreakBefore: attrBoolean(node.attrs, 'force-page-break-before') || undefined,
          answerAreaSize: attrText(node.attrs, 'answer-area-size') as 's' | 'm' | 'l' | undefined,
        },
      })
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  if (sections.length === 0) {
    sections.push({
      id: 'sec-1',
      title: '未命名部分',
      questions: [],
    })
  }

  return {
    path: resolveProjectFile(rootDir, 'paper.qmd'),
    relativePath: 'paper.qmd',
    title: paper.frontMatter.title,
    frontmatter: paper.frontMatter,
    paperflow: {
      mode: (frontMatterString(paperflow.mode, 'student') ?? 'student') as WorkspaceMode,
      template: frontMatterString(paperflow.template, DEFAULT_TEMPLATE_FOLDER) ?? DEFAULT_TEMPLATE_FOLDER,
      templatePreset: normalizeTemplatePreset(
        frontMatterString(paperflow.template_preset) ?? frontMatterString(paperflow.template),
      ),
      showScore: Boolean(paperflow.show_score),
      showAnswer: Boolean(paperflow.show_answer),
      showAnalysis: Boolean(paperflow.show_analysis),
      blueprint: paperflow.blueprint as WorkspaceBlueprint | undefined,
    },
    sections,
  }
}

function questionToExamFile(question: QuestionFile): ExamQuestionFile {
  return {
    frontMatter: {
      ...question.frontmatter,
      id: question.id,
      type: question.type as ExamQuestionFile['frontMatter']['type'],
      subject: question.subject,
      grade: question.grade,
      difficulty: question.difficulty ?? undefined,
      score_suggest: question.scoreSuggest ?? undefined,
      knowledge: question.knowledge.length > 0 ? question.knowledge : undefined,
      source: question.source,
      rights: question.rights as ExamQuestionFile['frontMatter']['rights'],
      review: question.review as ExamQuestionFile['frontMatter']['review'],
      tags: question.tags.length > 0 ? question.tags : undefined,
      layout: {
        option_cols: question.layout.optionCols,
        keep_with_next: question.layout.keepWithNext,
        force_page_break_before: question.layout.forcePageBreakBefore,
        answer_area_size: question.layout.answerAreaSize,
      },
    },
    sections: [
      { name: 'stem', content: question.stem },
      ...(question.options.length > 0
        ? [{
            name: 'options',
            content: question.options.map((option) => `- ${option.label}. ${option.text}`).join('\n'),
          }]
        : []),
      ...(question.answer.trim() ? [{ name: 'answer', content: question.answer }] : []),
      ...(question.analysis.trim() ? [{ name: 'analysis', content: question.analysis }] : []),
    ],
  }
}

function paperToExamFile(paper: PaperFile): ExamPaperFile {
  const nodes: PaperBodyNode[] = []

  for (const section of paper.sections) {
    nodes.push({
      type: 'heading',
      level: 2,
      title: section.title,
    })
    section.questions.forEach((question) => {
      const attrs: Record<string, string> = {}
      if (question.locked) attrs.locked = 'true'
      if (question.hiddenParts.includes('answer')) attrs['hide-answer'] = 'true'
      if (question.hiddenParts.includes('analysis')) attrs['hide-analysis'] = 'true'
      if (question.layoutHints?.keepWithNext) attrs['keep-with-next'] = 'true'
      if (question.layoutHints?.forcePageBreakBefore) attrs['force-page-break-before'] = 'true'
      if (question.layoutHints?.answerAreaSize) attrs['answer-area-size'] = question.layoutHints.answerAreaSize
      nodes.push({
        type: 'question',
        file: toPosixPath(question.file),
        score: question.score ?? undefined,
        attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
      })
    })
  }

  return {
    frontMatter: {
      ...paper.frontmatter,
      title: paper.title,
      paperflow: {
        ...(typeof paper.frontmatter.paperflow === 'object' && paper.frontmatter.paperflow
          ? (paper.frontmatter.paperflow as Record<string, unknown>)
          : {}),
        mode: paper.paperflow.mode as never,
        template: paper.paperflow.template,
        template_preset: templatePresetToFrontMatter(paper.paperflow.templatePreset),
        show_score: paper.paperflow.showScore,
        show_answer: paper.paperflow.showAnswer,
        show_analysis: paper.paperflow.showAnalysis,
      },
    },
    nodes,
  }
}

export async function readProject(projectPath: string): Promise<ProjectSnapshot> {
  const result = await readExamProject(projectPath)
  const rootDir = result.rootDir
  const questions = result.questionFiles.map((record) => mapQuestion(rootDir, record.path, record.file))

  return {
    rootDir,
    paper: mapPaper(rootDir, result.paper),
    questions,
  }
}

export function createQuestionSummary(question: QuestionFile) {
  return {
    id: question.id,
    subject: question.subject,
    grade: question.grade,
    questionType: question.type,
    difficulty: question.difficulty,
    sourceLabel: question.source.label ?? '',
    reviewStatus: question.review,
    rightsStatus: question.rights,
    contentPreview: `${question.stem} ${question.answer} ${question.analysis}`.trim(),
    file: question.relativePath,
  }
}

export function findQuestion(snapshot: ProjectSnapshot, id: string) {
  return snapshot.questions.find((question) => question.id === id)
}

export async function savePaper(projectPath: string, paper: PaperFile) {
  await writeProjectPaper(projectPath, paperToExamFile(paper))
}

export async function saveWorkspaceProject(projectPath: string, workspace: WorkspacePersistInput) {
  const snapshot = await readProject(projectPath)
  const questionPathById = new Map<string, string>()

  snapshot.questions.forEach((question) => {
    questionPathById.set(question.id, question.relativePath)
  })
  workspace.questions.forEach((question) => {
    if (question.sourcePath?.trim()) {
      questionPathById.set(question.id, toPosixPath(question.sourcePath.trim()))
    }
  })

  const sections = [...workspace.sections]
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      id: section.id,
      title: section.title.trim() || '未命名部分',
      questions: [...workspace.clips]
        .filter((clip) => clip.sectionId === section.id)
        .sort((left, right) => left.order - right.order)
        .map((clip) => {
          const file = questionPathById.get(clip.questionId)
          if (!file) {
            throw new Error(`Question not found in workspace: ${clip.questionId}`)
          }
          return {
            file,
            score: clip.score,
            locked: clip.locked,
            hiddenParts: clip.hiddenParts,
            layoutHints: clip.layoutHints,
          }
        }),
    }))

  const paper: PaperFile = {
    ...snapshot.paper,
    title: workspace.title.trim() || '未命名试卷',
    frontmatter: {
      ...snapshot.paper.frontmatter,
      title: workspace.title.trim() || '未命名试卷',
      subject: workspace.subject.trim() || undefined,
      grade: workspace.grade.trim() || undefined,
    },
    paperflow: {
      ...snapshot.paper.paperflow,
      mode: workspace.mode,
      template: snapshot.paper.paperflow.template || DEFAULT_TEMPLATE_FOLDER,
      templatePreset: workspace.templatePreset,
      showScore: workspace.mode === 'teacher' || workspace.mode === 'solution_book',
      showAnswer: workspace.mode === 'teacher' || workspace.mode === 'solution_book',
      showAnalysis: workspace.mode === 'teacher' || workspace.mode === 'solution_book',
      blueprint: normalizeWorkspaceBlueprint(
        workspace.blueprint ?? snapshot.paper.paperflow.blueprint,
        {
          ...snapshot,
          paper: {
            ...snapshot.paper,
            title: workspace.title.trim() || '未命名试卷',
            frontmatter: {
              ...snapshot.paper.frontmatter,
              title: workspace.title.trim() || '未命名试卷',
              subject: workspace.subject.trim() || undefined,
              grade: workspace.grade.trim() || undefined,
            },
            sections,
          },
        },
      ),
    },
    sections,
  }

  await savePaper(projectPath, paper)
  return readProject(projectPath)
}

export async function saveQuestion(
  projectPath: string,
  question: QuestionFile,
  previousRelativePath?: string,
) {
  const targetRelativePath = question.relativePath || toPosixPath(path.join('questions', `${slugifyQuestionId(question.id)}.md`))
  const targetPath = resolveProjectFile(projectPath, targetRelativePath)
  await ensureDirectory(path.dirname(targetPath))
  await writeQuestionFile(
    targetPath,
    questionToExamFile({ ...question, relativePath: targetRelativePath, path: targetPath }),
  )

  if (previousRelativePath && previousRelativePath !== targetRelativePath) {
    const previousPath = resolveProjectFile(projectPath, previousRelativePath)
    try {
      await unlink(previousPath)
    } catch {}
  }

  const saved = await readProject(projectPath)
  const found = saved.questions.find((entry) => entry.relativePath === targetRelativePath)
  if (!found) {
    throw new Error(`Failed to reload question after save: ${targetRelativePath}`)
  }
  return found
}

export async function deleteQuestion(projectPath: string, id: string) {
  const snapshot = await readProject(projectPath)
  const question = findQuestion(snapshot, id)
  if (!question) {
    throw new Error(`Question not found: ${id}`)
  }

  await unlink(resolveProjectFile(projectPath, question.relativePath))
  snapshot.paper.sections = snapshot.paper.sections.map((section) => ({
    ...section,
    questions: section.questions.filter((item) => item.file !== question.relativePath),
  }))
  await savePaper(projectPath, snapshot.paper)

  return question
}

export async function createProjectScaffold(projectPath: string, options: InitOptions) {
  await createExamProjectScaffold({
    rootDir: projectPath,
    title: options.title,
    subject: options.subject ?? DEFAULT_QUESTION.subject,
    grade: options.grade ?? DEFAULT_QUESTION.grade,
    template: options.template ?? 'school-default',
    outputMode: (options.mode ?? 'student') as never,
    includeSampleQuestions: options.withSampleQuestions ?? true,
    overwrite: true,
  })
  return readProject(projectPath)
}

export async function cloneProject(sourcePath: string, targetPath: string) {
  const info = await stat(sourcePath)
  if (!info.isDirectory()) {
    throw new Error(`Not a directory: ${sourcePath}`)
  }

  await ensureDirectory(targetPath)
  const entries = await readdir(sourcePath, { withFileTypes: true })

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name)
    const targetEntry = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      await cloneProject(sourceEntry, targetEntry)
      continue
    }
    await ensureDirectory(path.dirname(targetEntry))
    await copyFile(sourceEntry, targetEntry)
  }
}

export async function resetProject(projectPath: string) {
  await rm(projectPath, { recursive: true, force: true })
}
