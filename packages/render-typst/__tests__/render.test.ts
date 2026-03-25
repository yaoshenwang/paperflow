import { describe, it, expect } from 'vitest'
import { renderInline, renderBlock, renderOptions, renderToTypst, TEMPLATE_PRESETS } from '../src/index.js'
import type { PaperProject, QuestionItem } from '@paperflow/schema'

describe('renderInline', () => {
  it('renders plain text', () => {
    expect(renderInline({ type: 'text', text: 'hello' })).toBe('hello')
  })

  it('renders bold text', () => {
    expect(renderInline({ type: 'text', text: 'bold', marks: ['bold'] })).toBe('*bold*')
  })

  it('renders inline math', () => {
    expect(renderInline({ type: 'math_inline', typst: 'x^2' })).toBe('$x^2$')
  })
})

describe('renderBlock', () => {
  it('renders paragraph', () => {
    const result = renderBlock({
      type: 'paragraph',
      children: [
        { type: 'text', text: '函数 ' },
        { type: 'math_inline', typst: 'f(x)' },
      ],
    })
    expect(result).toBe('函数 $f(x)$')
  })

  it('renders math block', () => {
    expect(renderBlock({ type: 'math_block', typst: 'x^2 + y^2 = 1' })).toBe(
      '$ x^2 + y^2 = 1 $',
    )
  })

  it('renders image', () => {
    expect(renderBlock({ type: 'image', src: 'fig.png' })).toBe('#image("fig.png")')
  })
})

describe('renderOptions', () => {
  const opts = [
    { label: 'A', content: [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: '1' }] }] },
    { label: 'B', content: [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: '2' }] }] },
    { label: 'C', content: [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: '3' }] }] },
    { label: 'D', content: [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: '4' }] }] },
  ]

  it('renders vertical options', () => {
    const result = renderOptions(opts, 'vertical')
    expect(result).toContain('#par[A. 1]')
  })

  it('renders horizontal-4 options', () => {
    const result = renderOptions(opts, 'horizontal-4')
    expect(result).toContain('#grid')
    expect(result).toContain('[A. 1]')
  })
})

