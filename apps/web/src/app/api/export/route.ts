import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { renderToTypst, resolveTemplatePreset } from '@paperflow/render-typst'
import type { PaperProject, QuestionItem, OutputMode } from '@paperflow/schema'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import { FORMAL_RIGHTS_STATUSES, PUBLIC_REVIEW_STATUSES } from '@/lib/library-access'

/**
 * POST /api/export — 导出试卷
 *
 * Body: { title, sections, clips, format, mode }
 * Formats: pdf, typst, docx_xml, qti, json
 * Mode: student, teacher, answer_sheet, solution_book
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!hasPermission(user.role, 'papers:export')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, templatePreset = 'default', sections, clips, format = 'pdf', mode = 'student' } = body

  if (!clips || clips.length === 0) {
    return Response.json({ error: 'No clips' }, { status: 400 })
  }

  // 获取题目
  const itemIds: string[] = clips.map((c: { questionItemId: string }) => c.questionItemId)
  const items = await db.select().from(questionItems).where(
    sql`${questionItems.id} = ANY(${itemIds})`,
  )

  if (items.length !== itemIds.length) {
    return Response.json({ error: 'Some question items were not found' }, { status: 404 })
  }

  const invalidItems = items.filter(
    (item) =>
      !PUBLIC_REVIEW_STATUSES.includes(item.reviewStatus as typeof PUBLIC_REVIEW_STATUSES[number]) ||
      !FORMAL_RIGHTS_STATUSES.includes(item.rightsStatus as typeof FORMAL_RIGHTS_STATUSES[number]),
  )

  if (invalidItems.length > 0) {
    return Response.json({
      error: '试卷包含未审核或版权状态不合规的题目，无法正式导出',
      invalidItemIds: invalidItems.map((item) => item.id),
    }, { status: 403 })
  }

  const paper = buildPaperProject(title, templatePreset, sections, clips, mode)
  const questionItemsForRender = items.map(rowToQuestionItem)
  const template = resolveTemplatePreset(templatePreset)

  switch (format) {
    case 'typst': {
      const typstSource = renderToTypst(paper, questionItemsForRender, {
        mode: mode as OutputMode,
        template,
      })
      return new Response(typstSource, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${title}.typ"` },
      })
    }

    case 'pdf': {
      const typstSource = renderToTypst(paper, questionItemsForRender, {
        mode: mode as OutputMode,
        template,
      })
      try {
        const pdf = await compileTypstToPdf(typstSource)
        return new Response(new Uint8Array(pdf) as unknown as BodyInit, {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${title}.pdf"` },
        })
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 500 })
      }
    }

    case 'json': {
      const exportData = { paper, items: questionItemsForRender }
      return Response.json(exportData, {
        headers: { 'Content-Disposition': `attachment; filename="${title}.json"` },
      })
    }

    case 'docx_xml': {
      // 动态导入 render-docx
      const { renderToDocxXml } = await import('@paperflow/render-docx')
      const docxXml = renderToDocxXml(paper, questionItemsForRender, { mode: mode as OutputMode })
      return new Response(docxXml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${title}.xml"` },
      })
    }

    case 'qti': {
      const { renderTestToQti, renderItemToQti } = await import('@paperflow/render-qti')
      // 生成自包含的 QTI 包：test XML + 所有 item XML 拼接
      const testXml = renderTestToQti(paper, questionItemsForRender)
      const itemXmls = questionItemsForRender.map((item) => renderItemToQti(item))
      const combined = `<!-- QTI Assessment Test -->\n${testXml}\n\n<!-- Assessment Items -->\n${itemXmls.join('\n\n')}`
      return new Response(combined, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${title}-qti.xml"` },
      })
    }

    default:
      return Response.json({ error: `Unknown format: ${format}` }, { status: 400 })
  }
}

function buildPaperProject(
  title: string,
  templatePreset: string,
  sections: unknown[],
  clips: unknown[],
  mode: string,
): PaperProject {
  return {
    id: 'export',
    orgId: 'export',
    title: title || '导出试卷',
    blueprint: { subject: '数学', grade: '高一', totalScore: 0, sections: [] },
    sections: (sections ?? []) as PaperProject['sections'],
    clips: (clips ?? []) as PaperProject['clips'],
    templatePreset,
    outputModes: [mode as OutputMode],
    version: 1,
    status: 'draft',
  }
}

function rowToQuestionItem(row: typeof questionItems.$inferSelect): QuestionItem {
  return {
    id: row.id,
    canonicalId: row.canonicalId,
    sourceDocumentId: row.sourceDocumentId ?? '',
    sourceLocator: (row.sourceLocator as QuestionItem['sourceLocator']) ?? { page: 1 },
    taxonomy: {
      subject: row.subject,
      grade: row.grade,
      textbookVersion: row.textbookVersion ?? undefined,
      knowledgeIds: row.knowledgeIds ?? [],
      abilityTags: row.abilityTags ?? [],
      questionType: row.questionType as QuestionItem['taxonomy']['questionType'],
      difficulty: row.difficulty ?? undefined,
    },
    content: row.content as QuestionItem['content'],
    provenance: {
      examName: row.examName ?? undefined,
      region: row.region ?? undefined,
      school: row.school ?? undefined,
      year: row.year ?? undefined,
      sourceLabel: row.sourceLabel,
    },
    quality: {
      reviewStatus: row.reviewStatus as QuestionItem['quality']['reviewStatus'],
      answerVerified: row.answerVerified,
      duplicateClusterId: row.duplicateClusterId ?? undefined,
      ocrConfidence: row.ocrConfidence ?? undefined,
      reviewerId: row.reviewerId ?? undefined,
    },
    rightsStatus: row.rightsStatus as QuestionItem['rightsStatus'],
  }
}

async function compileTypstToPdf(source: string): Promise<Uint8Array> {
  const { execFile } = await import('node:child_process')
  const { writeFile, readFile, mkdir, rm } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { randomUUID } = await import('node:crypto')
  const { tmpdir } = await import('node:os')

  const id = randomUUID()
  const dir = join(tmpdir(), `paperflow-export-${id}`)
  await mkdir(dir, { recursive: true })

  const inputPath = join(dir, 'input.typ')
  const outputPath = join(dir, 'output.pdf')

  try {
    await writeFile(inputPath, source, 'utf-8')
    await new Promise<void>((resolve, reject) => {
      execFile('typst', ['compile', inputPath, outputPath], (error, _stdout, stderr) => {
        if (error) reject(new Error(`Typst compile failed: ${stderr || error.message}`))
        else resolve()
      })
    })
    return await readFile(outputPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
