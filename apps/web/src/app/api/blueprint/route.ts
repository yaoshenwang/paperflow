import { NextRequest } from 'next/server'
import { blueprintFromIntent, deriveWorkspaceBlueprint } from '@/lib/workspace/blueprint'
import { readProject } from '@/lib/workspace/project'
import { resolveProjectPath } from '@/lib/workspace/paths'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    intent?: string
    projectPath?: string
  }
  const intent = body.intent?.trim()
  if (!intent) {
    return Response.json({ error: 'intent is required' }, { status: 400 })
  }

  try {
    const projectPath = resolveProjectPath(body.projectPath)
    const snapshot = await readProject(projectPath)
    const fallback = deriveWorkspaceBlueprint(snapshot)
    const result = blueprintFromIntent(intent, fallback)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
