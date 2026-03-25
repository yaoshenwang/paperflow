'use client'

import { usePaperStore } from '@/store/paper-store'
import { Lock, Unlock, Trash2, GripVertical } from 'lucide-react'

export function Timeline() {
  const {
    sections,
    clips,
    selectedClipId,
    selectClip,
    removeClip,
    toggleClipLock,
    updateClipScore,
  } = usePaperStore()

  const totalScore = clips.reduce((sum, c) => sum + c.score, 0)

  return (
    <div className="flex h-full flex-col border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          组卷时间线
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">
            共 {clips.length} 题
          </span>
          <span className="font-medium text-blue-600">
            总分 {totalScore}
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-x-auto">
        {sections
          .sort((a, b) => a.order - b.order)
          .map((section) => {
            const sectionClips = clips
              .filter((c) => c.sectionId === section.id)
              .sort((a, b) => a.order - b.order)
            const sectionScore = sectionClips.reduce((s, c) => s + c.score, 0)

            return (
              <div
                key={section.id}
                className="flex min-w-[200px] flex-1 flex-col border-r border-zinc-200 last:border-r-0 dark:border-zinc-800"
              >
                <div className="bg-zinc-100 px-3 py-1.5 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {section.title}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {sectionClips.length}题 / {sectionScore}分
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-1 overflow-y-auto p-1">
                  {sectionClips.map((clip, idx) => (
                    <div
                      key={clip.id}
                      onClick={() => selectClip(clip.id)}
                      className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                        selectedClipId === clip.id
                          ? 'bg-blue-100 border border-blue-400 dark:bg-blue-900/30 dark:border-blue-600'
                          : 'bg-white border border-zinc-200 hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-700'
                      }`}
                    >
                      <GripVertical className="h-3 w-3 shrink-0 text-zinc-300 cursor-grab" />
                      <span className="shrink-0 font-medium text-zinc-600 dark:text-zinc-400">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                        {clip.questionItemId.slice(0, 8)}...
                      </span>
                      <input
                        type="number"
                        value={clip.score}
                        onChange={(e) => updateClipScore(clip.id, Number(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-10 rounded border border-zinc-300 px-1 text-center text-xs dark:border-zinc-600 dark:bg-zinc-800"
                      />
                      <span className="text-zinc-400">分</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleClipLock(clip.id) }}
                        className="text-zinc-400 hover:text-zinc-600"
                        title={clip.locked ? '解锁' : '锁定'}
                      >
                        {clip.locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                        className="text-zinc-400 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {sectionClips.length === 0 && (
                    <div className="flex h-16 items-center justify-center text-xs text-zinc-300">
                      拖入题目
                    </div>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
