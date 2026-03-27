'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle, Loader2, Shield, XCircle } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'

type ReviewCheck = {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

type ReviewQuestion = {
  path: string
  relativePath: string
  referencedInPaper: boolean
  parseError: string | null
  frontMatter: {
    id?: string
    review?: string
    rights?: string
    source?: {
      label?: string
    }
  }
}

type ReviewArtifact = {
  id: string
  label: string
  filename: string
  format: 'pdf' | 'docx' | 'json' | 'qti'
  mode: 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
  ready: boolean
  size: number
  pages?: number
  error?: string
}

type ReviewResult = {
  checks: ReviewCheck[]
  summary: { pass: number; warn: number; fail: number; publishable: boolean }
  questions: ReviewQuestion[]
  paperPath: string
  template: string
  artifacts: ReviewArtifact[]
}

const STATUS_ICON = {
  pass: <CheckCircle className="h-4 w-4 text-green-600" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  fail: <XCircle className="h-4 w-4 text-red-600" />,
}

function ReviewPageContent() {
  const params = useSearchParams()
  const projectPath = params.get('projectPath')?.trim() ?? ''
  const workspace = useWorkspaceStore((state) => state.workspace)
  const loadWorkspace = useWorkspaceStore((state) => state.loadWorkspace)
  const saveWorkspace = useWorkspaceStore((state) => state.saveWorkspace)
  const workspaceDirty = useWorkspaceStore((state) => state.workspaceDirty)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) return
    void loadWorkspace(projectPath)
  }, [loadWorkspace, projectPath])

  const runReview = async () => {
    if (!workspace?.projectPath) return
    setLoading(true)
    setError(null)
    try {
      if (workspaceDirty) {
        await saveWorkspace()
      }
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: workspace.projectPath }),
      })
      const data = (await res.json()) as ReviewResult & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? `Review failed: ${res.status}`)
      }
      setResult(data)
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unknown review error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.10),_transparent_28%),linear-gradient(180deg,#fffaf4_0%,#f7efe6_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(65,35,14,0.10)]">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">Review Center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">正式发布校对</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              这里会直接读取当前工作区的 lint / publishability 结果，并作为正式导出的硬门槛。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={workspace?.projectPath ? `/editor?projectPath=${encodeURIComponent(workspace.projectPath)}` : '/editor'}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              返回编辑器
            </Link>
            <button
              onClick={() => void runReview()}
              disabled={loading || !workspace?.projectPath}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              执行审查
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="space-y-4 rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,241,232,0.98))] p-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Workspace</p>
              <p className="mt-2 text-base font-semibold text-zinc-950">{workspace?.title ?? '未加载工作区'}</p>
              <p className="mt-2 break-all text-sm text-zinc-600">{workspace?.projectPath ?? (projectPath || '未指定 projectPath')}</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Status</p>
              <p className="mt-2 text-sm text-zinc-600">
                {workspaceDirty ? '存在未落盘修改，执行审查前会先自动保存。' : '当前工作区已与磁盘同步。'}
              </p>
            </div>

            {result ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Paper</p>
                <p className="mt-2 break-all text-sm text-zinc-700">{result.paperPath}</p>
                <p className="mt-2 text-sm text-zinc-600">模板：{result.template}</p>
              </div>
            ) : null}

            {result ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  result.summary.publishable
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                <p className="font-medium">{result.summary.publishable ? '可以正式导出' : '暂不可正式导出'}</p>
                <p className="mt-1">
                  通过 {result.summary.pass} · 警告 {result.summary.warn} · 失败 {result.summary.fail}
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}
          </aside>

          <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-white p-5">
            {!result && !loading ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-zinc-500">
                <Shield className="h-12 w-12 text-zinc-300" />
                <p className="mt-4 text-sm">执行审查后，这里会展示 Review Center 的完整检查项。</p>
              </div>
            ) : null}

            {result?.checks.map((check) => (
              <article key={check.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  {STATUS_ICON[check.status]}
                  <div>
                    <p className="text-sm font-medium text-zinc-950">{check.name}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{check.detail}</p>
                  </div>
                </div>
              </article>
            ))}

            {result ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Artifacts</p>
                    <p className="mt-1 text-sm font-medium text-zinc-950">正式导出产物矩阵</p>
                  </div>
                  <FileTextBadge />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {result.artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        artifact.ready ? 'border-green-200 bg-white text-zinc-800' : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      <p className="font-medium">{artifact.label}</p>
                      <p className="mt-1 text-xs">
                        {artifact.ready
                          ? `${formatSize(artifact.size)}${artifact.pages ? ` · ${artifact.pages} 页` : ''}`
                          : artifact.error ?? '渲染失败'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Referenced Questions</p>
                <div className="mt-3 space-y-2">
                  {result.questions
                    .filter((question) => question.referencedInPaper)
                    .map((question) => (
                      <div key={question.relativePath} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950">
                              {question.frontMatter.id ?? question.relativePath}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {question.frontMatter.source?.label ?? '未补全来源'} · review:{question.frontMatter.review ?? '-'} · rights:{question.frontMatter.rights ?? '-'}
                            </p>
                          </div>
                          {question.frontMatter.id ? (
                            <Link
                              href={`/questions/${question.frontMatter.id}${workspace?.projectPath ? `?projectPath=${encodeURIComponent(workspace.projectPath)}` : ''}`}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50"
                            >
                              打开题目
                            </Link>
                          ) : null}
                        </div>
                        {question.parseError ? (
                          <p className="mt-2 text-xs text-red-700">{question.parseError}</p>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewPageContent />
    </Suspense>
  )
}

function FileTextBadge() {
  return <Shield className="h-4 w-4 text-zinc-400" />
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
