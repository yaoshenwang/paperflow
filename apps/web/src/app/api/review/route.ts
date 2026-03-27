import { NextRequest } from 'next/server'
import { lintProject } from '@/lib/workspace/lint'
import { resolveProjectPath } from '@/lib/workspace/paths'
import { collectReviewArtifacts } from '@/lib/workspace/render'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { projectPath?: string; workspace?: { projectPath?: string } }
  const projectPath = resolveProjectPath(body.projectPath ?? body.workspace?.projectPath)
  const report = await lintProject(projectPath)
  const artifacts = await collectReviewArtifacts(projectPath)
  return Response.json({ ...report, artifacts })
}
