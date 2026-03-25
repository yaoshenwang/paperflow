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

function renderScore(clip: QuestionClip, template: TemplateTokens): string {
  const label = `${clip.score}分`
  if (template.scoreStyle === 'pill') {
    return `#box(fill: ${template.scorePillFill}, inset: (x: 6pt, y: 2pt), radius: 999pt)[${label}]`
  }

  return `（${label}）`
}

function renderAnswerBlock(label: string, content: string, template: TemplateTokens): string {
  if (template.answerBlockStyle === 'outline') {
    return `#block(stroke: 0.8pt + ${template.answerBlockTone}, inset: 8pt, radius: 4pt)[*${label}：* ${content}]`
  }

  return `#block(fill: ${template.answerBlockTone}, inset: 8pt, radius: 4pt)[*${label}：* ${content}]`
}

function renderAnalysisBlock(content: string, template: TemplateTokens): string {
  if (template.analysisBlockStyle === 'soft-fill') {
    return `#block(fill: ${template.analysisBlockTone}, inset: 8pt, radius: 4pt)[_解析：_ ${content}]`
  }

  return `#block(inset: 8pt)[_解析：_ ${content}]`
}

function renderSectionTitle(title: string, template: TemplateTokens): string {
  if (template.sectionTitleStyle === 'underline') {
    return `== #underline[${title}]`
  }

  if (template.sectionTitleStyle === 'boxed') {
    return `== #box(fill: ${template.sectionTone}, inset: (x: 10pt, y: 5pt), radius: 4pt)[*${title}*]`
  }

  return `== *${title}*`
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
  if (template.footerCenter) {
    lines.push(`  #align(center)[${template.footerCenter} #h(0.8em) #context counter(page).display()]`)
  } else {
    lines.push(`  #align(center)[#context counter(page).display()]`)
  }
  lines.push('])')

  lines.push(`#set text(size: ${template.fontSize})`)
  lines.push(`#set par(leading: ${template.lineSpacing})`)

  return lines.join('\n')
}

/** 渲染标题 */
function renderTitle(paper: PaperProject, template: TemplateTokens): string {
  const title = `#text(size: ${template.titleSize}, weight: "bold")[${paper.title}]`
  const alignedTitle = `#align(${template.titleAlign})[${title}]`

  if (template.titleDecoration === 'double-rule') {
    return `#line(length: 100%)
#v(0.4em)
${alignedTitle}
#v(0.4em)
#line(length: 100%)

#v(0.9em)`
  }

  if (template.titleDecoration === 'banner') {
    return `#block(fill: ${template.titleDecorationFill}, inset: (x: 14pt, y: 10pt), radius: 6pt)[${alignedTitle}]

#v(0.9em)`
  }

  return `${alignedTitle}

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
  const scoreText = renderScore(clip, template)
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
        lines.push(renderAnswerBlock('答案', renderBlocks(sub.answer), template))
      }
      if (showSolutions && !clip.hiddenParts.includes('analysis') && sub.analysis) {
        lines.push('')
        lines.push(renderAnalysisBlock(renderBlocks(sub.analysis), template))
      }
    }
  }

  // 答案
  if (showSolutions && !clip.hiddenParts.includes('answer') && item.content.answer) {
    lines.push('')
    lines.push(renderAnswerBlock('答案', renderBlocks(item.content.answer), template))
  }

  // 解析
  if (showSolutions && !clip.hiddenParts.includes('analysis') && item.content.analysis) {
    lines.push('')
    lines.push(renderAnalysisBlock(renderBlocks(item.content.analysis), template))
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
    const bubbles = labels
      .map(
        (label) =>
          `#box(stroke: ${template.answerSheetBubbleStroke}, inset: (x: 7pt, y: 3pt), radius: ${template.answerSheetBubbleRadius})[${label}]`,
      )
      .join(` #h(${template.answerSheetBubbleGap}) `)
    return `*${num}.* #h(1em) ${bubbles}`
  }

  // 主观题：留出答题区
  const areaSize = clip.layoutHints?.answerAreaSize ?? 'm'
  const height = template.answerAreaSize[areaSize]
  return `*${num}.* ${renderScore(clip, template)}\n\n#block(height: ${height}, width: 100%, stroke: ${template.answerSheetBubbleStroke}, radius: ${template.answerSheetBubbleRadius})[]`
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
  parts.push(renderTitle(paper, template))

  // 按 section.order 排序后渲染
  const sortedSections = [...paper.sections].sort((a, b) => a.order - b.order)
  let globalIndex = 0
  for (const section of sortedSections) {
    parts.push(renderSectionTitle(section.title, template))
    parts.push(`#v(${template.sectionGap})`)

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

      parts.push(`#v(${template.questionGap})`)
      globalIndex++
    }
  }

  return parts.join('\n')
}
