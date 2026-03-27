'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, FolderOpen, LayoutGrid, Plus, Sparkles } from 'lucide-react'

type WorkspaceDashboardProps = {
  recentProjects?: string[]
}

function loadRecentProjects(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('paperflow.recentProjects')
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecentProjects(projects: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('paperflow.recentProjects', JSON.stringify(projects.slice(0, 6)))
}

export function WorkspaceDashboard({ recentProjects = [] }: WorkspaceDashboardProps) {
  const router = useRouter()
  const [inputPath, setInputPath] = useState('')
  const [localRecent, setLocalRecent] = useState<string[]>(() => loadRecentProjects())

  const items = localRecent.length > 0 ? localRecent : recentProjects

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(249,168,212,0.18),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(251,191,36,0.16),_transparent_26%),linear-gradient(180deg,#fffaf4_0%,#f6efe7_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-4 rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(65,35,14,0.10)] backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Open Quarto Exam Editor
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                Paperflow 现在是一个文件工作区，而不是一个平台壳。
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
                从最近项目、打开本地工程、新建试卷工程，到进入编辑器和导出，
                主路径都围绕 `paper.qmd` 和 `questions/*.md` 展开。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/new"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                新建试卷
              </Link>
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <LayoutGrid className="h-4 w-4" />
                打开编辑器
              </Link>
              <Link
                href="/export"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                导出面板
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/imports"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                导入中心
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                权限与成员
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['文件优先', '一个项目就是一个目录，核心资产不进数据库。'],
                ['Quarto-first', '编辑器围绕 `paper.qmd` 和题目 Markdown 文件。'],
                ['Source-available', '视觉编辑和源码编辑并行，不锁进私有状态。'],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-zinc-200 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-zinc-900">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(247,240,231,0.98))] p-5 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Quick Open</p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-950">打开或创建工作区</h2>
              </div>
              <FolderOpen className="h-5 w-5 text-amber-600" />
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                const next = inputPath.trim()
                if (!next) {
                  router.push('/new')
                  return
                }
                const updated = [next, ...items.filter((item) => item !== next)]
                setLocalRecent(updated)
                saveRecentProjects(updated)
                router.push(`/editor?projectPath=${encodeURIComponent(next)}`)
              }}
            >
              <label className="block text-sm font-medium text-zinc-700">项目路径</label>
              <input
                value={inputPath}
                onChange={(event) => setInputPath(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                placeholder="~/Documents/my-exam"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
              >
                打开工作区
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Recent</p>
              {items.length > 0 ? (
                items.map((projectPath) => (
                  <Link
                    key={projectPath}
                    href={`/editor?projectPath=${encodeURIComponent(projectPath)}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-white"
                  >
                    <span className="truncate">{projectPath}</span>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-4 py-6 text-sm text-zinc-500">
                  还没有最近项目。新建一个试卷工程后会出现在这里。
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
