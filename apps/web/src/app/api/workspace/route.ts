import { readProject, saveWorkspaceProject } from '@/lib/workspace/project'
import { assertProjectExists, getDefaultProjectPath, resolveProjectPath } from '@/lib/workspace/paths'
import { snapshotToWorkspace } from '@/lib/workspace/view-model'

export async function GET(request: Request) {
  const projectPath = resolveProjectPath(new URL(request.url).searchParams.get('projectPath'))

  try {
    await assertProjectExists(projectPath)
    const snapshot = await readProject(projectPath)

    return Response.json({
      ok: true,
      defaultProjectPath: getDefaultProjectPath(),
      ...snapshotToWorkspace(snapshot, projectPath),
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectPath,
      },
      { status: 404 },
    )
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectPath?: string
    workspace?: {
      projectPath?: string
      title: string
      subject: string
      grade: string
      templatePreset: string
      mode: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
      blueprint?: {
        intent?: string
        subject: string
        grade: string
        totalScore: number
        duration?: number
        sections: Array<{ questionType: string; count: number; scorePerItem: number }>
        difficultyDistribution?: { easy: number; medium: number; hard: number }
        knowledgeCoverage?: string[]
        sourcePreference?: string[]
        excludedSources?: string[]
        excludedKnowledge?: string[]
        regionPreference?: string[]
        yearRange?: [number, number]
        parallelVersions?: number
        outputModes?: Array<'student' | 'teacher' | 'answer_sheet' | 'solution_book'>
      }
      sections: Array<{ id: string; title: string; order: number }>
      clips: Array<{
        id: string
        questionId: string
        sectionId: string
        order: number
        score: number
        locked: boolean
        hiddenParts: Array<'answer' | 'analysis'>
        layoutHints?: {
          keepWithNext?: boolean
          forcePageBreakBefore?: boolean
          answerAreaSize?: 's' | 'm' | 'l'
        }
      }>
      questions: Array<{ id: string; sourcePath?: string }>
    }
  }
  const workspace = body.workspace
  if (!workspace) {
    return Response.json({ ok: false, error: 'workspace payload is required' }, { status: 400 })
  }
  const projectPath = resolveProjectPath(body.projectPath ?? workspace.projectPath)

  try {
    const snapshot = await saveWorkspaceProject(projectPath, {
      title: workspace.title,
      subject: workspace.subject,
      grade: workspace.grade,
      templatePreset: workspace.templatePreset,
      mode: workspace.mode,
      blueprint: workspace.blueprint,
      sections: workspace.sections,
      clips: workspace.clips,
      questions: workspace.questions,
    })

    return Response.json({
      ok: true,
      defaultProjectPath: getDefaultProjectPath(),
      ...snapshotToWorkspace(snapshot, projectPath),
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectPath,
      },
      { status: 500 },
    )
  }
}
