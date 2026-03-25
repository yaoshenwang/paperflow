import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { renderToTypst, resolveTemplatePreset } from '@paperflow/render-typst'
import type { PaperProject, QuestionItem, OutputMode } from '@paperflow/schema'

/**
 * POST /api/preview — 生成试卷预览 PDF
 *
 * Body: { title, sections, clips, mode }
 * Returns: PDF binary
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, templatePreset = 'default', sections, clips, mode = 'student' } = body

  if (!clips || clips.length === 0) {
    return Response.json({ error: 'No clips provided' }, { status: 400 })
  }

  // 从数据库获取题目内容
  const itemIds: string[] = [...new Set(clips.map((c: { questionItemId: string }) => c.questionItemId) as string[])]
  const items = await db
    .select()
    .from(questionItems)
    .where(inArray(questionItems.id, itemIds))

  // 构造 PaperProject AST
  const paper: PaperProject = {
    id: 'preview',
    orgId: 'preview',
    title: title || '预览试卷',
    blueprint: {
      subject: '数学',
      grade: '高一',
      totalScore: clips.reduce((s: number, c: { score: number }) => s + (c.score || 0), 0),
      sections: [],
    },
    sections: sections || [],
    clips: clips,
    templatePreset,
    outputModes: [mode],
    version: 1,
    status: 'draft',
  }

  // 将数据库行转换为 QuestionItem 格式
  const questionItemsForRender: QuestionItem[] = items.map((row) => ({
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
  }))

  // 渲染 Typst 源码
  const typstSource = renderToTypst(paper, questionItemsForRender, {
    mode: mode as OutputMode,
    template: resolveTemplatePreset(templatePreset),
  })

  // 调用 compile-typst 服务或直接调用 typst CLI
  try {
    const { execFile } = await import('node:child_process')
    const { writeFile, readFile, mkdir, rm } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { randomUUID } = await import('node:crypto')
    const { tmpdir } = await import('node:os')

    const id = randomUUID()
    const dir = join(tmpdir(), `paperflow-preview-${id}`)
    await mkdir(dir, { recursive: true })

    const inputPath = join(dir, 'input.typ')
    const outputPath = join(dir, 'output.pdf')

    await writeFile(inputPath, typstSource, 'utf-8')

    await new Promise<void>((resolve, reject) => {
      execFile('typst', ['compile', inputPath, outputPath], (error, _stdout, stderr) => {
        if (error) reject(new Error(`Typst compile failed: ${stderr || error.message}`))
        else resolve()
      })
    })

    const pdf = await readFile(outputPath)
    await rm(dir, { recursive: true, force: true })

    return new Response(new Uint8Array(pdf) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
