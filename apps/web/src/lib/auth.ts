import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

export type UserRole = 'teacher' | 'reviewer' | 'librarian' | 'org_admin'

export type SessionUser = {
  id: string
  email: string
  name: string
  orgId: string | null
  role: UserRole
}

/** 角色权限映射 */
const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  teacher: new Set([
    'items:read',
    'items:create',
    'papers:read',
    'papers:create',
    'papers:edit_own',
    'papers:export',
    'search',
  ]),
  reviewer: new Set([
    'items:read',
    'items:create',
    'items:review',
    'papers:read',
    'papers:create',
    'papers:edit_own',
    'papers:export',
    'search',
  ]),
  librarian: new Set([
    'items:read',
    'items:create',
    'items:edit',
    'items:review',
    'items:delete',
    'items:import',
    'papers:read',
    'papers:create',
    'papers:edit_own',
    'papers:export',
    'source_documents:manage',
    'search',
  ]),
  org_admin: new Set([
    'items:read',
    'items:create',
    'items:edit',
    'items:review',
    'items:delete',
    'items:import',
    'papers:read',
    'papers:create',
    'papers:edit',
    'papers:export',
    'source_documents:manage',
    'users:manage',
    'org:manage',
    'search',
  ]),
}

/** 检查用户是否有指定权限 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

/** 从请求中获取当前用户（基于简单 token，v1 先用 header 传递用户 ID） */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('pf-user-id')?.value

  if (!userId) return null

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
    role: user.role as UserRole,
  }
}
