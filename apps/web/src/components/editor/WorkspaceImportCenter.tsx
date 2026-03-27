'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowRight, Download, FileArchive, FolderOpen, Loader2 } from 'lucide-react'

type ImportFormat = 'demo' | 'project_folder' | 'project_zip' | 'question_pack_zip' | 'paperflow_json' | 'qti_zip'

const IMPORT_OPTIONS: Array<{
  value: ImportFormat
  title: string
  detail: string
  needsSourcePath: boolean
}> = [
  { value: 'demo', title: '导入 Demo', detail: '直接复制内置示例工程', needsSourcePath: false },
  { value: 'project_folder', title: '已有工程目录', detail: '把现有 Quarto 工作区复制到新目录', needsSourcePath: true },
  { value: 'project_zip', title: '工程 ZIP', detail: '从完整工程快照 ZIP 恢复工作区', needsSourcePath: true },
  { value: 'question_pack_zip', title: '题包 ZIP', detail: '安装 pack 产物到当前工作区', needsSourcePath: true },
  { value: 'paperflow_json', title: 'Paperflow JSON', detail: '从 JSON AST / 导出包重建工作区', needsSourcePath: true },
  { value: 'qti_zip', title: 'QTI ZIP', detail: '导入 QTI assessment test + item 包', needsSourcePath: true },
]

export function WorkspaceImportCenter() {
  const router = useRouter()
  const params = useSearchParams()
  const initialProjectPath = params.get('projectPath')?.trim() || 'paperflow-imported-project'
  const [format, setFormat] = useState<ImportFormat>('demo')
  const [projectPath, setProjectPath] = useState(initialProjectPath)
  const [sourcePath, setSourcePath] = useState('')
  const [overwrite, setOverwrite] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const currentOption = useMemo(
    () => IMPORT_OPTIONS.find((option) => option.value === format) ?? IMPORT_OPTIONS[0],
    [format],
  )

  const runImport = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          format,
          sourcePath: currentOption.needsSourcePath ? sourcePath : undefined,
          overwrite,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? `Import failed: ${response.status}`)
      }
      setMessage('导入完成，准备跳转到编辑器。')
      router.push(`/editor?projectPath=${encodeURIComponent(projectPath)}`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unknown import error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_28%),linear-gradient(180deg,#fffaf4_0%,#f4ede4_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(65,35,14,0.10)]">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">Import Center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">导入与恢复工作区</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              这里先补齐非 AI 导入链路：Demo、已有工程、工程 ZIP、题包 ZIP、Paperflow JSON 和 QTI。
              PDF / Word / 图片导入仍依赖 OCR 与分题流程，按当前要求暂不实现。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              返回首页
            </Link>
            <Link
              href={projectPath ? `/editor?projectPath=${encodeURIComponent(projectPath)}` : '/editor'}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              打开编辑器
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {IMPORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    format === option.value
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <p className="text-sm font-semibold">{option.title}</p>
                  <p className={`mt-2 text-sm leading-6 ${format === option.value ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {option.detail}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-zinc-700">目标 projectPath</span>
                <input
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="paperflow-imported-project"
                />
              </label>

              {currentOption.needsSourcePath ? (
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-zinc-700">源路径</span>
                  <input
                    value={sourcePath}
                    onChange={(event) => setSourcePath(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="/absolute/path/to/export.zip"
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
                覆盖目标目录已有内容
              </label>

              <button
                onClick={() => void runImport()}
                disabled={loading || !projectPath.trim() || (currentOption.needsSourcePath && !sourcePath.trim())}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                开始导入
              </button>

              {message ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4 rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,241,232,0.98))] p-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <FolderOpen className="h-4 w-4 text-amber-600" />
                当前导入模式
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{currentOption.detail}</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <FileArchive className="h-4 w-4 text-amber-600" />
                支持的非 AI 输入
              </div>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <p>`demo` / `project_folder` / `project_zip` 用于恢复完整工作区。</p>
                <p>`paperflow_json` 可从 JSON AST 重建题目与卷面结构。</p>
                <p>`qti_zip` 会导入 assessment test 与 assessment item。</p>
                <p>`question_pack_zip` 会安装 pack 并写入 `packs.lock`。</p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Next</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <p>导入完成后会直接跳到编辑器。</p>
                <p>如果是正式发布前的导入，下一步去 Review Center 做校对。</p>
              </div>
              <Link
                href={projectPath ? `/review?projectPath=${encodeURIComponent(projectPath)}` : '/review'}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                打开 Review
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
