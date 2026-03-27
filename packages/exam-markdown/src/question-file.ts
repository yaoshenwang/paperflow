import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  QuestionFileSchema,
  QuestionSectionSchema,
  type QuestionFile,
  type QuestionSection,
} from './types.js'
import { parseDocument, serializeDocument } from './front-matter.js'

const SECTION_START = /^:::\s*\{\.\s*([A-Za-z0-9_-]+)\s*\}\s*$/
const SECTION_END = /^:::\s*$/

export function parseQuestionFile(source: string): QuestionFile {
  const { frontMatter, body } = parseDocument(source, QuestionFileSchema.shape.frontMatter)
  const sections = parseQuestionSections(body)
  return QuestionFileSchema.parse({ frontMatter, sections })
}

export function serializeQuestionFile(file: QuestionFile): string {
  const parsed = QuestionFileSchema.parse(file)
  const body = parsed.sections
    .map((section: QuestionSection) => {
      const content = section.content.replace(/\s+$/, '')
      return `::: {.${section.name}}\n${content}\n:::`
    })
    .join('\n\n')

  return serializeDocument(parsed.frontMatter, body)
}

export async function readQuestionFile(filePath: string): Promise<QuestionFile> {
  const source = await readFile(filePath, 'utf-8')
  return parseQuestionFile(source)
}

export async function writeQuestionFile(
  filePath: string,
  file: QuestionFile,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, serializeQuestionFile(file), 'utf-8')
}

function parseQuestionSections(body: string): QuestionSection[] {
  const lines = body.split(/\r?\n/)
  const sections: QuestionSection[] = []
  let currentName: string | null = null
  let buffer: string[] = []
  let sawSection = false

  const flush = () => {
    const content = buffer.join('\n').replace(/\s+$/, '')
    if (!currentName && content.trim().length === 0) {
      buffer = []
      return
    }

    const name = currentName ?? (sawSection ? 'body' : 'stem')
    if (content.length > 0 || !sawSection) {
      sections.push(QuestionSectionSchema.parse({ name, content }))
    }
    buffer = []
  }

  for (const line of lines) {
    const start = line.match(SECTION_START)
    if (start) {
      flush()
      currentName = start[1] ?? 'stem'
      sawSection = true
      continue
    }

    if (SECTION_END.test(line)) {
      flush()
      currentName = null
      sawSection = true
      continue
    }

    buffer.push(line)
  }

  flush()

  if (sections.length === 0) {
    return [QuestionSectionSchema.parse({ name: 'stem', content: body.replace(/\s+$/, '') })]
  }

  return sections
}
