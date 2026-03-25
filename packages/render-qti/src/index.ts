import type { PaperProject, QuestionItem, Block, InlineNode } from '@paperflow/schema'

/**
 * 渲染 Paper AST 为 QTI 3.0 XML。
 *
 * QTI (Question and Test Interoperability) 是 IMS Global 的评估互操作标准。
 * 这里生成 qti-assessment-test 和 qti-assessment-item XML。
 */

function inlineToHtml(node: InlineNode): string {
  switch (node.type) {
    case 'text': {
      let text = escapeXml(node.text)
      if (node.marks?.includes('bold')) text = `<b>${text}</b>`
      if (node.marks?.includes('italic')) text = `<i>${text}</i>`
      return text
    }
    case 'math_inline':
      return `<math xmlns="http://www.w3.org/1998/Math/MathML"><annotation encoding="application/x-typst">${escapeXml(node.typst)}</annotation></math>`
  }
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${block.children.map(inlineToHtml).join('')}</p>`
    case 'math_block':
      return `<p><math xmlns="http://www.w3.org/1998/Math/MathML"><annotation encoding="application/x-typst">${escapeXml(block.typst)}</annotation></math></p>`
    case 'image':
      return `<p><img src="${escapeXml(block.src)}" alt="${escapeXml(block.alt ?? '')}"/></p>`
    case 'table':
      return '<p>[table]</p>'
    case 'code':
      return `<pre><code>${escapeXml(block.code)}</code></pre>`
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 渲染单个题目为 QTI 3.0 assessment item */
export function renderItemToQti(item: QuestionItem, identifier?: string): string {
  const id = identifier ?? item.id
  const stemHtml = item.content.stem.map(blockToHtml).join('\n')

  if (item.taxonomy.questionType === 'single_choice' && item.content.options) {
    // Choice interaction
    const correctLabel = item.content.answer
      ? item.content.answer.map(blockToHtml).join('').replace(/<[^>]+>/g, '').trim()
      : ''

    const choices = item.content.options
      .map((opt) => {
        const optHtml = opt.content.map(blockToHtml).join('')
        return `      <qti-simple-choice identifier="${escapeXml(opt.label)}">${optHtml}</qti-simple-choice>`
      })
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${escapeXml(id)}"
  title="${escapeXml(item.provenance.sourceLabel)}"
  adaptive="false"
  time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>${escapeXml(correctLabel)}</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    ${stemHtml}
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
${choices}
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`
  }

  // 非选择题：text-entry 或 extended-text
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${escapeXml(id)}"
  title="${escapeXml(item.provenance.sourceLabel)}"
  adaptive="false"
  time-dependent="false">
  <qti-item-body>
    ${stemHtml}
    <qti-extended-text-interaction response-identifier="RESPONSE"/>
  </qti-item-body>
</qti-assessment-item>`
}

/** 渲染整套试卷为 QTI 3.0 assessment test */
export function renderTestToQti(
  paper: PaperProject,
  items: QuestionItem[],
): string {
  const itemMap = new Map(items.map((it) => [it.id, it]))

  const sortedSections = [...paper.sections].sort((a, b) => a.order - b.order)

  const sectionXmls = sortedSections.map((section) => {
    const sectionClips = paper.clips
      .filter((c) => c.sectionId === section.id)
      .sort((a, b) => a.order - b.order)

    const itemRefs = sectionClips
      .map((clip) => {
        const item = itemMap.get(clip.questionItemId)
        if (!item) return ''
        return `      <qti-assessment-item-ref identifier="${escapeXml(clip.id)}" href="${escapeXml(item.id)}.xml"/>`
      })
      .filter(Boolean)
      .join('\n')

    return `    <qti-test-part identifier="${escapeXml(section.id)}" navigation-mode="linear" submission-mode="individual">
      <qti-assessment-section identifier="${escapeXml(section.id)}-sec" title="${escapeXml(section.title)}">
${itemRefs}
      </qti-assessment-section>
    </qti-test-part>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${escapeXml(paper.id)}"
  title="${escapeXml(paper.title)}">
${sectionXmls.join('\n')}
</qti-assessment-test>`
}
