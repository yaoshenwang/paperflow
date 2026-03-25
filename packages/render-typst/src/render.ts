import type { PaperProject, QuestionItem, QuestionClip, OutputMode, Block } from '@paperflow/schema'
import { renderBlock, renderOptions } from './blocks.js'
import type { TemplateTokens } from './templates.js'
import { DEFAULT_TEMPLATE } from './templates.js'

export interface RenderOptions {
  mode: OutputMode
  template?: Partial<TemplateTokens>
}

const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function questionNumber(index: number, style: TemplateTokens['questionNumberStyle']): string {
  const num = index + 1
  return style === 'chinese' ? `${CHINESE_NUMBERS[index] ?? num}` : `${num}`
}

function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('\n\n')
}

/** 渲染页面设置 */
function renderPageSetup(template: TemplateTokens, paper: PaperProject): string {
  const lines: string[] = []

  lines.push(`#set page(margin: ${template.pageMargin}, header: [`)
  if (template.headerLeft) lines.push(`  #align(left)[${template.headerLeft}]`)
  if (template.headerCenter || paper.title) {
    lines.push(`  #align(center)[*${template.headerCenter ?? paper.title}*]`)
  }
  if (template.headerRight) lines.push(`  #align(right)[${template.headerRight}]`)
  lines.push('], footer: [')
  lines.push(`  #align(center)[#context counter(page).display()]`)
  lines.push('])')

  lines.push(`#set text(size: ${template.fontSize})`)
  lines.push(`#set par(leading: ${template.lineSpacing})`)

  return lines.join('\n')
}

/** 渲染标题 */
function renderTitle(paper: PaperProject): string {
  return `#align(center)[#text(size: 16pt, weight: "bold")[${paper.title}]]

#v(1em)`
}

/** 判断是否应显示答案/解析 */
function shouldShowSolutions(mode: OutputMode): boolean {
  return mode === 'teacher' || mode === 'solution_book'
}

/** 渲染单个题目（学生/教师/解析册模式） */
function renderQuestionContent(
  clip: QuestionClip,
  item: QuestionItem,
  globalIndex: number,
  template: TemplateTokens,
  mode: OutputMode,
): string {
  const lines: string[] = []
  const num = questionNumber(globalIndex, template.questionNumberStyle)
  const scoreText = `（${clip.score}分）`
  const showSolutions = shouldShowSolutions(mode)

  // 题干
  lines.push(`*${num}.* ${scoreText} ${renderBlocks(item.content.stem)}`)

  // 选项
  if (item.content.options && item.content.options.length > 0) {
    lines.push('')
    lines.push(renderOptions(item.content.options, template.optionLayout))
  }

  // 小问
  if (item.content.subquestions) {
    for (const sub of item.content.subquestions) {
      lines.push('')
      lines.push(`（${sub.order}）${renderBlocks(sub.stem)}`)
      if (showSolutions && !clip.hiddenParts.includes('answer') && sub.answer) {
        lines.push('')
        lines.push(`#block(fill: luma(240), inset: 8pt, radius: 4pt)[*答案：* ${renderBlocks(sub.answer)}]`)
      }
      if (showSolutions && !clip.hiddenParts.includes('analysis') && sub.analysis) {
        lines.push('')
        lines.push(`#block(inset: 8pt)[_解析：_ ${renderBlocks(sub.analysis)}]`)
      }
    }
  }

  // 答案
  if (showSolutions && !clip.hiddenParts.includes('answer') && item.content.answer) {
    lines.push('')
    lines.push(`#block(fill: luma(240), inset: 8pt, radius: 4pt)[*答案：* ${renderBlocks(item.content.answer)}]`)
  }

  // 解析
  if (showSolutions && !clip.hiddenParts.includes('analysis') && item.content.analysis) {
    lines.push('')
    lines.push(`#block(inset: 8pt)[_解析：_ ${renderBlocks(item.content.analysis)}]`)
  }

  return lines.join('\n')
}

/** 渲染答题卡模式 */
function renderAnswerSheetQuestion(
  clip: QuestionClip,
  item: QuestionItem,
  globalIndex: number,
  template: TemplateTokens,
): string {
  const num = questionNumber(globalIndex, template.questionNumberStyle)
  const qType = item.taxonomy.questionType

  if (qType === 'single_choice' || qType === 'multiple_choice') {
    const optCount = item.content.options?.length ?? 4
    const labels = Array.from({ length: optCount }, (_, i) => String.fromCharCode(65 + i))
    const bubbles = labels.map((l) => `[${l}]`).join(' #h(1em) ')
    return `*${num}.* #h(1em) ${bubbles}`
  }

  // 主观题：留出答题区
  const areaSize = clip.layoutHints?.answerAreaSize ?? 'm'
  const height = template.answerAreaSize[areaSize]
  return `*${num}.* （${clip.score}分）\n\n#block(height: ${height}, width: 100%, stroke: 0.5pt + luma(200), radius: 2pt)[]`
}

/** 主渲染函数：将 Paper AST 转换为 Typst 源码 */
export function renderToTypst(
  paper: PaperProject,
  items: QuestionItem[],
  options: RenderOptions,
): string {
  const template = { ...DEFAULT_TEMPLATE, ...options.template }
  const itemMap = new Map(items.map((it) => [it.id, it]))

  const parts: string[] = []

  // 页面设置
  parts.push(renderPageSetup(template, paper))
  parts.push('')

  // 标题
  parts.push(renderTitle(paper))

  // 按 section.order 排序后渲染
  const sortedSections = [...paper.sections].sort((a, b) => a.order - b.order)
  let globalIndex = 0
  for (const section of sortedSections) {
    // Section 标题
    const sectionTitle =
      template.sectionTitleStyle === 'bold'
        ? `*${section.title}*`
        : `#underline[${section.title}]`
    parts.push(`== ${sectionTitle}`)
    parts.push('')

    // 该 section 下的 clips（按 order 排序）
    const sectionClips = paper.clips
      .filter((c) => c.sectionId === section.id)
      .sort((a, b) => a.order - b.order)

    for (const clip of sectionClips) {
      const item = itemMap.get(clip.questionItemId)
      if (!item) continue

      if (clip.layoutHints?.forcePageBreakBefore) {
        parts.push('#pagebreak()')
        parts.push('')
      }

      if (options.mode === 'answer_sheet') {
        parts.push(renderAnswerSheetQuestion(clip, item, globalIndex, template))
      } else {
        parts.push(renderQuestionContent(clip, item, globalIndex, template, options.mode))
      }

      parts.push('')
      globalIndex++
    }
  }

  return parts.join('\n')
}
