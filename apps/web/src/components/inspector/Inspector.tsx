'use client'

import { usePaperStore } from '@/store/paper-store'
import { Settings, Bot } from 'lucide-react'
import { useState } from 'react'

export function Inspector() {
  const { selectedClipId, clips, updateClipScore, toggleClipLock, title, setTitle } = usePaperStore()
  const [tab, setTab] = useState<'props' | 'ai'>('props')

  const selectedClip = clips.find((c) => c.id === selectedClipId)

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setTab('props')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            tab === 'props'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Settings className="mr-1 inline h-3 w-3" />
          属性
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`flex-1 px-3 py-2 text-xs font-medium ${
            tab === 'ai'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Bot className="mr-1 inline h-3 w-3" />
          AI 助手
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'props' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">试卷标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            {selectedClip ? (
              <>
                <hr className="border-zinc-200 dark:border-zinc-800" />
                <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  题目 Clip
                </h3>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">题目 ID</label>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                    {selectedClip.questionItemId}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">分值</label>
                  <input
                    type="number"
                    value={selectedClip.score}
                    onChange={(e) => updateClipScore(selectedClip.id, Number(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">锁定状态</label>
                  <button
                    onClick={() => toggleClipLock(selectedClip.id)}
                    className={`rounded px-2 py-1 text-xs ${
                      selectedClip.locked
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {selectedClip.locked ? '已锁定 — 点击解锁' : '未锁定 — 点击锁定'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-400">选择时间线上的题目查看属性</p>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              AI 助手可以帮你自动配平难度分布、检查知识点覆盖、推荐替换题目。
            </p>
            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">快捷操作</p>
              <div className="space-y-1">
                <button className="w-full rounded bg-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  🎯 生成组卷蓝图
                </button>
                <button className="w-full rounded bg-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  🔍 自动搜题填充
                </button>
                <button className="w-full rounded bg-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  ⚖️ 检查难度分布
                </button>
                <button className="w-full rounded bg-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  📋 检查知识覆盖
                </button>
                <button className="w-full rounded bg-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  🔄 替换相似题
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
