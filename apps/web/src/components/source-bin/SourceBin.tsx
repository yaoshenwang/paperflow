'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePaperStore } from '@/store/paper-store'
import { Search, Plus, Loader2, Building2, LogOut } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选',
  multiple_choice: '多选',
  fill_blank: '填空',
  short_answer: '简答',
  computation: '计算',
  proof: '证明',
  essay: '论述',
  true_false: '判断',
  composite: '综合',
}

type SessionUser = {
  id: string
  name: string
  role: string
  orgId: string | null
  orgName: string | null
}

export function SourceBin() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'public' | 'school' | 'all'>('public')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { searchResults, searchLoading, searchItems, addClip, sections } = usePaperStore()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'me' }),
        })
        const data = await response.json()
        setUser(data.user ?? null)
      } finally {
        setAuthLoading(false)
      }
    }

    loadUser()
  }, [])

  useEffect(() => {
    if (authLoading) return
    searchItems(query, { scope })
  }, [authLoading, scope, searchItems])

  const getDefaultSectionId = (questionType: string) => {
    const section =
      (questionType.includes('choice') && sections.find((sec) => sec.title.includes('选择'))) ||
      (questionType === 'fill_blank' && sections.find((sec) => sec.title.includes('填空'))) ||
      sections[sections.length - 1]

    return section?.id
  }

  const handleSearch = () => {
    searchItems(query, { scope })
  }

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    setUser(null)
    setScope('public')
    setQuery('')
    searchItems('', { scope: 'public' })
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">题库</h2>
        <p className="mb-3 text-xs text-zinc-400">按权限查看公共题库或校本题库，搜索后加入试卷。</p>

        <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          {authLoading ? (
            <p className="text-xs text-zinc-400">正在读取当前会话...</p>
          ) : user ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</p>
                  <p className="text-xs text-zinc-500">
                    {user.role}
                    {user.orgName ? ` / ${user.orgName}` : ''}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  title="退出登录"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Building2 className="h-3.5 w-3.5" />
                {user.orgName ? '可访问校本题库，并可执行正式导出。' : '当前账号未绑定组织，仅可访问公共题库。'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">未登录时只可查看公共题库。登录后可访问校本题库与正式导出。</p>
              <Link
                href="/auth"
                className="inline-flex rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                去登录 / 注册
              </Link>
            </div>
          )}
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-xs font-medium text-zinc-500">题库范围</label>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as 'public' | 'school' | 'all')}
            className="w-full rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="public">公共题库</option>
            <option value="school" disabled={!user?.orgId}>
              校本题库
            </option>
            <option value="all" disabled={!user?.orgId}>
              全部可见题库
            </option>
          </select>
        </div>

        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索题目..."
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {searchResults.length === 0 && !searchLoading && (
          <p className="p-4 text-center text-sm text-zinc-400">搜索题目后从这里加入试卷</p>
        )}
        {searchResults.map((item) => (
          <div
            key={item.id}
            className="mb-2 rounded border border-zinc-200 p-2 text-sm hover:border-blue-400 dark:border-zinc-700"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {TYPE_LABELS[item.questionType] ?? item.questionType}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    item.libraryScope === 'school'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
                  }`}
                >
                  {item.libraryScope === 'school' ? '校本题库' : '公共题库'}
                </span>
              </div>
              <span className="text-xs text-zinc-400">
                难度 {item.difficulty != null ? (item.difficulty * 10).toFixed(0) : '?'}/10
              </span>
            </div>
            <p className="mb-1 line-clamp-2 text-zinc-700 dark:text-zinc-300">
              {item.contentPreview || '(无预览)'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {item.sourceLabel} · {item.reviewStatus}
              </span>
              <button
                onClick={() => {
                  const sectionId = getDefaultSectionId(item.questionType)
                  if (sectionId) addClip(sectionId, item, 5)
                }}
                className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
              >
                <Plus className="mr-1 inline h-3 w-3" />
                加入试卷
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
