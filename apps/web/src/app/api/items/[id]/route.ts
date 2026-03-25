import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/items/:id — 获取题目详情
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params

  const [item] = await db
    .select()
    .from(questionItems)
    .where(eq(questionItems.id, id))
    .limit(1)

  if (!item) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(item)
}

/**
 * PATCH /api/items/:id — 更新题目
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params
  const body = await request.json()

  const [updated] = await db
    .update(questionItems)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(questionItems.id, id))
    .returning()

  if (!updated) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(updated)
}

/**
 * DELETE /api/items/:id — 删除题目
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/items/[id]'>,
) {
  const { id } = await ctx.params

  const [deleted] = await db
    .delete(questionItems)
    .where(eq(questionItems.id, id))
    .returning({ id: questionItems.id })

  if (!deleted) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ deleted: true })
}
