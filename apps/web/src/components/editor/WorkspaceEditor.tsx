'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState, startTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bot,
  ChevronRight,
  Code2,
  Eye,
  FileText,
  GripVertical,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Unlink,
  WandSparkles,
} from 'lucide-react'
import {
  type WorkspacePreviewMode,
  type WorkspaceBlueprint,
  type WorkspaceQuestion,
  type WorkspaceTemplatePreset,
  useWorkspaceStore,
} from '@/store/workspace-store'

const TEMPLATE_OPTIONS: Array<{ value: WorkspaceTemplatePreset; label: string }> = [
  { value: 'default', label: '默认模板' },
  { value: 'school-default', label: '学校模板' },
  { value: 'exam-standard', label: '考试标准版' },
  { value: 'teacher-annotated', label: '教师卷' },
  { value: 'answer-sheet', label: '答题卡' },
]

const MODE_OPTIONS: Array<{ value: WorkspacePreviewMode; label: string }> = [
  { value: 'student', label: '学生卷' },
  { value: 'teacher', label: '教师卷' },
  { value: 'answer_sheet', label: '答题卡' },
  { value: 'solution_book', label: '解析册' },
]

function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_60px_rgba(69,37,10,0.08)]">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200/80 px-4 py-4">
        <div>
          {eyebrow ? <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-zinc-950">{title}</h2>
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  )
}

function getQuestionTitle(questionId: string, questions: WorkspaceQuestion[]): string {
  return questions.find((question) => question.id === questionId)?.title ?? questionId
}

