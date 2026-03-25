'use client'

import { SourceBin } from '@/components/source-bin/SourceBin'
import { Timeline } from '@/components/timeline/Timeline'
import { Viewer } from '@/components/viewer/Viewer'
import { Inspector } from '@/components/inspector/Inspector'

export default function StudioPage() {
  return (
    <div className="flex h-screen flex-col bg-zinc-100 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-600">Paperflow</span>
            <span className="text-xs text-zinc-400">组卷工作台</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">从题库选题，整理成试卷，预览后导出。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-300">
            左侧选题，中间组卷，右侧导出
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[320px_minmax(0,1fr)_360px] overflow-hidden">
        <div className="min-w-0">
          <SourceBin />
        </div>

        <div className="grid min-w-0 grid-rows-[minmax(0,1fr)_360px] overflow-hidden border-l border-r border-zinc-200 dark:border-zinc-800">
          <Timeline />
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <Viewer />
          </div>
        </div>

        <div className="min-w-0">
          <Inspector />
        </div>
      </div>
    </div>
  )
}
