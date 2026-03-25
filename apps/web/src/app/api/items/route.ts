import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems, sourceDocuments } from '@/db/schema'
import { eq, and, ilike, sql, getTableColumns, inArray } from 'drizzle-orm'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import {
  buildItemVisibilityCondition,
  canManageRights,
  canReviewItems,
  PUBLIC_REVIEW_STATUSES,
  resolveLibraryScope,
} from '@/lib/library-access'

/**
 * GET /api/items — 搜索/列表题目
 *
 * Query params:
 *   q         - 关键词搜索（匹配 search_text）
 *   subject   - 学科过滤
 *   grade     - 年级过滤
 *   type      - 题型过滤
 *   status    - 审核状态过滤
 *   limit     - 每页数量（默认 20）
 *   offset    - 偏移量（默认 0）
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (user && !hasPermission(user.role, 'items:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const q = params.get('q')
  const subject = params.get('subject')
  const grade = params.get('grade')
  const type = params.get('type')
  const status = params.get('status')
  const scope = resolveLibraryScope(params.get('scope'), user)
  const limit = Math.max(1, Math.min(Number(params.get('limit')) || 20, 100))
  const offset = Math.max(0, Number(params.get('offset')) || 0)

  const conditions = []

  if (q) {
    conditions.push(ilike(questionItems.searchText, `%${q}%`))
  }
  if (subject) {
    conditions.push(eq(questionItems.subject, subject))
  }
  if (grade) {
    conditions.push(eq(questionItems.grade, grade))
  }
  if (type) {
    conditions.push(eq(questionItems.questionType, type as typeof questionItems.questionType.enumValues[number]))
  }
  if (status) {
    if (!canReviewItems(user) && !PUBLIC_REVIEW_STATUSES.includes(status as typeof PUBLIC_REVIEW_STATUSES[number])) {
      return Response.json({ error: 'Forbidden status filter' }, { status: 403 })
    }
    conditions.push(eq(questionItems.reviewStatus, status as typeof questionItems.reviewStatus.enumValues[number]))
  } else {
    conditions.push(
      inArray(questionItems.reviewStatus, [...PUBLIC_REVIEW_STATUSES] as typeof questionItems.reviewStatus.enumValues[number][]),
    )
  }

  conditions.push(buildItemVisibilityCondition(user, scope))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [items, countResult] = await Promise.all([
    db
      .select({
        ...getTableColumns(questionItems),
        libraryScope: sql<'public' | 'school'>`case when ${questionItems.rightsStatus} = 'school_owned' then 'school' else 'public' end`,
      })
      .from(questionItems)
      .leftJoin(sourceDocuments, eq(questionItems.sourceDocumentId, sourceDocuments.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(questionItems.createdAt),
    db
      .select({ count: sql<number>`count(*)` })
      .from(questionItems)
      .leftJoin(sourceDocuments, eq(questionItems.sourceDocumentId, sourceDocuments.id))
      .where(where),
  ])

  return Response.json({
    items,
    total: Number(countResult[0].count),
    limit,
    offset,
  })
}

/**
 * POST /api/items — 创建题目
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!hasPermission(user.role, 'items:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  if (!canManageRights(user) && !user.orgId) {
    return Response.json({ error: '当前账号未加入组织，无法创建校本题目' }, { status: 400 })
  }

  if (body.sourceDocumentId) {
    const [sourceDocument] = await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.id, body.sourceDocumentId))
      .limit(1)

    if (!sourceDocument) {
      return Response.json({ error: 'Source document not found' }, { status: 404 })
    }

    const canUseSchoolDocument =
      sourceDocument.rightsStatus === 'school_owned' &&
      !!user.orgId &&
      sourceDocument.ownerOrgId === user.orgId
    const canUsePublicDocument = ['public_domain', 'cc', 'licensed'].includes(sourceDocument.rightsStatus)

    if (!canUseSchoolDocument && !canUsePublicDocument) {
      return Response.json({ error: 'Source document is not accessible' }, { status: 403 })
    }
  }

  // 从 content 中提取纯文本用于搜索
  const searchText = extractSearchText(body.content)
  const reviewStatus =
    canReviewItems(user) && body.reviewStatus
      ? body.reviewStatus
      : 'draft'
  const rightsStatus =
    canManageRights(user) && body.rightsStatus
      ? body.rightsStatus
      : 'school_owned'

  const [item] = await db
    .insert(questionItems)
    .values({
      canonicalId: body.canonicalId ?? crypto.randomUUID(),
      sourceDocumentId: body.sourceDocumentId,
      sourceLocator: body.sourceLocator,
      subject: body.subject,
      grade: body.grade,
      textbookVersion: body.textbookVersion,
      knowledgeIds: body.knowledgeIds ?? [],
      abilityTags: body.abilityTags ?? [],
      questionType: body.questionType,
      difficulty: body.difficulty,
      content: body.content,
      examName: body.examName,
      region: body.region,
      school: body.school ?? user.orgName ?? null,
      year: body.year,
      sourceLabel: body.sourceLabel ?? '',
      reviewStatus,
      answerVerified: body.answerVerified ?? false,
      rightsStatus,
      searchText,
    })
    .returning()

  return Response.json(item, { status: 201 })
}

/** 从 Block AST 中提取纯文本用于全文搜索 */
function extractSearchText(content: Record<string, unknown>): string {
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
    if (obj.type === 'math_inline' && typeof obj.typst === 'string') {
      texts.push(obj.typst)
    }
    if (obj.type === 'math_block' && typeof obj.typst === 'string') {
      texts.push(obj.typst)
    }
    // Recurse into known container fields
    for (const key of ['children', 'stem', 'options', 'answer', 'analysis', 'subquestions', 'content']) {
      if (obj[key]) walk(obj[key])
    }
  }

  walk(content)
  return texts.join(' ')
}
