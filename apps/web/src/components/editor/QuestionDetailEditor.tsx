'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'

const REVIEW_OPTIONS = ['raw', 'draft', 'parsed', 'tagged', 'checked', 'approved', 'published', 'archived']
const RIGHTS_OPTIONS = ['public_domain', 'cc', 'school_owned', 'licensed', 'restricted', 'prohibited']

export function QuestionDetailEditor() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const questionId = params.id
  const projectPath = searchParams.get('projectPath')?.trim() ?? ''
  const {
    workspace,
    questionDraft,
    questionLoading,
    questionSaving,
    questionError,
    questionDirty,
    loadWorkspace,
    loadQuestion,
    updateQuestionDraft,
    saveQuestion,
    deleteQuestion,
  } = useWorkspaceStore()
  const [savingNotice, setSavingNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath || workspace?.projectPath === projectPath) return
    void loadWorkspace(projectPath)
  }, [loadWorkspace, projectPath, workspace?.projectPath])

  useEffect(() => {
    if (projectPath && workspace?.projectPath !== projectPath) return
    void loadQuestion(questionId)
  }, [loadQuestion, projectPath, questionId, workspace?.projectPath])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_26%),linear-gradient(180deg,#fffdf7_0%,#f3ede2_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(60,37,12,0.09)] backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                <Link
                  href={projectPath ? `/editor?projectPath=${encodeURIComponent(projectPath)}` : '/editor'}
                  className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-zinc-950"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Editor
                </Link>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Question Detail</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                `GET /api/items/[id]` 载入单题，`PATCH /api/items/[id]` 保存编辑。这里不依赖旧的审查或组织流程。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSavingNotice(null)
                  void saveQuestion().then((saved) => {
                    if (saved) {
                      setSavingNotice('已保存到题目接口')
                    }
                  })
                }}
                disabled={questionSaving || !questionDraft}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {questionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </button>
              <button
                onClick={() => void deleteQuestion(questionId)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </header>

          {questionError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {questionError}
            </div>
          ) : null}
          {savingNotice ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              {savingNotice}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.1fr_0.95fr]">
            <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Front Matter</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-950">结构化字段</h2>
              </div>

              <Field label="题目 ID" value={questionDraft?.id ?? questionId} readOnly />
              <Field label="标题（题干首行生成）" value={questionDraft?.title ?? ''} readOnly />
              <Field label="学科" value={questionDraft?.subject ?? ''} onChange={(value) => updateQuestionDraft({ subject: value })} />
              <Field label="年级" value={questionDraft?.grade ?? ''} onChange={(value) => updateQuestionDraft({ grade: value })} />
              <Field label="题型" value={questionDraft?.type ?? ''} onChange={(value) => updateQuestionDraft({ type: value })} />
              <Field
                label="难度"
                value={questionDraft?.difficulty != null ? String(questionDraft.difficulty) : ''}
                onChange={(value) =>
                  updateQuestionDraft({ difficulty: value.trim() ? Number(value) : null })
                }
              />
              <Field label="来源" value={questionDraft?.sourceLabel ?? ''} onChange={(value) => updateQuestionDraft({ sourceLabel: value })} />
              <Field
                label="年份"
                value={questionDraft?.sourceYear != null ? String(questionDraft.sourceYear) : ''}
                onChange={(value) =>
                  updateQuestionDraft({ sourceYear: value.trim() ? Number(value) : null })
                }
              />
              <Field label="地区" value={questionDraft?.sourceRegion ?? ''} onChange={(value) => updateQuestionDraft({ sourceRegion: value })} />
              <Field label="考试名" value={questionDraft?.sourceExam ?? ''} onChange={(value) => updateQuestionDraft({ sourceExam: value })} />
              <Field label="标签" value={questionDraft?.tags.join(', ') ?? ''} onChange={(value) => updateQuestionDraft({ tags: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              <SelectField
                label="审核状态"
                value={questionDraft?.status ?? 'draft'}
                options={REVIEW_OPTIONS}
                onChange={(value) => updateQuestionDraft({ status: value })}
              />
              <SelectField
                label="版权状态"
                value={questionDraft?.rights ?? 'school_owned'}
                options={RIGHTS_OPTIONS}
                onChange={(value) => updateQuestionDraft({ rights: value })}
              />
            </section>

            <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-white p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Source</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-950">Markdown 源文</h2>
              </div>
              {questionLoading ? (
                <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载题目
                </div>
              ) : (
                <textarea
                  value={questionDraft?.markdown ?? ''}
                  onChange={(event) => updateQuestionDraft({ markdown: event.target.value })}
                  className="min-h-[520px] w-full rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-zinc-400"
                  placeholder="在这里编辑题目的 Markdown / Quarto 源文"
                />
              )}
            </section>

            <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Preview</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-950">题目摘要</h2>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Current</p>
                <p className="mt-2 text-sm font-semibold text-zinc-950">{questionDraft?.title ?? '未命名题目'}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {questionDraft?.subject ?? '-'} · {questionDraft?.grade ?? '-'} · {questionDraft?.type ?? '-'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  review:{questionDraft?.status ?? '-'} · rights:{questionDraft?.rights ?? '-'} · difficulty:{questionDraft?.difficulty ?? '-'}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{questionDraft?.markdown.slice(0, 220) ?? '加载后会显示题目正文摘要。'}</p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Source</p>
                <div className="mt-2 space-y-1 text-sm text-zinc-700">
                  <p className="break-all">{questionDraft?.sourcePath || '文件工作区 API 会提供源路径。'}</p>
                  <p>{questionDraft?.sourceLabel || '-'}</p>
                  <p>
                    {[questionDraft?.sourceRegion, questionDraft?.sourceYear, questionDraft?.sourceExam]
                      .filter(Boolean)
                      .join(' · ') || '未补全来源细节'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Change State</p>
                <p className="mt-2 text-sm text-zinc-600">
                  {questionSaving ? '保存中' : questionDirty ? '未保存修改' : '当前无未保存修改'}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.16em] text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none transition ${
          readOnly
            ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
            : 'border-zinc-200 bg-white focus:border-zinc-400'
        }`}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.16em] text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
