import { cloneProject, createProjectScaffold, readProject, resetProject } from '@/lib/workspace/project'
import { getDefaultProjectPath, resolveProjectPath } from '@/lib/workspace/paths'
import { snapshotToWorkspace } from '@/lib/workspace/view-model'

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectPath?: string
    title?: string
    subject?: string
    grade?: string
    template?: string
    templatePreset?: string
    mode?: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
    withSampleQuestions?: boolean
    generateDemoQuestions?: boolean
    cloneDemo?: boolean
    overwrite?: boolean
  }
  const projectPath = resolveProjectPath(body.projectPath)

  try {
    if (body.overwrite) {
      await resetProject(projectPath)
    }

    if (body.cloneDemo) {
      await cloneProject(getDefaultProjectPath(), projectPath)
    } else {
      await createProjectScaffold(projectPath, {
        title: body.title?.trim() || '未命名试卷',
        subject: body.subject,
        grade: body.grade,
        template: body.template ?? body.templatePreset,
        mode: body.mode,
        withSampleQuestions: body.withSampleQuestions ?? body.generateDemoQuestions ?? true,
      })
    }

    const snapshot = await readProject(projectPath)
    return Response.json({
      ok: true,
      ...snapshotToWorkspace(snapshot, projectPath),
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
