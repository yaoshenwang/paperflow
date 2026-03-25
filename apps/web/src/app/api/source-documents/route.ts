import { NextRequest } from 'next/server'
import { db } from '@/db'
import { sourceDocuments } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import { buildSourceDocumentVisibilityCondition, canManageRights, resolveLibraryScope } from '@/lib/library-access'

/**
 * GET /api/source-documents — 列表来源文档
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (user && !hasPermission(user.role, 'items:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scope = resolveLibraryScope(request.nextUrl.searchParams.get('scope'), user)
  const docs = await db
    .select()
    .from(sourceDocuments)
    .where(and(buildSourceDocumentVisibilityCondition(user, scope)))
    .orderBy(sourceDocuments.createdAt)

  return Response.json({ documents: docs })
}

/**
 * POST /api/source-documents — 创建来源文档
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!hasPermission(user.role, 'source_documents:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  if (!canManageRights(user) && !user.orgId) {
    return Response.json({ error: '当前账号未加入组织，无法上传校本资源' }, { status: 400 })
  }

  if (body.ownerOrgId && body.ownerOrgId !== user.orgId && !hasPermission(user.role, 'source_documents:manage')) {
    return Response.json({ error: 'Forbidden owner organization' }, { status: 403 })
  }

  const rightsStatus =
    canManageRights(user) && body.rightsStatus
      ? body.rightsStatus
      : 'school_owned'

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
      rightsStatus,
      ownerOrgId: body.ownerOrgId ?? user.orgId,
      uploadedBy: body.uploadedBy ?? user.id,
    })
    .returning()

  return Response.json(doc, { status: 201 })
}