describe('renderToTypst', () => {
  const items: QuestionItem[] = [
    {
      id: 'qi-001',
      canonicalId: 'cq-001',
      sourceDocumentId: 'sd-001',
      sourceLocator: { page: 1 },
      taxonomy: {
        subject: '数学',
        grade: '高一',
        knowledgeIds: [],
        abilityTags: [],
        questionType: 'single_choice',
        difficulty: 0.3,
      },
      content: {
        stem: [{ type: 'paragraph', children: [{ type: 'text', text: '1+1=' }] }],
        options: [
          { label: 'A', content: [{ type: 'paragraph', children: [{ type: 'text', text: '1' }] }] },
          { label: 'B', content: [{ type: 'paragraph', children: [{ type: 'text', text: '2' }] }] },
          { label: 'C', content: [{ type: 'paragraph', children: [{ type: 'text', text: '3' }] }] },
          { label: 'D', content: [{ type: 'paragraph', children: [{ type: 'text', text: '4' }] }] },
        ],
        answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'B' }] }],
        assets: [],
      },
      provenance: { sourceLabel: 'test' },
      quality: { reviewStatus: 'approved', answerVerified: true },
      rightsStatus: 'public_domain',
    },
    {
      id: 'qi-002',
      canonicalId: 'cq-002',
      sourceDocumentId: 'sd-001',
      sourceLocator: { page: 2 },
      taxonomy: {
        subject: '数学',
        grade: '高一',
        knowledgeIds: [],
        abilityTags: [],
        questionType: 'computation',
        difficulty: 0.7,
      },
      content: {
        stem: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: '求 ' },
              { type: 'math_inline', typst: 'integral_0^1 x^2 dif x' },
              { type: 'text', text: ' 的值。' },
            ],
          },
        ],
        answer: [{ type: 'math_block', typst: '1/3' }],
        analysis: [{ type: 'paragraph', children: [{ type: 'text', text: '直接积分即可。' }] }],
        assets: [],
      },
      provenance: { sourceLabel: 'test' },
      quality: { reviewStatus: 'approved', answerVerified: true },
      rightsStatus: 'public_domain',
    },
  ]

  const paper: PaperProject = {
    id: 'pp-001',
    orgId: 'org-001',
    title: '高一数学测试卷',
    blueprint: {
      subject: '数学',
      grade: '高一',
      totalScore: 20,
      sections: [
        { questionType: 'single_choice', count: 1, scorePerItem: 5 },
        { questionType: 'computation', count: 1, scorePerItem: 15 },
      ],
    },
    sections: [
      { id: 'sec-1', title: '一、选择题', order: 0 },
      { id: 'sec-2', title: '二、解答题', order: 1 },
    ],
    clips: [
      {
        id: 'qc-001',
        questionItemId: 'qi-001',
        sectionId: 'sec-1',
        order: 0,
        score: 5,
        locked: false,
        hiddenParts: [],
        altItemIds: [],
      },
      {
        id: 'qc-002',
        questionItemId: 'qi-002',
        sectionId: 'sec-2',
        order: 0,
        score: 15,
        locked: false,
        hiddenParts: [],
        altItemIds: [],
      },
    ],
    templatePreset: 'default',
    outputModes: ['student', 'teacher'],
    version: 1,
    status: 'draft',
  }

  it('renders student mode without answers', () => {
    const result = renderToTypst(paper, items, { mode: 'student' })
    expect(result).toContain('高一数学测试卷')
    expect(result).toContain('一、选择题')
    expect(result).toContain('1+1=')
    expect(result).not.toContain('答案：')
  })

  it('renders teacher mode with answers', () => {
    const result = renderToTypst(paper, items, { mode: 'teacher' })
    expect(result).toContain('答案：')
    expect(result).toContain('解析：')
  })

  it('renders answer sheet with bubbles for choice and area for computation', () => {
    const result = renderToTypst(paper, items, { mode: 'answer_sheet' })
    // Choice question should have bubble boxes
    expect(result).toContain('#box(stroke:')
    expect(result).toContain('[A]')
    // Computation should have answer area block
    expect(result).toContain('#block(height:')
  })

  it('includes math formulas in typst syntax', () => {
    const result = renderToTypst(paper, items, { mode: 'student' })
    expect(result).toContain('$integral_0^1 x^2 dif x$')
  })

  it('renders exam standard preset with double-rule title and chinese numbering', () => {
    const result = renderToTypst(paper, items, {
      mode: 'student',
      template: TEMPLATE_PRESETS.exam_standard,
    })

    expect(result).toContain('#line(length: 100%)')
    expect(result).toContain('*一.*')
    expect(result).toContain('#box(fill: luma(232)')
  })

  it('renders practice compact preset with left title and underlined sections', () => {
    const result = renderToTypst(paper, items, {
      mode: 'student',
      template: TEMPLATE_PRESETS.practice_compact,
    })

    expect(result).toContain('#align(left)')
    expect(result).toContain('== #underline[一、选择题]')
  })

  it('renders teacher annotated preset with banner title and outlined answers', () => {
    const result = renderToTypst(paper, items, {
      mode: 'teacher',
      template: TEMPLATE_PRESETS.teacher_annotated,
    })

    expect(result).toContain('#block(fill: luma(235), inset: (x: 14pt, y: 10pt), radius: 6pt)')
    expect(result).toContain('== #box(fill: luma(239), inset: (x: 10pt, y: 5pt), radius: 4pt)[*一、选择题*]')
    expect(result).toContain('#block(stroke: 0.8pt + luma(145), inset: 8pt, radius: 4pt)[*答案：* B]')
    expect(result).toContain('#block(fill: luma(241), inset: 8pt, radius: 4pt)[_解析：_ 直接积分即可。]')
  })

  it('renders answer sheet preset with stronger bubble styling', () => {
    const result = renderToTypst(paper, items, {
      mode: 'answer_sheet',
      template: TEMPLATE_PRESETS.answer_sheet,
    })

    expect(result).toContain('#box(stroke: 1pt + luma(120), inset: (x: 7pt, y: 3pt), radius: 4pt)[A]')
    expect(result).toContain('#block(height: 6cm, width: 100%, stroke: 1pt + luma(120), radius: 4pt)[]')
  })
})
