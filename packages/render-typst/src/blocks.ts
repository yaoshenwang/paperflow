import type { Block, InlineNode, Option } from '@paperflow/schema'
import type { TemplateTokens } from './templates.js'

/** 将行内节点转换为 Typst */
export function renderInline(node: InlineNode): string {
  switch (node.type) {
    case 'text': {
      let text = node.text
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark) {
            case 'bold':
              text = `*${text}*`
              break
            case 'italic':
              text = `_${text}_`
              break
            case 'underline':
              text = `#underline[${text}]`
              break
            case 'strikethrough':
              text = `#strike[${text}]`
              break
            case 'superscript':
              text = `#super[${text}]`
              break
            case 'subscript':
              text = `#sub[${text}]`
              break
          }
        }
      }
      return text
    }
    case 'math_inline':
      return `$${node.typst}$`
  }
}

/** 将内容块转换为 Typst */
export function renderBlock(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return block.children.map(renderInline).join('')
    case 'math_block':
      return `$ ${block.typst} $`
    case 'image':
      return `#image("${block.src}"${block.width ? `, width: ${block.width}pt` : ''})`
    case 'table': {
      const cols = block.rows[0]?.length ?? 0
      const cells = block.rows
        .flat()
        .map((cell) => `[${cell.map(renderInline).join('')}]`)
        .join(', ')
      return `#table(columns: ${cols}, ${cells})`
    }
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
  }
}

/** 渲染选项列表 */
export function renderOptions(options: Option[], layout: TemplateTokens['optionLayout']): string {
  const rendered = options.map(
    (opt) => `${opt.label}. ${opt.content.map(renderBlock).join(' ')}`,
  )

  switch (layout) {
    case 'vertical':
      return rendered.map((r) => `#par[${r}]`).join('\n')
    case 'horizontal-2': {
      const rows: string[] = []
      for (let i = 0; i < rendered.length; i += 2) {
        const pair = rendered.slice(i, i + 2)
        rows.push(`#grid(columns: (1fr, 1fr), ${pair.map((p) => `[${p}]`).join(', ')})`)
      }
      return rows.join('\n')
    }
    case 'horizontal-4': {
      const rows: string[] = []
      for (let i = 0; i < rendered.length; i += 4) {
        const group = rendered.slice(i, i + 4)
        const colsDef = group.map(() => '1fr').join(', ')
        rows.push(`#grid(columns: (${colsDef}), ${group.map((p) => `[${p}]`).join(', ')})`)
      }
      return rows.join('\n')
    }
  }
}
