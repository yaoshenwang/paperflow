import { NextRequest } from 'next/server'
import { renderProjectPdf } from '@/lib/workspace/render'
import { resolveProjectPath } from '@/lib/workspace/paths'
import { saveWorkspaceProject } from '@/lib/workspace/project'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectPath?: string
    mode?: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
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

  try {
    const projectPath = resolveProjectPath(body.projectPath ?? body.workspace?.projectPath)
    if (body.workspace) {
      await saveWorkspaceProject(projectPath, body.workspace)
    }

    const pdf = await renderProjectPdf(projectPath, body.mode ?? body.workspace?.mode ?? 'student')

    return new Response(new Uint8Array(pdf) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
      },
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
