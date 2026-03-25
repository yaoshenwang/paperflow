import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems, sourceDocuments } from '@/db/schema'
import { PaperProjectSchema, QuestionItemSchema, SourceDocumentSchema, type QuestionItem } from '@paperflow/schema'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const ImportBundleSchema = z.object({
  paper: PaperProjectSchema,
  items: z.array(QuestionItemSchema),
  sourceDocuments: z.array(SourceDocumentSchema).optional(),
})

const ImportRequestSchema = z.object({
  format: z.enum(['demo', 'paper_json']),
  payload: z.unknown().optional(),
})

const DEMO_PAPER_URL = new URL('../../../../../../examples/sample-papers/demo-paper.json', import.meta.url)

export async function POST(request: NextRequest) {
  const body = ImportRequestSchema.parse(await request.json())

  const bundle = body.format === 'demo'
    ? await loadDemoBundle()
    : ImportBundleSchema.parse(body.payload)

  const docs = bundle.sourceDocuments?.length ? bundle.sourceDocuments : deriveSourceDocuments(bundle.items)

  await db.transaction(async (tx) => {
    for (const doc of docs) {
      await tx
        .insert(sourceDocuments)
        .values({
          id: doc.id,
          sourceType: doc.sourceType,
          title: doc.title,
          subject: doc.subject,
          grade: doc.grade,
          region: doc.region,
          year: doc.year,
          examName: doc.examName,
          paperType: doc.paperType,
          fileRef: doc.fileRef,
          pageCount: doc.pageCount,
          rightsStatus: doc.rightsStatus,
          ownerOrgId: doc.ownerOrgId,
          uploadedBy: doc.uploadedBy,
          createdAt: new Date(doc.createdAt),
        })
        .onConflictDoUpdate({
          target: sourceDocuments.id,
          set: {
            sourceType: doc.sourceType,
            title: doc.title,
            subject: doc.subject,
            grade: doc.grade,
            region: doc.region,
            year: doc.year,
            examName: doc.examName,
            paperType: doc.paperType,
            fileRef: doc.fileRef,
            pageCount: doc.pageCount,
            rightsStatus: doc.rightsStatus,
            ownerOrgId: doc.ownerOrgId,
            uploadedBy: doc.uploadedBy,
          },
        })
    }

    for (const item of bundle.items) {
      await tx
        .insert(questionItems)
        .values({
          id: item.id,
          canonicalId: item.canonicalId,
          sourceDocumentId: item.sourceDocumentId,
          sourceLocator: item.sourceLocator,
          subject: item.taxonomy.subject,
          grade: item.taxonomy.grade,
          textbookVersion: item.taxonomy.textbookVersion,
          knowledgeIds: item.taxonomy.knowledgeIds,
          abilityTags: item.taxonomy.abilityTags,
          questionType: item.taxonomy.questionType,
          difficulty: item.taxonomy.difficulty,
          content: item.content,
          examName: item.provenance.examName,
          region: item.provenance.region,
          school: item.provenance.school,
          year: item.provenance.year,
          sourceLabel: item.provenance.sourceLabel,
          reviewStatus: item.quality.reviewStatus,
          answerVerified: item.quality.answerVerified,
          duplicateClusterId: item.quality.duplicateClusterId,
          ocrConfidence: item.quality.ocrConfidence,
          reviewerId: item.quality.reviewerId,
          rightsStatus: item.rightsStatus,
          searchText: extractSearchText(item.content),
        })
        .onConflictDoUpdate({
          target: questionItems.id,
          set: {
            canonicalId: item.canonicalId,
            sourceDocumentId: item.sourceDocumentId,
            sourceLocator: item.sourceLocator,
            subject: item.taxonomy.subject,
            grade: item.taxonomy.grade,
            textbookVersion: item.taxonomy.textbookVersion,
            knowledgeIds: item.taxonomy.knowledgeIds,
            abilityTags: item.taxonomy.abilityTags,
            questionType: item.taxonomy.questionType,
            difficulty: item.taxonomy.difficulty,
            content: item.content,
            examName: item.provenance.examName,
            region: item.provenance.region,
            school: item.provenance.school,
            year: item.provenance.year,
            sourceLabel: item.provenance.sourceLabel,
            reviewStatus: item.quality.reviewStatus,
            answerVerified: item.quality.answerVerified,
            duplicateClusterId: item.quality.duplicateClusterId,
            ocrConfidence: item.quality.ocrConfidence,
            reviewerId: item.quality.reviewerId,
            rightsStatus: item.rightsStatus,
            searchText: extractSearchText(item.content),
            updatedAt: new Date(),
          },
        })
    }
  })

  return Response.json({
    imported: {
      sourceDocuments: docs.length,
      items: bundle.items.length,
    },
    paper: {
      title: bundle.paper.title,
      templatePreset: bundle.paper.templatePreset,
      sections: bundle.paper.sections,
      clips: bundle.paper.clips,
    },
    items: bundle.items.map(toItemSummary),
  })
}

async function loadDemoBundle() {
  const raw = await readFile(DEMO_PAPER_URL, 'utf-8')
  const bundle = ImportBundleSchema.parse(JSON.parse(raw))
  return {
    ...bundle,
    items: bundle.items.map((item) => ({
      ...item,
      rightsStatus: 'licensed' as const,
    })),
    sourceDocuments: bundle.sourceDocuments?.map((doc) => ({
      ...doc,
      rightsStatus: 'licensed' as const,
    })),
  }
}

function deriveSourceDocuments(items: QuestionItem[]) {
  const now = new Date().toISOString()
  const grouped = new Map<string, QuestionItem[]>()

  for (const item of items) {
    const current = grouped.get(item.sourceDocumentId) ?? []
    current.push(item)
    grouped.set(item.sourceDocumentId, current)
  }

  return Array.from(grouped.entries()).map(([sourceDocumentId, group]) => {
    const first = group[0]
    return {
      id: sourceDocumentId,
      sourceType: 'curated' as const,
      title: first.provenance.sourceLabel || sourceDocumentId,
      subject: first.taxonomy.subject,
      grade: first.taxonomy.grade,
      region: first.provenance.region,
      year: first.provenance.year,
      examName: first.provenance.examName,
      paperType: 'exam',
      fileRef: `demo://${sourceDocumentId}`,
      pageCount: Math.max(...group.map((item) => item.sourceLocator.page)),
      rightsStatus: first.rightsStatus,
      ownerOrgId: undefined,
      uploadedBy: undefined,
      createdAt: now,
    }
  })
}

function toItemSummary(item: QuestionItem) {
  return {
    id: item.id,
    subject: item.taxonomy.subject,
    grade: item.taxonomy.grade,
    questionType: item.taxonomy.questionType,
    difficulty: item.taxonomy.difficulty ?? null,
    sourceLabel: item.provenance.sourceLabel,
    reviewStatus: item.quality.reviewStatus,
    contentPreview: extractSearchText(item.content),
    libraryScope: item.rightsStatus === 'school_owned' ? 'school' : 'public',
  }
}

function extractSearchText(content: QuestionItem['content']): string {
  const texts: string[] = []

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }

    const obj = node as Record<string, unknown>
    if (obj.type === 'text' && typeof obj.text === 'string') {
      texts.push(obj.text)
    }
    if ((obj.type === 'math_inline' || obj.type === 'math_block') && typeof obj.typst === 'string') {
      texts.push(obj.typst)
    }

    for (const key of ['children', 'stem', 'options', 'answer', 'analysis', 'subquestions', 'content']) {
      if (obj[key]) walk(obj[key])
    }
  }

  walk(content)
  return texts.join(' ')
}
