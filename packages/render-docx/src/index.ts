import type { PaperProject, QuestionItem, OutputMode, Block, InlineNode } from '@paperflow/schema'

export interface DocxRenderOptions {
  mode: OutputMode
}

/** 将行内节点转换为纯文本 */
function inlineToText(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return node.text
    case 'math_inline':
      return node.typst
  }
}

/** 将 Block 转换为纯文本 */
function blockToText(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return block.children.map(inlineToText).join('')
    case 'math_block':
      return block.typst
    case 'image':
      return `[图片: ${block.src}]`
    case 'table':
      return '[表格]'
    case 'code':
      return block.code
  }
}

/**
 * 渲染 Paper AST 为 DOCX XML 内容。
 *
 * v1 实现：生成简化的 Office Open XML (OOXML) document.xml 内容。
 * 生产版本应使用 docx 库（如 docx.js）生成完整 .docx 文件。
 */
export function renderToDocxXml(
  paper: PaperProject,
  items: QuestionItem[],
  options: DocxRenderOptions,
): string {
  const itemMap = new Map(items.map((it) => [it.id, it]))
  const showAnswers = options.mode === 'teacher' || options.mode === 'solution_book'

  const paragraphs: string[] = []

  // 标题
  paragraphs.push(docxParagraph(paper.title, { bold: true, fontSize: 32, alignment: 'center' }))
  paragraphs.push(docxParagraph(''))

  // 按 section 渲染
  const sortedSections = [...paper.sections].sort((a, b) => a.order - b.order)
  let globalIndex = 0

  for (const section of sortedSections) {
    paragraphs.push(docxParagraph(section.title, { bold: true, fontSize: 24 }))

    const sectionClips = paper.clips
      .filter((c) => c.sectionId === section.id)
      .sort((a, b) => a.order - b.order)

    for (const clip of sectionClips) {
      const item = itemMap.get(clip.questionItemId)
      if (!item) continue

      globalIndex++
      const stem = item.content.stem.map(blockToText).join('\n')
      paragraphs.push(docxParagraph(`${globalIndex}. (${clip.score}分) ${stem}`))

      // 选项
      if (item.content.options) {
        for (const opt of item.content.options) {
          const optText = opt.content.map(blockToText).join(' ')
          paragraphs.push(docxParagraph(`    ${opt.label}. ${optText}`))
        }
      }

      // 小问
      if (item.content.subquestions) {
        for (const sub of item.content.subquestions) {
          const subStem = sub.stem.map(blockToText).join('\n')
          paragraphs.push(docxParagraph(`    (${sub.order}) ${subStem}`))
          if (showAnswers && !clip.hiddenParts.includes('answer') && sub.answer) {
            paragraphs.push(docxParagraph(`    【答案】${sub.answer.map(blockToText).join('\n')}`, { bold: true }))
          }
          if (showAnswers && !clip.hiddenParts.includes('analysis') && sub.analysis) {
            paragraphs.push(docxParagraph(`    【解析】${sub.analysis.map(blockToText).join('\n')}`))
          }
        }
      }

      // 答案
      if (showAnswers && !clip.hiddenParts.includes('answer') && item.content.answer) {
        const answerText = item.content.answer.map(blockToText).join('\n')
        paragraphs.push(docxParagraph(`【答案】${answerText}`, { bold: true }))
      }

      // 解析
      if (showAnswers && !clip.hiddenParts.includes('analysis') && item.content.analysis) {
        const analysisText = item.content.analysis.map(blockToText).join('\n')
        paragraphs.push(docxParagraph(`【解析】${analysisText}`))
      }

      paragraphs.push(docxParagraph(''))
    }
  }

  return wrapDocxXml(paragraphs.join('\n'))
}

function docxParagraph(
  text: string,
  opts?: { bold?: boolean; fontSize?: number; alignment?: string },
): string {
  const pProps: string[] = []
  const rProps: string[] = []

  if (opts?.alignment) {
    pProps.push(`<w:jc w:val="${opts.alignment}"/>`)
  }
  if (opts?.bold) {
    rProps.push('<w:b/>')
  }
  if (opts?.fontSize) {
    rProps.push(`<w:sz w:val="${opts.fontSize}"/>`)
  }

  const pPr = pProps.length > 0 ? `<w:pPr>${pProps.join('')}</w:pPr>` : ''
  const rPr = rProps.length > 0 ? `<w:rPr>${rProps.join('')}</w:rPr>` : ''

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`
}

function wrapDocxXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${body}
</w:body>
</w:document>`
}
