import { access } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd(), '..', '..')
const defaultProjectPath = path.join(repoRoot, 'examples', 'demo-project')

export function getDefaultProjectPath() {
  return process.env.PAPERFLOW_DEFAULT_PROJECT?.trim() || defaultProjectPath
}

export function resolveProjectPath(input?: string | null) {
  const value = input?.trim()
  if (!value) return path.resolve(getDefaultProjectPath())
  if (path.isAbsolute(value)) return path.normalize(value)
  return path.resolve(process.cwd(), value)
}

export function resolveProjectFile(projectPath: string, relativePath: string) {
  const absolute = path.resolve(projectPath, relativePath)
  const relative = path.relative(projectPath, absolute)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes project root: ${relativePath}`)
  }

  return absolute
}

export async function assertProjectExists(projectPath: string) {
  await access(projectPath)
  await access(resolveProjectFile(projectPath, 'paper.qmd'))
  await access(resolveProjectFile(projectPath, 'questions'))
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join('/')
}

export function slugifyQuestionId(id: string) {
  const slug = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `q-${Date.now()}`
}
