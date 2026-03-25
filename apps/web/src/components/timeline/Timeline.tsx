'use client'

import { usePaperStore } from '@/store/paper-store'
import { ArrowDown, ArrowUp, Lock, Unlock, Trash2, FileText } from 'lucide-react'

export function Timeline() {
  const {
    sections,
    clips,
    selectedClipId,
    selectClip,
    removeClip,
    toggleClipLock,
    updateClipScore,
    moveClipInSection,
  } = usePaperStore()

  const totalScore = clips.reduce((sum, clip) => sum + clip.score, 0)

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">试卷内容</h2>
            <p className="mt-1 text-sm text-zinc-500">这里展示已加入的题目，可调整顺序、分值和分区。</p>
          </div>
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            共 {clips.length} 题 / {totalScore} 分
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-5">
          {sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const sectionClips = clips
                .filter((clip) => clip.sectionId === section.id)
                .sort((a, b) => a.order - b.order)
              const sectionScore = sectionClips.reduce((sum, clip) => sum + clip.score, 0)

              return (
                <section key={section.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{sectionClips.length} 题，合计 {sectionScore} 分</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {sectionClips.length === 0 ? (
                      <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <FileText className="mb-2 h-6 w-6" />
                        从左侧题库加入题目
                      </div>
                    ) : (
                      sectionClips.map((clip, index) => (
                        <div
                          key={clip.id}
                          onClick={() => selectClip(clip.id)}
                          className={`rounded-xl border p-4 transition-colors ${
                            selectedClipId === clip.id
                              ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/20'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                                  第 {index + 1} 题
                                </span>
                                <span className="text-xs text-zinc-400">{clip.questionItemId}</span>
                              </div>
                              <p className="mt-2 text-sm text-zinc-500">
                                题目已加入该分区。可在右侧调整标题、预览与导出，或在此处修改顺序和分值。
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  moveClipInSection(clip.id, 'up')
                                }}
                                className="rounded border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                title="上移"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  moveClipInSection(clip.id, 'down')
                                }}
                                className="rounded border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                title="下移"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                value={clip.score}
                                onChange={(event) => updateClipScore(clip.id, Number(event.target.value) || 0)}
                                onClick={(event) => event.stopPropagation()}
                                className="w-16 rounded border border-zinc-300 px-2 py-2 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
                              />
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  toggleClipLock(clip.id)
                                }}
                                className="rounded border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                title={clip.locked ? '解锁题目' : '锁定题目'}
                              >
                                {clip.locked ? (
                                  <Lock className="h-4 w-4 text-amber-500" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeClip(clip.id)
                                }}
                                className="rounded border border-zinc-200 p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:bg-red-950/20"
                                title="删除题目"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )
            })}
        </div>
      </div>
    </div>
  )
}
