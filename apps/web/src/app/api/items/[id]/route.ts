import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems, sourceDocuments } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import {
  buildItemVisibilityCondition,
  canManageRights,
  canReviewItems,
  PUBLIC_REVIEW_STATUSES,
} from '@/lib/library-access'

/**
 * GET /api/items/:id — 获取题目详情
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getCurrentUser()
  if (user && !hasPermission(user.role, 'items:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const conditions = [
    eq(questionItems.id, id),
    buildItemVisibilityCondition(user, user?.orgId ? 'all' : 'public'),
  ]

  if (!canReviewItems(user)) {
    conditions.push(
      inArray(questionItems.reviewStatus, [...PUBLIC_REVIEW_STATUSES] as typeof questionItems.reviewStatus.enumValues[number][]),
    )
  }

  const [item] = await db
    .select({ item: questionItems })
    .from(questionItems)
    .leftJoin(sourceDocuments, eq(questionItems.sourceDocumentId, sourceDocuments.id))
    .where(and(...conditions))
    .limit(1)

  if (!item) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(item.item)
}

/** 可更新字段白名单 */
const UPDATABLE_FIELDS = new Set([
  'subject', 'grade', 'textbookVersion', 'knowledgeIds', 'abilityTags',
  'questionType', 'difficulty', 'content', 'examName', 'region', 'school',
  'year', 'sourceLabel', 'reviewStatus', 'answerVerified', 'rightsStatus',
])

/**
 * PATCH /api/items/:id — 更新题目
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const canEditItem = hasPermission(user.role, 'items:edit')
  const canReviewItem = hasPermission(user.role, 'items:review')
  if (!canEditItem && !canReviewItem) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  // 只允许白名单字段更新
  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (UPDATABLE_FIELDS.has(key)) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  if (!canEditItem) {
    for (const key of Object.keys(updates)) {
      if (!['reviewStatus', 'answerVerified'].includes(key)) {
        delete updates[key]
      }
    }
  }

  if ('reviewStatus' in updates && !canReviewItems(user)) {
    delete updates.reviewStatus
  }

  if ('rightsStatus' in updates && !canManageRights(user)) {
    delete updates.rightsStatus
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No permitted fields provided' }, { status: 400 })
  }

  // 如果 content 被更新，重新计算 searchText
  if (updates.content) {
    updates.searchText = extractSearchText(updates.content as Record<string, unknown>)
  }

  const [existing] = await db
    .select({ id: questionItems.id })
    .from(questionItems)
    .leftJoin(sourceDocuments, eq(questionItems.sourceDocumentId, sourceDocuments.id))
    .where(and(eq(questionItems.id, id), buildItemVisibilityCondition(user, user.orgId ? 'all' : 'public')))
    .limit(1)

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const [updated] = await db
    .update(questionItems)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(questionItems.id, id))
    .returning()

  if (!updated) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(updated)
}

/** 从 Block AST 中提取纯文本用于全文搜索 */
function extractSearchText(content: Record<string, unknown>): string {
  const texts: string[] = []
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(walk); return }
    const obj = node as Record<string, unknown>
    if (obj.type === 'text' && typeof obj.text === 'string') texts.push(obj.text)
    if ((obj.type === 'math_inline' || obj.type === 'math_block') && typeof obj.typst === 'string') texts.push(obj.typst)
    for (const key of ['children', 'stem', 'options', 'answer', 'analysis', 'subquestions', 'content']) {
      if (obj[key]) walk(obj[key])
    }
  }
  walk(content)
  return texts.join(' ')
}

/**
 * DELETE /api/items/:id — 删除题目
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!hasPermission(user.role, 'items:delete')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [existing] = await db
    .select({ id: questionItems.id })
    .from(questionItems)
    .leftJoin(sourceDocuments, eq(questionItems.sourceDocumentId, sourceDocuments.id))
    .where(and(eq(questionItems.id, id), buildItemVisibilityCondition(user, user.orgId ? 'all' : 'public')))
    .limit(1)

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const [deleted] = await db
    .delete(questionItems)
    .where(eq(questionItems.id, id))
    .returning({ id: questionItems.id })

  if (!deleted) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ deleted: true })
}
