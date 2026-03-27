'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'org_admin', label: 'Org Admin' },
] as const

const ROLE_CAPABILITIES: Array<{ role: string; abilities: string[] }> = [
  {
    role: 'Teacher',
    abilities: ['查看公共题库', '创建试卷', '导出试卷', '上传来源素材'],
  },
  {
    role: 'Reviewer',
    abilities: ['Teacher 全部能力', '审核题目', '执行 Review Center 终审'],
  },
  {
    role: 'Librarian',
    abilities: ['Reviewer 全部能力', '管理版权状态', '导入题包 / JSON / QTI', '维护校本题库'],
  },
  {
    role: 'Org Admin',
    abilities: ['Librarian 全部能力', '管理组织成员角色', '管理组织配置', '管理正式发布权限'],
  },
]

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  orgId: string | null
  orgName: string | null
}

type OrgMember = {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersMessage, setMembersMessage] = useState<string | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    orgName: '',
  })

  const loadMembers = async () => {
    setMembersLoading(true)
    setMembersMessage(null)
    try {
      const response = await fetch('/api/org/members')
      const data = await response.json()
      if (!response.ok) {
        setMembers([])
        setMembersMessage(data.error ?? '成员信息读取失败')
        return
      }
      setMembers(data.members ?? [])
    } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => {
    const loadMe = async () => {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'me' }),
      })
      const data = await response.json()
      setUser(data.user ?? null)
    }

    loadMe()
  }, [])

  useEffect(() => {
    if (user?.role === 'org_admin' && user.orgId) {
      loadMembers()
    } else {
      setMembers([])
      setMembersMessage(null)
    }
  }, [user?.orgId, user?.role])

  const submit = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? {
                action: 'login',
                email: form.email,
                password: form.password,
              }
            : {
                action: 'register',
                email: form.email,
                password: form.password,
                name: form.name,
                orgName: form.orgName || undefined,
              },
        ),
      })

      const data = await response.json()
      if (!response.ok) {
        setMessage(data.error ?? '操作失败')
        return
      }

      router.push('/studio')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    setUser(null)
    setMessage('已退出登录')
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    setUpdatingMemberId(memberId)
    setMembersMessage(null)
    try {
      const response = await fetch('/api/org/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId, role }),
      })
      const data = await response.json()

      if (!response.ok) {
        setMembersMessage(data.error ?? '成员角色更新失败')
        return
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? { ...member, role: data.member.role } : member,
        ),
      )

      if (user?.id === memberId) {
        setUser((current) => (current ? { ...current, role: data.member.role } : current))
      }

      setMembersMessage('成员角色已更新')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 dark:bg-black">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <section className="border-b border-zinc-200 p-8 dark:border-zinc-800 md:border-b-0 md:border-r">
            <p className="text-sm font-semibold text-blue-600">Paperflow</p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">登录组织账号，启用校本题库与正式导出</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">
              第七步的目标不是只做账户表，而是给公共题库、校本题库、资源上传、正式导出建立真实的权限边界。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <p className="text-xs text-zinc-400">公共题库</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">未登录也能查看已审核、版权合规的公共原题。</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <p className="text-xs text-zinc-400">校本题库</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">登录并加入组织后，可查看和上传本校题库资源。</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <p className="text-xs text-zinc-400">正式导出</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">只有登录用户才能执行正式导出，且题目必须审核通过且版权合规。</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <p className="text-xs text-zinc-400">角色</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Teacher、Reviewer、Librarian、Org Admin 权限逐级展开。</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Permission Matrix</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ROLE_CAPABILITIES.map((entry) => (
                  <div key={entry.role} className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.role}</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {entry.abilities.map((ability) => (
                        <p key={ability}>{ability}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-8">
            {user ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-zinc-400">当前会话</p>
                  <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    {user.email} · {user.role}
                    {user.orgName ? ` / ${user.orgName}` : ''}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/studio"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    回到 Studio
                  </Link>
                  <button
                    onClick={logout}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    退出登录
                  </button>
                </div>

                {message ? <p className="text-sm text-zinc-500">{message}</p> : null}

                {user.role === 'org_admin' && user.orgId ? (
                  <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-zinc-400">组织成员</p>
                        <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                          {user.orgName || '当前组织'}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          同一组织成员可通过注册时填写相同组织名称加入；这里可直接调整成员角色。
                        </p>
                      </div>
                      <button
                        onClick={loadMembers}
                        disabled={membersLoading}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        {membersLoading ? '刷新中...' : '刷新成员'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {member.name}
                                {member.id === user.id ? '（当前账号）' : ''}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">{member.email}</p>
                            </div>

                            <select
                              value={member.role}
                              onChange={(event) => updateMemberRole(member.id, event.target.value)}
                              disabled={updatingMemberId === member.id}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                      {members.length === 0 && !membersLoading ? (
                        <p className="text-sm text-zinc-500">当前组织还没有其他成员。</p>
                      ) : null}
                    </div>

                    {membersMessage ? (
                      <p className="text-sm text-zinc-500">{membersMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex gap-2 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
                  <button
                    onClick={() => setMode('login')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm ${
                      mode === 'login'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                        : 'text-zinc-500'
                    }`}
                  >
                    登录
                  </button>
                  <button
                    onClick={() => setMode('register')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm ${
                      mode === 'register'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                        : 'text-zinc-500'
                    }`}
                  >
                    注册
                  </button>
                </div>

                <div className="space-y-4">
                  {mode === 'register' ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">姓名</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">邮箱</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">密码</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>

                  {mode === 'register' ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">组织 / 学校名称</span>
                      <input
                        value={form.orgName}
                        onChange={(event) => setForm((state) => ({ ...state, orgName: event.target.value }))}
                        placeholder="可选，但接入校本题库建议填写"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </label>
                  ) : null}
                </div>

                <button
                  onClick={submit}
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '处理中...' : mode === 'login' ? '登录' : '注册并创建会话'}
                </button>

                {message ? <p className="text-sm text-red-600">{message}</p> : null}

                <Link href="/studio" className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  先返回 Studio 看公共题库
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
