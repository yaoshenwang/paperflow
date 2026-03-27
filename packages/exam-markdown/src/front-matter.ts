import YAML from 'yaml'
import { z } from 'zod'

export interface ParsedDocument<T> {
  frontMatter: T
  body: string
}

export function parseDocument<T>(
  source: string,
  schema: z.ZodType<T>,
): ParsedDocument<T> {
  const cleaned = source.replace(/^\uFEFF/, '')
  const { frontMatterText, body } = splitFrontMatter(cleaned)
  if (frontMatterText === null) {
    return {
      frontMatter: schema.parse({}),
      body,
    }
  }

  const parsed = YAML.parse(frontMatterText) ?? {}
  return {
    frontMatter: schema.parse(parsed),
    body,
  }
}

export function serializeDocument<T>(
  frontMatter: T,
  body: string,
): string {
  const yaml = YAML.stringify(pruneUndefined(frontMatter), {
    indent: 2,
    lineWidth: 0,
  }).trimEnd()

  const normalizedBody = body.replace(/\s+$/, '')
  return `---\n${yaml}\n---\n${normalizedBody ? `\n${normalizedBody}\n` : '\n'}`
}

const FRONT_MATTER_DELIMITER = /^---\s*$/

function splitFrontMatter(source: string): { frontMatterText: string | null; body: string } {
  const lines = source.split(/\r?\n/)
  if (lines.length === 0 || !FRONT_MATTER_DELIMITER.test(lines[0] ?? '')) {
    return { frontMatterText: null, body: source }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (FRONT_MATTER_DELIMITER.test(lines[index] ?? '')) {
      endIndex = index
      break
    }
  }

  if (endIndex < 0) {
    return { frontMatterText: null, body: source }
  }

  return {
    frontMatterText: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n').replace(/^\n/, ''),
  }
}

function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as T
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (item === undefined) return []
      return [[key, pruneUndefined(item)] as const]
    })
    return Object.fromEntries(entries) as T
  }

  return value
}
