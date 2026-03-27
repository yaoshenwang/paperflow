import path from 'node:path'
import { NextRequest } from 'next/server'
import { deleteQuestion, findQuestion, questionFromMarkdown, readProject, savePaper, saveQuestion } from '@/lib/workspace/project'
import { resolveProjectPath, slugifyQuestionId, toPosixPath } from '@/lib/workspace/paths'
import { questionToWorkspaceQuestion } from '@/lib/workspace/view-model'
import type { QuestionFile } from '@/lib/workspace/types'

function mergeQuestion(existing: QuestionFile, body: Record<string, unknown>) {
  const nextId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : existing.id
  const nextSourceLabel = typeof body.sourceLabel === 'string' ? body.sourceLabel : existing.source.label
  const nextReview = typeof body.status === 'string'
    ? body.status
    : typeof body.review === 'string'
      ? body.review
      : existing.review
  const nextRelativePath = nextId === existing.id
    ? typeof body.sourcePath === 'string' && body.sourcePath.trim()
      ? body.sourcePath
      : existing.relativePath
    : toPosixPath(path.join('questions', `${slugifyQuestionId(nextId)}.md`))

  return {
    ...existing,
    id: nextId,
    relativePath: nextRelativePath,
    type: typeof body.type === 'string' ? body.type : existing.type,
    subject: typeof body.subject === 'string' ? body.subject : existing.subject,
    grade: typeof body.grade === 'string' ? body.grade : existing.grade,
    difficulty: typeof body.difficulty === 'number' ? body.difficulty : existing.difficulty,
    scoreSuggest: typeof body.scoreSuggest === 'number' ? body.scoreSuggest : existing.scoreSuggest,
    knowledge: Array.isArray(body.knowledge)
      ? body.knowledge.filter((value): value is string => typeof value === 'string')
      : existing.knowledge,
    source: typeof body.source === 'object' && body.source
      ? {
          label: typeof (body.source as { label?: unknown }).label === 'string'
            ? (body.source as { label: string }).label
            : nextSourceLabel,
          year: typeof (body.source as { year?: unknown }).year === 'number'
            ? (body.source as { year: number }).year
            : existing.source.year,
          region: typeof (body.source as { region?: unknown }).region === 'string'
            ? (body.source as { region: string }).region
            : existing.source.region,
        }
      : {
          ...existing.source,
          label: nextSourceLabel,
          year: typeof body.sourceYear === 'number' ? body.sourceYear : existing.source.year,
          region: typeof body.sourceRegion === 'string' ? body.sourceRegion : existing.source.region,
          exam: typeof body.sourceExam === 'string' ? body.sourceExam : existing.source.exam,
        },
    rights: typeof body.rights === 'string' ? body.rights : existing.rights,
    review: nextReview,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((value): value is string => typeof value === 'string')
      : existing.tags,
    layout: typeof body.layout === 'object' && body.layout
      ? {
          optionCols: typeof (body.layout as { optionCols?: unknown }).optionCols === 'number'
            ? (body.layout as { optionCols: number }).optionCols
            : existing.layout.optionCols,
          keepWithNext: typeof (body.layout as { keepWithNext?: unknown }).keepWithNext === 'boolean'
            ? (body.layout as { keepWithNext: boolean }).keepWithNext
            : existing.layout.keepWithNext,
          forcePageBreakBefore: typeof (body.layout as { forcePageBreakBefore?: unknown }).forcePageBreakBefore === 'boolean'
            ? (body.layout as { forcePageBreakBefore: boolean }).forcePageBreakBefore
            : existing.layout.forcePageBreakBefore,
        }
      : existing.layout,
    stem: typeof body.stem === 'string' ? body.stem : existing.stem,
    options: Array.isArray(body.options)
      ? body.options
          .filter((entry): entry is { label?: unknown; text?: unknown } => !!entry && typeof entry === 'object')
          .map((entry, index) => ({
            label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : String.fromCharCode(65 + index),
            text: typeof entry.text === 'string' ? entry.text : '',
          }))
      : existing.options,
    answer: typeof body.answer === 'string' ? body.answer : existing.answer,
    analysis: typeof body.analysis === 'string' ? body.analysis : existing.analysis,
  }
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const projectPath = resolveProjectPath(request.nextUrl.searchParams.get('projectPath'))
  const snapshot = await readProject(projectPath)
  const question = findQuestion(snapshot, id)

  if (!question) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const references = snapshot.paper.sections
    .filter((section) => section.questions.some((entry) => entry.file === question.relativePath))
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
    }))

  return Response.json({
    ...questionToWorkspaceQuestion(question),
    references,
  })
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const body = (await request.json()) as { projectPath?: string } & Record<string, unknown>
  const projectPath = resolveProjectPath(body.projectPath)
  const snapshot = await readProject(projectPath)
  const question = findQuestion(snapshot, id)

  if (!question) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = typeof body.markdown === 'string'
    ? questionFromMarkdown(
        projectPath,
        typeof body.sourcePath === 'string' && body.sourcePath.trim()
          ? body.sourcePath
          : question.relativePath,
        body.markdown,
      )
    : mergeQuestion(question, body)
  const saved = await saveQuestion(projectPath, mergeQuestion(updated, body), question.relativePath)

  if (question.relativePath !== saved.relativePath) {
    snapshot.paper.sections = snapshot.paper.sections.map((section) => ({
      ...section,
      questions: section.questions.map((entry) =>
        entry.file === question.relativePath
          ? { ...entry, file: saved.relativePath }
          : entry,
      ),
    }))
    await savePaper(projectPath, snapshot.paper)
  }

  return Response.json(questionToWorkspaceQuestion(saved))
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const body = request.method === 'DELETE'
    ? await request.json().catch(() => ({}))
    : {}
  const projectPath = resolveProjectPath((body as { projectPath?: string }).projectPath ?? request.nextUrl.searchParams.get('projectPath'))

  await deleteQuestion(projectPath, id)
  return Response.json({ deleted: true })
}
