import { NextRequest } from 'next/server'
import { lintProject } from '@/lib/workspace/lint'
import { resolveProjectPath } from '@/lib/workspace/paths'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { projectPath?: string; workspace?: { projectPath?: string } }
  const projectPath = resolveProjectPath(body.projectPath ?? body.workspace?.projectPath)
  const result = await lintProject(projectPath)
  return Response.json(result)
}
