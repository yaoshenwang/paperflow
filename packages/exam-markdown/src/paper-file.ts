import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  PaperBodyNodeSchema,
  PaperFileSchema,
  type PaperBodyNode,
  type PaperFile,
} from './types.js'
import { parseDocument, serializeDocument } from './front-matter.js'

const QUESTION_SHORTCODE = /^\{\{<\s*question\s+([^>]+?)\s*>\}\}\s*$/
const HEADING = /^(#{1,6})\s+(.+)$/

export function parsePaperFile(source: string): PaperFile {
  const { frontMatter, body } = parseDocument(source, PaperFileSchema.shape.frontMatter)
  const nodes = parsePaperNodes(body)
  return PaperFileSchema.parse({ frontMatter, nodes })
}

export function serializePaperFile(file: PaperFile): string {
  const parsed = PaperFileSchema.parse(file)
  const body = parsed.nodes.map(serializePaperNode).join('\n\n')
  return serializeDocument(parsed.frontMatter, body)
}

export async function readPaperFile(filePath: string): Promise<PaperFile> {
  const source = await readFile(filePath, 'utf-8')
  return parsePaperFile(source)
}

export async function writePaperFile(filePath: string, file: PaperFile): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, serializePaperFile(file), 'utf-8')
}

function parsePaperNodes(body: string): PaperBodyNode[] {
  const lines = body.split(/\r?\n/)
  const nodes: PaperBodyNode[] = []
  let buffer: string[] = []

  const flush = () => {
    const content = buffer.join('\n').replace(/\s+$/, '')
    if (content.trim().length > 0) {
      nodes.push(PaperBodyNodeSchema.parse({ type: 'markdown', content }))
    }
    buffer = []
  }

  for (const line of lines) {
    const heading = line.match(HEADING)
    const shortcode = line.match(QUESTION_SHORTCODE)

    if (heading) {
      flush()
      nodes.push(
        PaperBodyNodeSchema.parse({
          type: 'heading',
          level: heading[1]?.length ?? 1,
          title: heading[2] ?? '',
        }),
      )
      continue
    }

    if (shortcode) {
      flush()
      nodes.push(PaperBodyNodeSchema.parse(parseQuestionShortcode(shortcode[1] ?? '')))
      continue
    }

    buffer.push(line)
  }

  flush()
  return nodes
}

function serializePaperNode(node: PaperBodyNode): string {
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(node.level)} ${node.title}`
    case 'markdown':
      return node.content.replace(/\s+$/, '')
    case 'question': {
      const attrs: string[] = [`file="${escapeAttr(node.file)}"`]
      if (typeof node.score === 'number') {
        attrs.push(`score="${String(node.score)}"`)
      }
      const extraAttrs = Object.entries(node.attrs ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
      return `{{< question ${[...attrs, ...extraAttrs].join(' ')} >}}`
    }
  }

  return ''
}

function parseQuestionShortcode(payload: string): PaperBodyNode {
  const attrs = parseAttrs(payload)
  const file = attrs.file ?? attrs.path ?? ''
  const score = attrs.score ? Number(attrs.score) : undefined
  const extraAttrs = Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== 'file' && key !== 'path' && key !== 'score'),
  ) as Record<string, string>

  return {
    type: 'question',
    file,
    score: Number.isFinite(score) ? score : undefined,
    attrs: extraAttrs,
  }
}

function parseAttrs(payload: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const matcher = /([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g

  for (;;) {
    const match = matcher.exec(payload)
    if (!match) break
    const key = match[1]
    const value = match[2]
    if (key) attrs[key] = value.replace(/\\"/g, '"')
  }

  return attrs
}

function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
