import { NextRequest } from 'next/server'
import { readProject } from '@/lib/workspace/project'
import { resolveProjectPath } from '@/lib/workspace/paths'

function getProjectPath(input: string | null) {
  if (!input?.trim()) {
    throw new Error('projectPath is required')
  }
  return resolveProjectPath(input)
}

/**
 * GET /api/source-documents — 从工作区题目文件派生来源信息
 */
export async function GET(request: NextRequest) {
  try {
    const projectPath = getProjectPath(request.nextUrl.searchParams.get('projectPath'))
    const snapshot = await readProject(projectPath)
    const documentsByKey = new Map<string, {
      id: string
      title: string
      region: string | null
      year: number | null
      subject: string
      grade: string
      rightsStatus: string
      reviewStatus: string
      questionIds: string[]
    }>()

    for (const question of snapshot.questions) {
      const title = question.source.label?.trim() || question.id
      const region = question.source.region ?? null
      const year = question.source.year ?? null
      const key = `${title}::${region ?? ''}::${year ?? ''}`
      const current = documentsByKey.get(key)

      if (current) {
        current.questionIds.push(question.id)
        continue
      }

      documentsByKey.set(key, {
        id: key,
        title,
        region,
        year,
        subject: question.subject,
        grade: question.grade,
        rightsStatus: question.rights,
        reviewStatus: question.review,
        questionIds: [question.id],
      })
    }

    return Response.json({
      projectPath,
      documents: Array.from(documentsByKey.values()),
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    )
  }
}

/**
 * POST /api/source-documents — workspace-first 模式下不再维护独立来源表
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { projectPath?: string }

  return Response.json(
    {
      error: 'Source documents are derived from question front matter in workspace mode. Edit questions/*.md instead.',
      projectPath: typeof body.projectPath === 'string' ? resolveProjectPath(body.projectPath) : null,
    },
    { status: 405, headers: { Allow: 'GET' } },
  )
}
