import { NextRequest } from 'next/server'
import { lintProject } from '@/lib/workspace/lint'
import { resolveProjectPath } from '@/lib/workspace/paths'
import { saveWorkspaceProject } from '@/lib/workspace/project'
import {
  renderProjectBundle,
  renderProjectDocx,
  renderProjectJson,
  renderProjectPdf,
  renderProjectQti,
  renderProjectTypst,
  renderProjectZip,
} from '@/lib/workspace/render'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectPath?: string
    format?: 'pdf' | 'docx' | 'zip' | 'typst' | 'qti' | 'json' | 'bundle'
    mode?: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
    workspace?: {
      projectPath?: string
      title: string
      subject: string
      grade: string
      templatePreset: string
      mode: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
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
  const projectPath = resolveProjectPath(body.projectPath ?? body.workspace?.projectPath)
  const format = body.format ?? 'pdf'
  const mode = body.mode ?? body.workspace?.mode ?? 'student'

  try {
    if (body.workspace) {
      await saveWorkspaceProject(projectPath, body.workspace)
    }

    if (!['zip', 'typst'].includes(format)) {
      const review = await lintProject(projectPath)
      if (!review.summary.publishable) {
        return Response.json(
          {
            error: 'Workspace failed Review Center checks. Fix lint failures before formal export.',
            review,
          },
          { status: 422 },
        )
      }
    }

    if (format === 'typst') {
      const source = await renderProjectTypst(projectPath, mode)
      return new Response(source, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="paper.${mode}.typ"`,
        },
      })
    }

    if (format === 'pdf') {
      const pdf = await renderProjectPdf(projectPath, mode)
      return new Response(new Uint8Array(pdf) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="paper.${mode}.pdf"`,
        },
      })
    }

    if (format === 'docx') {
      const docx = await renderProjectDocx(projectPath, mode)
      return new Response(new Uint8Array(docx) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="paper.${mode}.docx"`,
        },
      })
    }

    if (format === 'zip') {
      const zip = await renderProjectZip(projectPath)
      return new Response(new Uint8Array(zip) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="paperflow-project.zip"',
        },
      })
    }

    if (format === 'bundle') {
      const bundle = await renderProjectBundle(projectPath)
      return new Response(new Uint8Array(bundle) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="paperflow-export-bundle.zip"',
        },
      })
    }

    if (format === 'json') {
      const json = await renderProjectJson(projectPath, mode)
      return new Response(new Uint8Array(json) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="paper.${mode}.json"`,
        },
      })
    }

    if (format === 'qti') {
      const qti = await renderProjectQti(projectPath, mode)
      return new Response(new Uint8Array(qti) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="paper.${mode}.qti.zip"`,
        },
      })
    }

    return Response.json({ error: `Unsupported format: ${format}` }, { status: 400 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
