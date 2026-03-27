import type { PaperOutputMode, ProjectQuestionFile, QuestionFile, ReadProjectResult } from './types.js'

function normalizePath(filePath: string) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '')
}

function getSection(question: QuestionFile, name: string) {
  return question.sections.find((section) => section.name === name)?.content.trim() ?? ''
}

function questionTitle(index: number, score?: number) {
  return `### ${index}. ${typeof score === 'number' ? `（${score}分）` : ''}`.trim()
}

function renderTeacherExtras(question: QuestionFile, mode: PaperOutputMode) {
  if (mode !== 'teacher' && mode !== 'solution_book') return []

  const answer = getSection(question, 'answer')
  const analysis = getSection(question, 'analysis')
  const blocks: string[] = []

  if (answer) {
    blocks.push('**答案**', '', answer)
  }
  if (analysis) {
    blocks.push('**解析**', '', analysis)
  }

  return blocks
}

function renderQuestion(question: QuestionFile, index: number, score?: number, mode: PaperOutputMode = 'student') {
  const stem = getSection(question, 'stem')
  const options = getSection(question, 'options')
  const parts = [questionTitle(index, score), '', stem]

  if (options) {
    parts.push('', options)
  }

  const extras = renderTeacherExtras(question, mode)
  if (extras.length > 0) {
    parts.push('', ...extras)
  }

  return parts.join('\n')
}

function lookupQuestionByPath(project: ReadProjectResult) {
  const byPath = new Map<string, ProjectQuestionFile>()
  for (const record of project.questionFiles) {
    byPath.set(normalizePath(record.path), record)
  }
  return byPath
}

export function buildQuartoRenderDocument(
  project: ReadProjectResult,
  options?: {
    mode?: PaperOutputMode
  },
) {
  const mode = options?.mode ?? 'student'
  const questionByPath = lookupQuestionByPath(project)
  const parts: string[] = [
    '---',
    `title: ${JSON.stringify(project.paper.frontMatter.title)}`,
    ...(project.paper.frontMatter.subject ? [`subject: ${JSON.stringify(project.paper.frontMatter.subject)}`] : []),
    ...(project.paper.frontMatter.grade ? [`grade: ${JSON.stringify(project.paper.frontMatter.grade)}`] : []),
    'number-sections: false',
    'toc: false',
    '---',
    '',
  ]

  let questionIndex = 0

  for (const node of project.paper.nodes) {
    if (node.type === 'heading') {
      parts.push(`${'#'.repeat(node.level)} ${node.title}`, '')
      continue
    }

    if (node.type === 'markdown') {
      const content = node.content.trim()
      if (content) {
        parts.push(content, '')
      }
      continue
    }

    const record = questionByPath.get(normalizePath(node.file))
    if (!record) {
      parts.push(`> Missing question file: ${node.file}`, '')
      continue
    }

    questionIndex += 1
    parts.push(renderQuestion(record.file, questionIndex, node.score, mode), '')
  }

  return `${parts.join('\n').trim()}\n`
}

export function buildQuartoRenderMetadata(
  project: ReadProjectResult,
  options?: {
    mode?: PaperOutputMode
    template?: string
  },
) {
  const mode = options?.mode ?? 'student'
  const paperflow = project.paper.frontMatter.paperflow ?? {}
  const template = options?.template ?? paperflow.template ?? 'school-default'
  const teacherMode = mode === 'teacher' || mode === 'solution_book'

  return {
    shortcodes: [`templates/${template}/question.lua`],
    format: {
      typst: {
        template: `templates/${template}/template.typ`,
        'template-partials': [
          `templates/${template}/typst-template.typ`,
          `templates/${template}/typst-show.typ`,
        ],
      },
    },
    paperflow: {
      ...paperflow,
      mode,
      template,
      template_preset: paperflow.template_preset,
      show_score: teacherMode ? true : paperflow.show_score ?? false,
      show_answer: teacherMode ? true : paperflow.show_answer ?? false,
      show_analysis: teacherMode ? true : paperflow.show_analysis ?? false,
    },
  }
}
