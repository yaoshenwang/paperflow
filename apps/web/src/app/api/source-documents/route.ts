import { NextRequest } from 'next/server'
import { db } from '@/db'
import { sourceDocuments } from '@/db/schema'

/**
 * GET /api/source-documents — 列表来源文档
 */
export async function GET() {
  const docs = await db.select().from(sourceDocuments).orderBy(sourceDocuments.createdAt)
  return Response.json({ documents: docs })
}

/**
 * POST /api/source-documents — 创建来源文档
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  const [doc] = await db
    .insert(sourceDocuments)
    .values({
      sourceType: body.sourceType,
      title: body.title,
      subject: body.subject,
      grade: body.grade,
      region: body.region,
      year: body.year,
      examName: body.examName,
      paperType: body.paperType,
      fileRef: body.fileRef,
      pageCount: body.pageCount,
      rightsStatus: body.rightsStatus ?? 'school_owned',
      ownerOrgId: body.ownerOrgId,
      uploadedBy: body.uploadedBy,
    })
    .returning()

  return Response.json(doc, { status: 201 })
}
