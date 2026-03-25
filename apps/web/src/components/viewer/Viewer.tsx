'use client'

import { usePaperStore } from '@/store/paper-store'
import { RefreshCw, Loader2, FileText } from 'lucide-react'

export function Viewer() {
  const { previewPdf, previewLoading, refreshPreview, clips } = usePaperStore()

  return (
    <div className="flex h-full flex-col bg-zinc-100 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          卷面预览
        </h2>
        <button
          onClick={refreshPreview}
          disabled={previewLoading || clips.length === 0}
          className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {previewLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          刷新预览
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {previewPdf ? (
          <iframe
            src={previewPdf}
            className="h-full w-full rounded border border-zinc-300 bg-white shadow-sm"
            title="PDF Preview"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <FileText className="h-16 w-16 stroke-1" />
            <p className="text-sm">
              {clips.length === 0
                ? '添加题目后点击"刷新预览"查看卷面'
                : '点击"刷新预览"生成卷面'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
