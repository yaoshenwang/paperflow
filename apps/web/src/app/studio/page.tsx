'use client'

import { SourceBin } from '@/components/source-bin/SourceBin'
import { Timeline } from '@/components/timeline/Timeline'
import { Viewer } from '@/components/viewer/Viewer'
import { Inspector } from '@/components/inspector/Inspector'

export default function StudioPage() {
  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Top bar */}
      <header className="flex h-10 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-600">Paperflow</span>
          <span className="text-xs text-zinc-400">Studio</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
            导出
          </button>
        </div>
      </header>

      {/* Main area: SourceBin | Viewer | Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Source Bin */}
        <div className="w-72 shrink-0">
          <SourceBin />
        </div>

        {/* Center: Viewer */}
        <div className="flex-1">
          <Viewer />
        </div>

        {/* Right: Inspector */}
        <div className="w-72 shrink-0">
          <Inspector />
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="h-52 shrink-0">
        <Timeline />
      </div>
    </div>
  )
}
