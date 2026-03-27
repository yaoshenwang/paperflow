import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { toApiErrorResponse } from '@/lib/api/errors'

/**
 * POST /api/auth — 简单认证
 *
 * Actions:
 *   register — 注册用户（含创建组织）
 *   login    — 登录（v1 简化：只校验 email + password hash 匹配）
 *   logout   — 登出
 *   me       — 获取当前用户
 */
export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json()

    switch (action) {
      case 'register':
        return await handleRegister(params)
      case 'login':
        return await handleLogin(params)
      case 'logout':
        return await handleLogout()
      case 'me':
        return await handleMe()
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return toApiErrorResponse(error, '认证服务暂不可用，请先确认 PostgreSQL 已启动。')
  }
}

async function handleRegister(params: {
  email: string
  name: string
  password: string
  orgName?: string
}) {
  // 检查邮箱是否已存在
  const [existing] = await db.select().from(users).where(eq(users.email, params.email)).limit(1)
  if (existing) {
    return Response.json({ error: '邮箱已注册' }, { status: 409 })
  }

  // v1 简化：直接存储密码（生产环境应使用 bcrypt）
  const passwordHash = params.password

  let orgId: string | null = null
  if (params.orgName) {
    const slug = params.orgName.toLowerCase().replace(/\s+/g, '-')
    // 先查找已有组织
    const [existing] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1)
    if (existing) {
      orgId = existing.id
    } else {
      const [org] = await db
        .insert(organizations)
        .values({ name: params.orgName, slug })
        .returning()
      orgId = org.id
    }
  }

  const [user] = await db
    .insert(users)
    .values({
      email: params.email,
      name: params.name,
      passwordHash,
      orgId,
      role: orgId ? 'org_admin' : 'teacher',
    })
    .returning()

  const cookieStore = await cookies()
  cookieStore.set('pf-user-id', user.id, { httpOnly: true, path: '/' })

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.orgId,
    orgName: params.orgName ?? null,
  }, { status: 201 })
}

async function handleLogin(params: { email: string; password: string }) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1)

  if (!user || user.passwordHash !== params.password) {
    return Response.json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('pf-user-id', user.id, { httpOnly: true, path: '/' })

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.orgId,
  })
}

async function handleLogout() {
  const cookieStore = await cookies()
  cookieStore.delete('pf-user-id')
  return Response.json({ ok: true })
}

async function handleMe() {
  await db.execute(sql`select 1`)
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ user: null, serviceAvailable: true })
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      orgName: user.orgName,
    },
    serviceAvailable: true,
  })
}