export function WorkspaceEditor() {
  const params = useSearchParams()
  const projectPath = params.get('projectPath')?.trim() ?? ''
  const {
    workspace,
    loading,
    error,
    selectedSectionId,
    selectedQuestionId,
    searchResults,
    searchLoading,
    previewPdfUrl,
    previewLoading,
    previewError,
    workspaceSaving,
    workspaceDirty,
    searchItems,
    loadWorkspace,
    saveWorkspace,
    updateBlueprint,
    selectSection,
    selectQuestion,
    addSection,
    renameSection,
    removeSection,
    addQuestionToSection,
    moveClip,
    updateClipScore,
    toggleClipLock,
    updateClipHiddenPart,
    updateWorkspaceField,
    refreshPreview,
    lintWorkspace,
  } = useWorkspaceStore()
  const [query, setQuery] = useState('')
  const [lintReport, setLintReport] = useState<unknown>(null)
  const [lintLoading, setLintLoading] = useState(false)
  const [blueprintIntent, setBlueprintIntent] = useState('')
  const [blueprintLoading, setBlueprintLoading] = useState(false)
  const [blueprintError, setBlueprintError] = useState<string | null>(null)
  const [blueprintNote, setBlueprintNote] = useState<string | null>(null)
  const [searchFilters, setSearchFilters] = useState({
    type: '',
    review: '',
    rights: '',
    knowledge: '',
    sampleProjectPath: '',
  })

  useEffect(() => {
    if (!projectPath) return
    void loadWorkspace(projectPath)
  }, [loadWorkspace, projectPath])

  useEffect(() => {
    if (!workspace) return
    const timer = window.setTimeout(() => {
      startTransition(() => {
        void refreshPreview()
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [workspace, refreshPreview])

  useEffect(() => {
    if (!workspace || !workspaceDirty) return
    const timer = window.setTimeout(() => {
      void saveWorkspace().catch(() => {})
    }, 800)

    return () => window.clearTimeout(timer)
  }, [workspace, workspaceDirty, saveWorkspace])

  useEffect(() => {
    if (!workspace?.projectPath) return
    const timer = window.setTimeout(() => {
      startTransition(() => {
        void searchItems(query, {
          type: searchFilters.type || undefined,
          review: searchFilters.review || undefined,
          rights: searchFilters.rights || undefined,
          knowledge: searchFilters.knowledge || undefined,
          sampleProjectPath: searchFilters.sampleProjectPath || undefined,
        })
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query, searchFilters, searchItems, workspace?.projectPath])

  useEffect(() => {
    if (!workspace?.blueprint?.intent) return
    setBlueprintIntent((current) => current || workspace.blueprint?.intent || '')
  }, [workspace?.blueprint?.intent])

  const selectedSection = workspace?.sections.find((section) => section.id === selectedSectionId) ?? workspace?.sections[0] ?? null
  const selectedQuestion =
    workspace?.questions.find((question) => question.id === selectedQuestionId) ??
    workspace?.questions[0] ??
    null
  const selectedQuestionClips = workspace?.clips.filter((clip) => clip.questionId === selectedQuestion?.id) ?? []
  const totalScore = workspace?.clips.reduce((sum, clip) => sum + clip.score, 0) ?? 0
  const searchTierOrder: Array<NonNullable<WorkspaceQuestion['matchTier']>> = ['exact', 'replacement', 'parallel']
  const searchTierLabel: Record<NonNullable<WorkspaceQuestion['matchTier']>, string> = {
    exact: '精确匹配',
    replacement: '可替换候选',
    parallel: '平行卷候选',
  }
  const groupedSearchResults = searchTierOrder
    .map((tier) => ({
      tier,
      items: searchResults.filter((question) => question.matchTier === tier),
    }))
    .filter((group) => group.items.length > 0)
  const fallbackSearchResults = searchResults.filter((question) => !question.matchTier)

  const generateBlueprint = async () => {
    if (!blueprintIntent.trim()) return
    setBlueprintLoading(true)
    setBlueprintError(null)
    setBlueprintNote(null)
    try {
      const response = await fetch('/api/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: blueprintIntent,
          projectPath: workspace?.projectPath,
          workspace,
        }),
      })
      const data = await response.json() as {
        blueprint?: WorkspaceBlueprint
        explanation?: string
        error?: string
      }
      if (!response.ok || !data.blueprint) {
        throw new Error(data.error ?? `Blueprint failed: ${response.status}`)
      }
      updateBlueprint(data.blueprint)
      setBlueprintNote(data.explanation ?? 'Blueprint 已更新。')
    } catch (error) {
      setBlueprintError(error instanceof Error ? error.message : 'Blueprint generation failed')
    } finally {
      setBlueprintLoading(false)
    }
  }

  if (!workspace && !loading && !projectPath) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(14,165,233,0.08),_transparent_26%),linear-gradient(180deg,#fffaf6_0%,#f4ede4_100%)] px-4 py-4 text-zinc-900">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] items-center justify-center">
          <div className="max-w-xl rounded-[28px] border border-white/70 bg-white/88 p-8 text-center shadow-[0_18px_60px_rgba(76,43,12,0.08)]">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">Editor</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">还没有打开工作区</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              从首页输入项目路径，或者先创建一个新的试卷工程。编辑器不再在加载失败时自动回退到 demo 数据。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                返回首页
              </Link>
              <Link
                href="/new"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
              >
                新建试卷
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(14,165,233,0.08),_transparent_26%),linear-gradient(180deg,#fffaf6_0%,#f4ede4_100%)] px-4 py-4 text-zinc-900">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] flex-col gap-4">
        <header className="rounded-[28px] border border-white/70 bg-white/88 px-5 py-4 shadow-[0_18px_60px_rgba(76,43,12,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                <span>Paperflow</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Editor</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={workspace?.title ?? ''}
                  onChange={(event) => updateWorkspaceField('title', event.target.value)}
                  className="min-w-[18rem] rounded-2xl border border-transparent bg-zinc-950 px-4 py-2.5 text-lg font-semibold text-white outline-none ring-1 ring-zinc-950/20 placeholder:text-zinc-400 focus:ring-2 focus:ring-amber-400"
                  placeholder="试卷标题"
                />
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500">
                  {workspace?.projectPath || projectPath || '未选择工作区'}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {workspace
                  ? '工作区已加载，下面的四个面板会跟随同一份状态更新。'
                  : '正在加载工作区，完成后会进入四面板编辑器。'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setLintLoading(true)
                  void lintWorkspace()
                    .then((report) => setLintReport(report))
                    .finally(() => setLintLoading(false))
                }}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                {lintLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Lint
              </button>
              <Link
                href={workspace?.projectPath ? `/export?projectPath=${encodeURIComponent(workspace.projectPath)}` : '/export'}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <FileText className="h-4 w-4" />
                Export
              </Link>
              <Link
                href={workspace?.projectPath ? `/imports?projectPath=${encodeURIComponent(workspace.projectPath)}` : '/imports'}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4" />
                Import
              </Link>
              <Link
                href={workspace?.projectPath ? `/review?projectPath=${encodeURIComponent(workspace.projectPath)}` : '/review'}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <Bot className="h-4 w-4" />
                Review
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <Lock className="h-4 w-4" />
                Auth
              </Link>
              <button
                onClick={() => startTransition(() => void refreshPreview())}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
              >
                <RefreshCw className={`h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
                重新预览
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Subject</span>
              <input
                value={workspace?.subject ?? ''}
                onChange={(event) => updateWorkspaceField('subject', event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Grade</span>
              <input
                value={workspace?.grade ?? ''}
                onChange={(event) => updateWorkspaceField('grade', event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Template</span>
              <select
                value={workspace?.templatePreset ?? 'default'}
                onChange={(event) =>
                  updateWorkspaceField('templatePreset', event.target.value as WorkspaceTemplatePreset)
                }
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              >
                {TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Preview Mode</span>
              <select
                value={workspace?.mode ?? 'student'}
                onChange={(event) =>
                  updateWorkspaceField('mode', event.target.value as WorkspacePreviewMode)
                }
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}
          {lintReport ? (
            <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-zinc-200 bg-zinc-950 px-4 py-3 text-xs leading-6 text-zinc-100">
              {JSON.stringify(lintReport, null, 2)}
            </pre>
          ) : null}
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
          <Panel
            title="Question Bin"
            eyebrow="Current workspace + search"
            action={<Plus className="h-4 w-4 text-zinc-400" />}
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                  }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  placeholder="搜索题目、标签、题型..."
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={searchFilters.type}
                  onChange={(event) => setSearchFilters((current) => ({ ...current, type: event.target.value }))}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                >
                  <option value="">全部题型</option>
                  <option value="single_choice">single_choice</option>
                  <option value="multiple_choice">multiple_choice</option>
                  <option value="fill_blank">fill_blank</option>
                  <option value="short_answer">short_answer</option>
                  <option value="essay">essay</option>
                  <option value="proof">proof</option>
                  <option value="computation">computation</option>
                </select>
                <input
                  value={searchFilters.knowledge}
                  onChange={(event) => setSearchFilters((current) => ({ ...current, knowledge: event.target.value }))}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="知识点 / 章节过滤"
                />
                <select
                  value={searchFilters.review}
                  onChange={(event) => setSearchFilters((current) => ({ ...current, review: event.target.value }))}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                >
                  <option value="">全部审核状态</option>
                  <option value="draft">draft</option>
                  <option value="parsed">parsed</option>
                  <option value="checked">checked</option>
                  <option value="approved">approved</option>
                  <option value="published">published</option>
                </select>
                <select
                  value={searchFilters.rights}
                  onChange={(event) => setSearchFilters((current) => ({ ...current, rights: event.target.value }))}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                >
                  <option value="">全部版权状态</option>
                  <option value="public_domain">public_domain</option>
                  <option value="cc">cc</option>
                  <option value="school_owned">school_owned</option>
                  <option value="licensed">licensed</option>
                  <option value="restricted">restricted</option>
                </select>
              </div>
              <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">以卷找题</p>
                  <button
                    onClick={() => setSearchFilters((current) => ({ ...current, sampleProjectPath: '' }))}
                    className="text-[11px] text-zinc-500 transition hover:text-zinc-950"
                  >
                    清空样卷
                  </button>
                </div>
                <input
                  value={searchFilters.sampleProjectPath}
                  onChange={(event) => setSearchFilters((current) => ({ ...current, sampleProjectPath: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="输入另一份样卷 projectPath，按结构给平行卷候选"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-400">
                  <span>Workspace Questions</span>
                  <span>{workspace?.questions.length ?? 0}</span>
                </div>
                <div className="space-y-2">
                  {(workspace?.questions ?? []).map((question) => (
                    <button
                      key={question.id}
                      onClick={() => selectQuestion(question.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selectedQuestionId === question.id
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{question.title}</p>
                        <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">
                          {question.type}
                        </span>
                      </div>
                      <p className={`mt-1 text-[11px] ${selectedQuestionId === question.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {question.sourceLabel}
                        {question.sourceRegion ? ` · ${question.sourceRegion}` : ''}
                        {question.sourceYear ? ` · ${question.sourceYear}` : ''}
                        {question.usedInPaper ? ' · 已入卷' : ''}
                      </p>
                      <p className={`mt-1 line-clamp-2 text-xs ${selectedQuestionId === question.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {question.preview}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-400">
                  <span>Search Results</span>
                  <span>{searchLoading ? '...' : searchResults.length}</span>
                </div>
                <div className="space-y-2">
                  {groupedSearchResults.map((group) => (
                    <div key={group.tier} className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                        <span>{searchTierLabel[group.tier]}</span>
                        <span>{group.items.length}</span>
                      </div>
                      {group.items.map((question) => (
                        <article key={`${group.tier}-${question.id}`} className="rounded-2xl border border-zinc-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-950">{question.title}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {question.subject} · {question.grade} · {question.type}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                const sectionId = selectedSection?.id ?? workspace?.sections[0]?.id
                                if (!sectionId) return
                                addQuestionToSection(sectionId, question)
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              插入
                            </button>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                            {question.preview}
                          </p>
                          {question.matchReason ? (
                            <p className="mt-2 rounded-xl bg-zinc-50 px-2 py-1 text-[11px] leading-5 text-zinc-600">
                              {question.matchReason}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                            <span>{question.sourceLabel}</span>
                            {question.sourceRegion ? <span>{question.sourceRegion}</span> : null}
                            {question.sourceYear ? <span>{question.sourceYear}</span> : null}
                            {question.sourceExam ? <span>{question.sourceExam}</span> : null}
                            {typeof question.similarCount === 'number' ? <span>相似题 {question.similarCount}</span> : null}
                            {question.rightsStatus ? <span>rights:{question.rightsStatus}</span> : null}
                            <span>review:{question.status}</span>
                            <span>{question.hasAnswer ? '有答案' : '缺答案'}</span>
                            <span>{question.hasAnalysis ? '有解析' : '缺解析'}</span>
                            {question.usedInPaper ? <span>已入卷</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ))}
                  {fallbackSearchResults.map((question) => (
                    <article key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-950">{question.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {question.subject} · {question.grade} · {question.type}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const sectionId = selectedSection?.id ?? workspace?.sections[0]?.id
                            if (!sectionId) return
                            addQuestionToSection(sectionId, question)
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          插入
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {question.preview}
                      </p>
                    </article>
                  ))}
                  {!searchLoading && searchResults.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                      {searchFilters.sampleProjectPath
                        ? '当前会按样卷结构返回平行卷候选；也可以叠加关键词和知识点过滤。'
                        : selectedQuestion
                          ? '当前会基于选中题目给出相似题、替换题和平行卷候选；输入关键字后会切到文本搜索。'
                          : '输入关键字后会从 `/api/items` 搜索题目。'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Paper Outline"
            eyebrow="Sections and clip order"
            action={
              <button
                onClick={() => addSection()}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add section
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-950">{workspace?.title ?? 'Untitled'}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {workspace?.sections.length ?? 0} sections · {workspace?.clips.length ?? 0} clips
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Total Score</p>
                  <p className="text-xl font-semibold text-zinc-950">{totalScore}</p>
                </div>
              </div>

              {(workspace?.sections ?? []).map((section) => {
                const sectionClips = workspace?.clips.filter((clip) => clip.sectionId === section.id).sort((a, b) => a.order - b.order) ?? []
                return (
                  <article
                    key={section.id}
                    className={`rounded-3xl border p-4 transition ${
                      selectedSection?.id === section.id ? 'border-zinc-950 bg-zinc-950/3' : 'border-zinc-200 bg-white'
                    }`}
                    onClick={() => selectSection(section.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-zinc-400" />
                          <input
                            value={section.title}
                            onChange={(event) => renameSection(section.id, event.target.value)}
                            className="w-full bg-transparent text-base font-semibold text-zinc-950 outline-none"
                          />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {sectionClips.length} clips · section score{' '}
                          {sectionClips.reduce((sum, clip) => sum + clip.score, 0)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSection(section.id)}
                        className="rounded-full border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {sectionClips.map((clip, index) => {
                        const question = workspace?.questions.find((item) => item.id === clip.questionId)
                        return (
                          <div
                            key={clip.id}
                            className={`rounded-2xl border px-3 py-3 transition ${
                              selectedQuestionId === clip.questionId
                                ? 'border-zinc-950 bg-zinc-950 text-white'
                                : 'border-zinc-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                className="min-w-0 flex-1 text-left"
                                onClick={() => selectQuestion(clip.questionId)}
                              >
                                <p className="truncate text-sm font-medium">{getQuestionTitle(clip.questionId, workspace?.questions ?? [])}</p>
                                <p className={`mt-1 text-xs ${selectedQuestionId === clip.questionId ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                  {question?.preview ?? '题目预览缺失'}
                                </p>
                              </button>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={clip.score}
                                  onChange={(event) => updateClipScore(clip.id, Number(event.target.value) || 0)}
                                  className={`w-16 rounded-xl border px-2 py-1 text-right text-xs outline-none ${
                                    selectedQuestionId === clip.questionId
                                      ? 'border-white/20 bg-white/10 text-white'
                                      : 'border-zinc-200 bg-white text-zinc-900'
                                  }`}
                                />
                                <button
                                  onClick={() => toggleClipLock(clip.id)}
                                  className={`rounded-xl border p-2 transition ${
                                    clip.locked
                                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                                      : 'border-zinc-200 bg-white text-zinc-500'
                                  }`}
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => moveClip(clip.id, section.id, Math.max(index - 1, 0))}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-50"
                              >
                                <ArrowUp className="h-3 w-3" />
                                上移
                              </button>
                              <button
                                onClick={() => moveClip(clip.id, section.id, index + 1)}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-50"
                              >
                                <ArrowDown className="h-3 w-3" />
                                下移
                              </button>
                              <button
                                onClick={() => updateClipHiddenPart(clip.id, 'answer', !clip.hiddenParts.includes('answer'))}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-50"
                              >
                                {clip.hiddenParts.includes('answer') ? <Unlink className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                答案
                              </button>
                              <button
                                onClick={() => updateClipHiddenPart(clip.id, 'analysis', !clip.hiddenParts.includes('analysis'))}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-50"
                              >
                                {clip.hiddenParts.includes('analysis') ? <Unlink className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                解析
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {sectionClips.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                          把题目从左侧插入这里，或者先新建 section。
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </Panel>

          <Panel
            title="Meta Panel"
            eyebrow="Project + selected question"
            action={<Settings2 className="h-4 w-4 text-zinc-400" />}
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Project</p>
                    <p className="mt-1 text-base font-semibold text-zinc-950">{workspace?.title ?? 'Untitled'}</p>
                  </div>
                  <WandSparkles className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-4 space-y-3">
                  <Link
                    href="/new"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                  >
                    新建工程
                  </Link>
                  <Link
                    href={
                      selectedQuestion
                        ? `/questions/${selectedQuestion.id}${workspace?.projectPath ? `?projectPath=${encodeURIComponent(workspace.projectPath)}` : ''}`
                        : '/editor'
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
                  >
                    <Code2 className="h-4 w-4" />
                    Source Mode
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Blueprint</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">
                      {workspace?.blueprint
                        ? `${workspace.blueprint.subject} ${workspace.blueprint.grade} · ${workspace.blueprint.totalScore} 分`
                        : '还没有生成蓝图'}
                    </p>
                  </div>
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
                <textarea
                  value={blueprintIntent}
                  onChange={(event) => setBlueprintIntent(event.target.value)}
                  placeholder="一句话描述需求，例如：高一数学上学期期中卷，120 分，函数/三角/数列，难度 6:3:1，北京近三年真题优先。"
                  className="mt-3 h-28 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 outline-none transition focus:border-zinc-400"
                />
                <button
                  onClick={() => void generateBlueprint()}
                  disabled={blueprintLoading || !blueprintIntent.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {blueprintLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  生成 Blueprint
                </button>
                {blueprintNote ? (
                  <p className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-xs leading-5 text-green-800">
                    {blueprintNote}
                  </p>
                ) : null}
                {blueprintError ? (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    {blueprintError}
                  </p>
                ) : null}
                {workspace?.blueprint ? (
                  <div className="mt-3 space-y-2 text-xs leading-6 text-zinc-600">
                    <p>
                      结构：
                      {workspace.blueprint.sections.length > 0
                        ? workspace.blueprint.sections.map((section) => `${section.questionType} ${section.count}×${section.scorePerItem}`).join(' / ')
                        : '未指定'}
                    </p>
                    <p>
                      知识点：
                      {workspace.blueprint.knowledgeCoverage?.length
                        ? workspace.blueprint.knowledgeCoverage.join(' · ')
                        : '未指定'}
                    </p>
                    <p>
                      来源偏好：
                      {workspace.blueprint.regionPreference?.length || workspace.blueprint.sourcePreference?.length
                        ? [workspace.blueprint.regionPreference?.join(' / '), workspace.blueprint.sourcePreference?.join(' / ')].filter(Boolean).join(' · ')
                        : '未指定'}
                    </p>
                    <p>
                      输出：
                      {workspace.blueprint.outputModes?.length
                        ? workspace.blueprint.outputModes.join(' / ')
                        : 'student / teacher / answer_sheet / solution_book'}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Subject</p>
                  <p className="mt-2 text-sm font-medium text-zinc-950">{workspace?.subject ?? '-'}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Grade</p>
                  <p className="mt-2 text-sm font-medium text-zinc-950">{workspace?.grade ?? '-'}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Sections</p>
                  <p className="mt-2 text-sm font-medium text-zinc-950">{workspace?.sections.length ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Clips</p>
                  <p className="mt-2 text-sm font-medium text-zinc-950">{workspace?.clips.length ?? 0}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Selected Question</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">{selectedQuestion?.title ?? '未选择题目'}</p>
                  </div>
                  <BookOpen className="h-4 w-4 text-zinc-400" />
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {selectedQuestion?.preview ?? '在左侧题库或组卷区选中题目后，这里会显示题目元信息和可视化控制。'}
                </p>
                <div className="mt-4 space-y-2 text-xs text-zinc-500">
                  <p>题目源：{selectedQuestion?.sourceLabel ?? '-'}</p>
                  <p>
                    来源细节：
                    {selectedQuestion?.sourceRegion || selectedQuestion?.sourceYear || selectedQuestion?.sourceExam
                      ? [selectedQuestion?.sourceRegion, selectedQuestion?.sourceYear, selectedQuestion?.sourceExam].filter(Boolean).join(' · ')
                      : '-'}
                  </p>
                  <p>路径：{selectedQuestion?.sourcePath ?? '-'}</p>
                  <p>rights：{selectedQuestion?.rightsStatus ?? '-'}</p>
                  <p>review：{selectedQuestion?.status ?? '-'}</p>
                  <p>答案 / 解析：{selectedQuestion?.hasAnswer ? '有答案' : '缺答案'} · {selectedQuestion?.hasAnalysis ? '有解析' : '缺解析'}</p>
                  <p>标签：{selectedQuestion?.tags.join(' · ') ?? '-'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedQuestion ? (
                    <>
                      <Link
                        href={`/questions/${selectedQuestion.id}${workspace?.projectPath ? `?projectPath=${encodeURIComponent(workspace.projectPath)}` : ''}`}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50"
                      >
                        打开详情
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                      <button
                        onClick={() => selectQuestion(null)}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50"
                      >
                        取消选择
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {selectedQuestionClips.length > 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">References</p>
                  <div className="mt-3 space-y-2">
                    {selectedQuestionClips.map((clip) => (
                      <div key={clip.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                        <p className="font-medium text-zinc-950">
                          {workspace?.sections.find((section) => section.id === clip.sectionId)?.title ?? '未分类'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">分值 {clip.score} · {clip.locked ? '已锁定' : '可编辑'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <section className="min-h-[280px] overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_60px_rgba(69,37,10,0.08)]">
          <header className="flex items-center justify-between gap-4 border-b border-zinc-200/80 px-5 py-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">Live Preview</p>
              <h2 className="mt-1 text-base font-semibold text-zinc-950">编译结果和状态</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Eye className="h-4 w-4" />
              {previewLoading ? '刷新中' : '已同步到当前工作区'}
            </div>
          </header>

          <div className="grid min-h-[240px] gap-4 p-4 lg:grid-cols-[1fr_380px]">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-950/95 p-4 text-white">
              {previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  title="Paperflow preview"
                  className="h-[540px] w-full rounded-[18px] bg-white"
                />
              ) : (
                <div className="flex h-[540px] flex-col items-center justify-center text-center">
                  <Loader2 className={`h-10 w-10 ${previewLoading ? 'animate-spin' : ''} text-amber-300`} />
                  <p className="mt-4 text-lg font-semibold">等待预览输出</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-300">
                    当前会话会优先调用 `POST /api/preview`。如果主线程 API 还没接好，这里会显示工作区摘要。
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Status</p>
                <p className="mt-2 text-sm font-medium text-zinc-950">
                  {previewError
                    ? previewError
                    : loading
                      ? '正在加载工作区'
                      : workspaceSaving
                        ? '正在保存工作区'
                      : previewLoading
                        ? '正在编译预览'
                        : '预览已准备好'}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {workspaceDirty ? '存在未落盘修改，系统会自动保存。' : '磁盘工作区与编辑状态已同步。'}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Project Path</p>
                <p className="mt-2 break-all text-sm text-zinc-700">{workspace?.projectPath ?? projectPath}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Notes</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  这层 UI 现在只依赖文件工作区 API、题目 API、预览 API、导出 API 和 Lint API。
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
