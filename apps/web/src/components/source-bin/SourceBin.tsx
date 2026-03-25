'use client'

import { useState } from 'react'
import { usePaperStore } from '@/store/paper-store'
import { Search, Plus, Loader2 } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选',
  multiple_choice: '多选',
  fill_blank: '填空',
  short_answer: '简答',
  computation: '计算',
  proof: '证明',
  essay: '论述',
  true_false: '判断',
  composite: '综合',
}

export function SourceBin() {
  const [query, setQuery] = useState('')
  const { searchResults, searchLoading, searchItems, addClip, sections } = usePaperStore()

  const getDefaultSectionId = (questionType: string) => {
    const section =
      (questionType.includes('choice') && sections.find((sec) => sec.title.includes('选择'))) ||
      (questionType === 'fill_blank' && sections.find((sec) => sec.title.includes('填空'))) ||
      sections[sections.length - 1]

    return section?.id
  }

  const handleSearch = () => {
    searchItems(query)
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">题库</h2>
        <p className="mb-3 text-xs text-zinc-400">搜索题目，点击加入试卷。</p>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索题目..."
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {searchResults.length === 0 && !searchLoading && (
          <p className="p-4 text-center text-sm text-zinc-400">搜索题目后从这里加入试卷</p>
        )}
        {searchResults.map((item) => (
          <div
            key={item.id}
            className="mb-2 rounded border border-zinc-200 p-2 text-sm hover:border-blue-400 dark:border-zinc-700"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {TYPE_LABELS[item.questionType] ?? item.questionType}
              </span>
              <span className="text-xs text-zinc-400">
                难度 {item.difficulty != null ? (item.difficulty * 10).toFixed(0) : '?'}/10
              </span>
            </div>
            <p className="mb-1 line-clamp-2 text-zinc-700 dark:text-zinc-300">
              {item.contentPreview || '(无预览)'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{item.sourceLabel}</span>
              <button
                onClick={() => {
                  const sectionId = getDefaultSectionId(item.questionType)
                  if (sectionId) addClip(sectionId, item, 5)
                }}
                className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
              >
                <Plus className="mr-1 inline h-3 w-3" />
                加入试卷
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
