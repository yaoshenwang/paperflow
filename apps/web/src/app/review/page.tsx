'use client'

import { useState } from 'react'
import { usePaperStore } from '@/store/paper-store'
import { CheckCircle, AlertTriangle, XCircle, Shield, Loader2 } from 'lucide-react'

type ReviewCheck = {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

type ReviewResult = {
  checks: ReviewCheck[]
  summary: { pass: number; warn: number; fail: number; publishable: boolean }
}

const STATUS_ICON = {
  pass: <CheckCircle className="h-4 w-4 text-green-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
}

const STATUS_BG = {
  pass: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  warn: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
  fail: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
}

export default function ReviewPage() {
  const { title, sections, clips } = usePaperStore()
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runReview = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sections, clips }),
      })
      const data = await res.json()
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Review Center</h1>
          </div>
          <button
            onClick={runReview}
            disabled={loading || clips.length === 0}
            className="flex items-center gap-1 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            执行审查
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          审查试卷「{title}」— 共 {clips.length} 题
        </p>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        {!result && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
            <Shield className="h-16 w-16 stroke-1" />
            <p>点击「执行审查」检查试卷是否可发布</p>
          </div>
        )}

        {result && (
          <>
            {/* Summary */}
            <div className={`mb-6 rounded-lg border p-4 ${result.summary.publishable ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}>
              <div className="flex items-center gap-2">
                {result.summary.publishable ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {result.summary.publishable ? '可以发布' : '存在问题，暂不可发布'}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-600">✓ 通过 {result.summary.pass}</span>
                <span className="text-amber-600">⚠ 警告 {result.summary.warn}</span>
                <span className="text-red-600">✕ 失败 {result.summary.fail}</span>
              </div>
            </div>

            {/* Check list */}
            <div className="space-y-2">
              {result.checks.map((check) => (
                <div
                  key={check.id}
                  className={`flex items-center gap-3 rounded border p-3 ${STATUS_BG[check.status]}`}
                >
                  {STATUS_ICON[check.status]}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{check.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
