'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, CircleDollarSign, FileText, Sparkles } from 'lucide-react'
import { type WorkspaceTemplatePreset, useWorkspaceStore } from '@/store/workspace-store'

const TEMPLATE_OPTIONS: Array<{ value: WorkspaceTemplatePreset; label: string; detail: string }> = [
  { value: 'default', label: '默认模板', detail: '简洁通用的基础版式' },
  { value: 'school-default', label: '学校模板', detail: '适合学校常规考试版面' },
  { value: 'exam-standard', label: '考试标准版', detail: '更紧凑的正式试卷布局' },
  { value: 'teacher-annotated', label: '教师卷模板', detail: '答案和解析默认可见' },
  { value: 'answer-sheet', label: '答题卡模板', detail: '选择题答题卡与主观题留白' },
]

function rememberProjectPath(projectPath: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = JSON.parse(window.localStorage.getItem('paperflow.recentProjects') || '[]') as string[]
    const next = [projectPath, ...existing.filter((item) => item !== projectPath)].slice(0, 6)
    window.localStorage.setItem('paperflow.recentProjects', JSON.stringify(next))
  } catch {
    window.localStorage.setItem('paperflow.recentProjects', JSON.stringify([projectPath]))
  }
}

export function WorkspaceWizard() {
  const router = useRouter()
  const initWorkspace = useWorkspaceStore((state) => state.initWorkspace)
  const loading = useWorkspaceStore((state) => state.loading)
  const error = useWorkspaceStore((state) => state.error)
  const [form, setForm] = useState({
    title: '高一数学上学期期中测试',
    subject: '数学',
    grade: '高一',
    projectPath: 'paperflow-math-midterm',
    templatePreset: 'school-default' as WorkspaceTemplatePreset,
    mode: 'student' as 'student' | 'teacher' | 'answer_sheet' | 'solution_book',
    generateDemoQuestions: true,
  })

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15),_transparent_28%),linear-gradient(180deg,#fffaf6_0%,#f5efe6_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(75,40,10,0.10)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              新建试卷工程
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                先创建目录，再进入编辑器。
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
                这个向导只负责文件工作区的初始化，不依赖组织、角色或旧数据库流程。
                主线程提供 `POST /api/workspace/init` 后，这里会直接跳到可编辑的 `/editor`。
              </p>
            </div>

            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault()
                try {
                  const workspace = await initWorkspace({ ...form })
                  rememberProjectPath(workspace.projectPath)
                  router.push(`/editor?projectPath=${encodeURIComponent(workspace.projectPath)}`)
                } catch {
                  return
                }
              }}
            >
              {[
                ['标题', 'title'],
                ['学科', 'subject'],
                ['学段 / 年级', 'grade'],
                ['工程目录', 'projectPath'],
              ].map(([label, key]) => (
                <label key={key} className="space-y-2">
                  <span className="block text-sm font-medium text-zinc-700">{label}</span>
                  <input
                    value={form[key as keyof typeof form] as string}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder={key === 'projectPath' ? '~/Documents/my-exam' : ''}
                  />
                  {key === 'projectPath' ? (
                    <span className="block text-xs text-zinc-500">相对路径会基于仓库根目录解析，也支持 `~/` 和绝对路径。</span>
                  ) : null}
                </label>
              ))}

              <label className="space-y-2">
                <span className="block text-sm font-medium text-zinc-700">模板</span>
                <select
                  value={form.templatePreset}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      templatePreset: event.target.value as WorkspaceTemplatePreset,
                    }))
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                >
                  {TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-medium text-zinc-700">输出版本</span>
                <select
                  value={form.mode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      mode: event.target.value as 'student' | 'teacher' | 'answer_sheet' | 'solution_book',
                    }))
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
                >
                  <option value="student">学生卷</option>
                  <option value="teacher">教师卷</option>
                  <option value="answer_sheet">答题卡</option>
                  <option value="solution_book">解析册</option>
                </select>
              </label>

              <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.generateDemoQuestions}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, generateDemoQuestions: event.target.checked }))
                  }
                />
                <span className="text-sm text-zinc-700">生成示例题目，方便首次打开就能预览</span>
              </label>

              {error ? (
                <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '创建中...' : '创建工程'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>

          <aside className="space-y-4 rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(247,241,232,0.98))] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Output</p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-950">这次创建会得到什么</h2>
              </div>
              <FileText className="h-5 w-5 text-amber-600" />
            </div>

            <div className="space-y-3">
              {[
                '生成 `_quarto.yml`、`paper.qmd` 和 `questions/` 目录。',
                '初始化 `.paperflow/` 目录作为本地缓存和预览产物目录。',
                '可直接进入 `/editor` 查看题库栏、组卷区、属性栏和预览。',
                '保留文件可读性，后续可直接切到 Source 模式。 ',
              ].map((text) => (
                <div key={text} className="rounded-2xl border border-white bg-white/80 p-4 text-sm leading-6 text-zinc-700">
                  {text}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <CircleDollarSign className="h-4 w-4 text-amber-600" />
                关键约束
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                新工程不需要登录、不需要组织选择，也不依赖 review 流程。页面只是向主线程的 workspace API 申请创建目录。
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
