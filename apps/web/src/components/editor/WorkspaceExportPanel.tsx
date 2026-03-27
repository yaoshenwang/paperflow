'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Archive, Download, FileDown, FileType2, Loader2, WandSparkles } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'

type ExportFormat = 'pdf' | 'docx' | 'zip' | 'typst' | 'json' | 'qti' | 'bundle'
type ExportMode = 'student' | 'teacher' | 'answer_sheet' | 'solution_book'

const EXPORT_CARDS: Array<{
  format: ExportFormat
  title: string
  detail: string
  icon: ReactNode
}> = [
  { format: 'pdf', title: 'PDF 学生卷', detail: '按当前模板和学生模式导出', icon: <FileDown className="h-4 w-4" /> },
  { format: 'bundle', title: '全套产物 ZIP', detail: '一次导出学生卷 / 教师卷 / 答题卡 / 解析册 / JSON / QTI / DOCX', icon: <Archive className="h-4 w-4" /> },
  { format: 'docx', title: 'DOCX', detail: '适合进一步进入 Word 流程', icon: <FileType2 className="h-4 w-4" /> },
  { format: 'typst', title: 'Typst', detail: '专家模式排版源码', icon: <FileType2 className="h-4 w-4" /> },
  { format: 'json', title: 'JSON AST', detail: '结构化交换与审计', icon: <FileType2 className="h-4 w-4" /> },
  { format: 'qti', title: 'QTI', detail: '测评互操作交换包', icon: <FileType2 className="h-4 w-4" /> },
  { format: 'zip', title: '工程 ZIP', detail: '导出整个文件工作区快照', icon: <Archive className="h-4 w-4" /> },
]

export function WorkspaceExportPanel() {
  const params = useSearchParams()
  const workspace = useWorkspaceStore((state) => state.workspace)
  const projectPath = params.get('projectPath')?.trim() ?? workspace?.projectPath ?? ''
  const previewMode = useWorkspaceStore((state) => state.workspace?.mode ?? 'student')
  const templatePreset = useWorkspaceStore((state) => state.workspace?.templatePreset ?? 'default')
  const loadWorkspace = useWorkspaceStore((state) => state.loadWorkspace)
  const [mode, setMode] = useState<ExportMode>(previewMode)
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [lintLoading, setLintLoading] = useState(false)
  const [lintReport, setLintReport] = useState<unknown>(null)

  useEffect(() => {
    setMode(previewMode)
  }, [previewMode])

  useEffect(() => {
    if (!projectPath) return
    void loadWorkspace(projectPath)
  }, [loadWorkspace, projectPath])

  const runExport = async () => {
    setExporting(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: workspace?.projectPath,
          mode,
          format,
          workspace,
        }),
      })

      if (!response.ok) {
        const payload = await safeJson(response)
        throw new Error(typeof payload.error === 'string' ? payload.error : `Export failed: ${response.status}`)
      }

      const blob = await response.blob()
      const ext = format === 'zip' || format === 'qti' || format === 'bundle' ? 'zip' : format
      downloadBlob(blob, `${slugify(workspace?.title ?? 'paperflow')}.${ext}`)
      setStatus('导出成功，文件已开始下载')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unknown export error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_28%),linear-gradient(180deg,#fffaf4_0%,#f6efe6_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(65,35,14,0.10)] backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">Export</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">导出面板</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                这里直接调用 `POST /api/export` 和 `POST /api/lint`。正式导出会先过 Review Center 的 publishability 检查。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={projectPath ? `/editor?projectPath=${encodeURIComponent(projectPath)}` : '/editor'}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                返回编辑器
              </Link>
              <Link
                href={projectPath ? `/review?projectPath=${encodeURIComponent(projectPath)}` : '/review'}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                Review Center
              </Link>
              <button
                onClick={() => {
                  if (!projectPath) {
                    setLintReport({ error: 'No workspace selected' })
                    return
                  }
                  setLintLoading(true)
                  void fetch('/api/lint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectPath }),
                  })
                    .then(safeJson)
                    .then((report) => setLintReport(report))
                    .finally(() => setLintLoading(false))
                }}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                {lintLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Lint
              </button>
            </div>
          </header>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {EXPORT_CARDS.map((card) => (
                  <button
                    key={card.format}
                    onClick={() => setFormat(card.format)}
                    className={`rounded-[24px] border p-4 text-left transition ${
                      format === card.format
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {card.icon}
                      <span className="text-sm font-semibold">{card.title}</span>
                    </div>
                    <p className={`mt-3 text-sm leading-6 ${format === card.format ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {card.detail}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleCard
                  title="学生卷"
                  detail="隐藏答案和解析"
                  active={mode === 'student'}
                  onClick={() => setMode('student')}
                />
                <ToggleCard
                  title="教师卷"
                  detail="显示答案和解析"
                  active={mode === 'teacher'}
                  onClick={() => setMode('teacher')}
                />
                <ToggleCard
                  title="答题卡"
                  detail="生成客观题作答区和主观题留白"
                  active={mode === 'answer_sheet'}
                  onClick={() => setMode('answer_sheet')}
                />
                <ToggleCard
                  title="解析册"
                  detail="按解析阅读模式输出"
                  active={mode === 'solution_book'}
                  onClick={() => setMode('solution_book')}
                />
              </div>

              <button
                onClick={runExport}
                disabled={exporting || !workspace || !projectPath}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出 {format.toUpperCase()}
              </button>

              {status ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                  {status}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}
            </section>

            <aside className="space-y-4 rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,241,232,0.98))] p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Workspace</p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-950">{workspace?.title ?? '未加载工作区'}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  当前模板：{templatePreset} · 当前模式：{mode}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetaTile label="Sections" value={String(workspace?.sections.length ?? 0)} />
                <MetaTile label="Clips" value={String(workspace?.clips.length ?? 0)} />
                <MetaTile label="Questions" value={String(workspace?.questions.length ?? 0)} />
                <MetaTile label="Project" value={workspace?.projectPath ?? '-'} />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Lint</p>
                <p className="mt-2 text-sm text-zinc-600">
                  通过 `POST /api/lint` 可以在导出前做本地静态校验。这里先按主线程约定接线。
                </p>
                {lintReport ? (
                  <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-zinc-950 px-3 py-2 text-xs text-zinc-100">
                    {JSON.stringify(lintReport, null, 2)}
                  </pre>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}

function ToggleCard({
  title,
  detail,
  active,
  onClick,
}: {
  title: string
  detail: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-2 text-sm leading-6 ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>{detail}</p>
    </button>
  )
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-zinc-950">{value}</p>
    </div>
  )
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) return {}
  return (await response.json()) as Record<string, unknown>
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
