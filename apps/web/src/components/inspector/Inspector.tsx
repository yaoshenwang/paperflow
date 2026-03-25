'use client'

import { useState } from 'react'
import { Download, FileJson, FileText, Printer, RefreshCw, Settings } from 'lucide-react'
import { usePaperStore } from '@/store/paper-store'

type ExportFormat = 'pdf' | 'typst' | 'json'

export function Inspector() {
  const {
    title,
    setTitle,
    sections,
    clips,
    itemSummaries,
    selectedClipId,
    updateClipScore,
    updateClipSection,
    toggleClipLock,
    previewLoading,
    refreshPreview,
  } = usePaperStore()
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const selectedClip = clips.find((clip) => clip.id === selectedClipId)
  const selectedItem = selectedClip ? itemSummaries[selectedClip.questionItemId] : null
  const totalScore = clips.reduce((sum, clip) => sum + clip.score, 0)

  const exportPaper = async (format: ExportFormat) => {
    setExporting(format)
    setExportError(null)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          sections,
          clips,
          format,
          mode: 'student',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setExportError(data?.error ?? '导出失败，请稍后重试。')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const ext = format === 'typst' ? 'typ' : format
      link.href = url
      link.download = `${title || 'paperflow'}.${ext}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">排版与导出</h2>
        <p className="mt-1 text-sm text-zinc-500">在这里设置试卷标题、刷新预览并导出文件。</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">试卷标题</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
              <p className="text-xs text-zinc-400">题目数量</p>
              <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{clips.length} 题</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
              <p className="text-xs text-zinc-400">当前总分</p>
              <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{totalScore} 分</p>
            </div>
          </div>

          <button
            onClick={refreshPreview}
            disabled={previewLoading || clips.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
            刷新卷面预览
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">导出</h3>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => exportPaper('pdf')}
              disabled={clips.length === 0 || exporting !== null}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                导出 PDF
              </span>
              <span className="text-xs text-zinc-400">{exporting === 'pdf' ? '处理中...' : '学生卷'}</span>
            </button>
            <button
              onClick={() => exportPaper('typst')}
              disabled={clips.length === 0 || exporting !== null}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                导出 Typst
              </span>
              <span className="text-xs text-zinc-400">{exporting === 'typst' ? '处理中...' : '排版源码'}</span>
            </button>
            <button
              onClick={() => exportPaper('json')}
              disabled={clips.length === 0 || exporting !== null}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                导出 JSON
              </span>
              <span className="text-xs text-zinc-400">{exporting === 'json' ? '处理中...' : '结构化数据'}</span>
            </button>
          </div>
          {exportError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-300">
              {exportError}
            </p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">已选题目</h3>
          </div>

          {selectedClip ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-400">题目摘要</p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {selectedItem?.contentPreview || '暂无题干摘要'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">题目 ID</p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {selectedClip.questionItemId}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
                  <p>学科</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedItem?.subject || '-'}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
                  <p>来源</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedItem?.sourceLabel || '-'}
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">所在分区</label>
                <select
                  value={selectedClip.sectionId}
                  onChange={(event) => updateClipSection(selectedClip.id, event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {sections
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">分值</label>
                <input
                  type="number"
                  value={selectedClip.score}
                  onChange={(event) => updateClipScore(selectedClip.id, Number(event.target.value) || 0)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <button
                onClick={() => toggleClipLock(selectedClip.id)}
                className={`w-full rounded-lg px-3 py-2 text-sm ${
                  selectedClip.locked
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {selectedClip.locked ? '已锁定，点击解锁' : '未锁定，点击锁定'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">点击中间的已选题目后，可在这里调整分值和锁定状态。</p>
          )}
        </section>
      </div>
    </div>
  )
}
