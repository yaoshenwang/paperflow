import { db } from '@/db'
import { organizations, users } from '@/db/schema'
import { getCurrentUser, hasPermission, type UserRole } from '@/lib/auth'
import { toApiErrorResponse } from '@/lib/api/errors'
import { and, asc, eq, sql } from 'drizzle-orm'

const USER_ROLES: UserRole[] = ['teacher', 'reviewer', 'librarian', 'org_admin']

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!user.orgId) {
      return Response.json({ error: 'Current user is not attached to an organization' }, { status: 400 })
    }
    if (!hasPermission(user.role, 'users:manage')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [organization] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1)

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.orgId, user.orgId))
      .orderBy(asc(users.createdAt))

    return Response.json({ organization, members })
  } catch (error) {
    return toApiErrorResponse(error, '组织成员服务暂不可用，请先确认 PostgreSQL 已启动。')
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!user.orgId) {
      return Response.json({ error: 'Current user is not attached to an organization' }, { status: 400 })
    }
    if (!hasPermission(user.role, 'users:manage')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const role = typeof body.role === 'string' ? body.role : ''

    if (!userId || !USER_ROLES.includes(role as UserRole)) {
      return Response.json({ error: 'Invalid member update payload' }, { status: 400 })
    }

    const [targetMember] = await db
      .select({
        id: users.id,
        role: users.role,
        orgId: users.orgId,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, user.orgId)))
      .limit(1)

    if (!targetMember) {
      return Response.json({ error: 'Member not found in current organization' }, { status: 404 })
    }

    if (targetMember.role === 'org_admin' && role !== 'org_admin') {
      const [adminCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.orgId, user.orgId), eq(users.role, 'org_admin')))

      if (Number(adminCount.count) <= 1) {
        return Response.json({ error: 'Organization must keep at least one org admin' }, { status: 400 })
      }
    }

    const [updatedMember] = await db
      .update(users)
      .set({ role: role as UserRole })
      .where(and(eq(users.id, userId), eq(users.orgId, user.orgId)))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })

    return Response.json({ member: updatedMember })
  } catch (error) {
    return toApiErrorResponse(error, '组织成员服务暂不可用，请先确认 PostgreSQL 已启动。')
  }
}
