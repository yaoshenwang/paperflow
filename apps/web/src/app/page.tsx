import Link from 'next/link'

const FEATURES = [
  {
    title: '结构化试卷模型',
    text: '内部唯一真相源是 JSON AST，同一份模型可走预览、PDF、Typst、QTI、DOCX XML。',
  },
  {
    title: '视觉组卷工作台',
    text: '从题库选题、整理 sections、调分值、看卷面，不需要碰 Word 样式面板。',
  },
  {
    title: '开源起步友好',
    text: '仓库内自带 demo 数据和轻量导入入口，拉下来即可快速完成第一次试卷导出。',
  },
  {
    title: 'Typst 排版内核',
    text: '模板预设和多版本导出建立在同一条 Typst 渲染链上，重点是稳定打印和可扫描。',
  },
]

const GET_STARTED = [
  '启动 `pnpm dev`，进入 `/studio`。',
  '在左侧点击“导入示例数据”，把 demo 题目和试卷直接载入工作台。',
  '在右侧切换模板预设、预览学生卷 / 教师卷 / 答题卡，然后导出。',
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,237,213,0.9),_transparent_28%),linear-gradient(180deg,#fffdf8_0%,#f5f1e8_100%)] px-4 py-6 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/85 shadow-[0_20px_80px_rgba(63,41,16,0.08)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-8 sm:p-12">
              <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                Open-source AI-native Paper Workspace
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Paperflow 把题目当素材，把试卷当工作台，而不是当 Word 文档。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
                一个面向开源早期阶段的组卷系统：有 schema、有 demo、有导入器、有 Typst 排版内核，也有可以直接上手的 Studio。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/studio"
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  打开 Studio
                </Link>
                <Link
                  href="/review"
                  className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  打开 Review Center
                </Link>
                <a
                  href="https://github.com/yaoshenwang/paperflow"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  GitHub 仓库
                </a>
              </div>
            </div>

            <div className="border-t border-zinc-200/80 bg-[linear-gradient(180deg,rgba(250,247,240,0.95),rgba(244,238,228,0.95))] p-8 lg:border-l lg:border-t-0">
              <p className="text-sm font-medium text-zinc-500">3 分钟上手</p>
              <div className="mt-4 space-y-4">
                {GET_STARTED.map((step, index) => (
                  <div key={step} className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <p className="text-xs font-medium text-zinc-400">Step {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-100">
                <p className="font-medium">当前推荐试用顺序</p>
                <p className="mt-2 text-zinc-300">
                  `/studio` 导入示例数据 → 切模板 → 切换学生卷 / 教师卷 / 答题卡 → 导出 PDF / QTI / JSON。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[24px] border border-zinc-200/80 bg-white/80 p-5 shadow-[0_12px_32px_rgba(32,24,14,0.05)]"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[28px] border border-zinc-200/80 bg-white/80 p-6">
            <p className="text-sm font-medium text-zinc-500">仓库内现成资产</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <p>`examples/sample-papers/demo-paper.json`：可直接导入的示例试卷与题目。</p>
              <p>`packages/schema`：SourceDocument / QuestionItem / QuestionClip / PaperProject 结构化 schema。</p>
              <p>`packages/render-typst` / `render-docx` / `render-qti`：多渲染输出内核。</p>
            </div>
          </article>

          <article className="rounded-[28px] border border-zinc-200/80 bg-zinc-950 p-6 text-zinc-100">
            <p className="text-sm font-medium text-zinc-400">当前最适合开源版继续推进的方向</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>模板预设继续扩充，把考试卷、练习卷、教师卷、答题卡做成稳定可切换的模板包。</p>
              <p>导入器继续增强，从 demo / JSON 扩到文件上传、QTI 导入和更完整的来源文档挂接。</p>
              <p>导出体验继续补全，让多版本导出更接近真实教学工作流，而不是 API 能力裸露。</p>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
