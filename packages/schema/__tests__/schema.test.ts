import { describe, it, expect } from 'vitest'
import {
  BlockSchema,
  SourceDocumentSchema,
  QuestionItemSchema,
  QuestionClipSchema,
  BlueprintSchema,
  PaperProjectSchema,
} from '../src/index.js'

describe('BlockSchema', () => {
  it('validates a paragraph block', () => {
    const block = {
      type: 'paragraph' as const,
      children: [{ type: 'text' as const, text: '已知函数 ' }, { type: 'math_inline' as const, typst: 'f(x) = x^2 + 1' }],
    }
    expect(BlockSchema.parse(block)).toEqual(block)
  })

  it('validates a math_block', () => {
    const block = { type: 'math_block' as const, typst: 'sum_(i=1)^n i = (n(n+1))/2' }
    expect(BlockSchema.parse(block)).toEqual(block)
  })

  it('validates an image block', () => {
    const block = { type: 'image' as const, src: 'assets/fig1.png', alt: '图1' }
    expect(BlockSchema.parse(block)).toEqual(block)
  })

  it('rejects invalid block type', () => {
    expect(() => BlockSchema.parse({ type: 'unknown', data: 123 })).toThrow()
  })
})

describe('SourceDocumentSchema', () => {
  it('validates a complete source document', () => {
    const doc = {
      id: 'sd-001',
      sourceType: 'provider',
      title: '2024年北京高考数学真题',
      subject: '数学',
      grade: '高三',
      region: '北京',
      year: 2024,
      examName: '高考',
      fileRef: 'files/2024-bj-math.pdf',
      pageCount: 8,
      rightsStatus: 'public_domain',
      createdAt: '2024-06-10T00:00:00Z',
    }
    expect(SourceDocumentSchema.parse(doc)).toEqual(doc)
  })

  it('rejects invalid rightsStatus', () => {
    expect(() =>
      SourceDocumentSchema.parse({
        id: 'sd-002',
        sourceType: 'provider',
        title: 'test',
        subject: '数学',
        grade: '高三',
        fileRef: 'f.pdf',
        pageCount: 1,
        rightsStatus: 'invalid_status',
        createdAt: '2024-01-01T00:00:00Z',
      }),
    ).toThrow()
  })
})

describe('QuestionItemSchema', () => {
  const validItem = {
    id: 'qi-001',
    canonicalId: 'cq-001',
    sourceDocumentId: 'sd-001',
    sourceLocator: { page: 3, questionNo: '12' },
    taxonomy: {
      subject: '数学',
      grade: '高一',
      knowledgeIds: ['func-001'],
      abilityTags: ['计算'],
      questionType: 'single_choice',
      difficulty: 0.6,
    },
    content: {
      stem: [
        {
          type: 'paragraph' as const,
          children: [
            { type: 'text' as const, text: '函数 ' },
            { type: 'math_inline' as const, typst: 'f(x) = ln x' },
            { type: 'text' as const, text: ' 的定义域是' },
          ],
        },
      ],
      options: [
        { label: 'A', content: [{ type: 'paragraph' as const, children: [{ type: 'math_inline' as const, typst: '(0, +infinity)' }] }] },
        { label: 'B', content: [{ type: 'paragraph' as const, children: [{ type: 'math_inline' as const, typst: '[0, +infinity)' }] }] },
      ],
      assets: [],
    },
    provenance: {
      examName: '期中考试',
      region: '北京',
      year: 2024,
      sourceLabel: '2024北京某校高一期中',
    },
    quality: {
      reviewStatus: 'approved',
      answerVerified: true,
    },
    rightsStatus: 'school_owned',
  }

  it('validates a complete question item', () => {
    expect(QuestionItemSchema.parse(validItem)).toEqual(validItem)
  })

  it('rejects difficulty > 1', () => {
    const bad = { ...validItem, taxonomy: { ...validItem.taxonomy, difficulty: 1.5 } }
    expect(() => QuestionItemSchema.parse(bad)).toThrow()
  })
})

describe('QuestionClipSchema', () => {
  it('validates a question clip', () => {
    const clip = {
      id: 'qc-001',
      questionItemId: 'qi-001',
      sectionId: 'sec-choice',
      order: 0,
      score: 5,
      locked: false,
      hiddenParts: ['analysis' as const],
      altItemIds: ['qi-002', 'qi-003'],
      layoutHints: { answerAreaSize: 'm' as const },
    }
    expect(QuestionClipSchema.parse(clip)).toEqual(clip)
  })
})

describe('BlueprintSchema', () => {
  it('validates a blueprint', () => {
    const bp = {
      subject: '数学',
      grade: '高一',
      totalScore: 150,
      duration: 120,
      sections: [
        { questionType: 'single_choice', count: 12, scorePerItem: 5 },
        { questionType: 'fill_blank', count: 4, scorePerItem: 5 },
        { questionType: 'computation', count: 6, scorePerItem: 10 },
      ],
      difficultyDistribution: { easy: 0.6, medium: 0.3, hard: 0.1 },
      yearRange: [2021, 2024] as [number, number],
    }
    expect(BlueprintSchema.parse(bp)).toEqual(bp)
  })
})

describe('PaperProjectSchema', () => {
  it('validates a paper project', () => {
    const paper = {
      id: 'pp-001',
      orgId: 'org-001',
      title: '高一数学上学期期中卷',
      blueprint: {
        subject: '数学',
        grade: '高一',
        totalScore: 150,
        sections: [{ questionType: 'single_choice', count: 12, scorePerItem: 5 }],
      },
      sections: [{ id: 'sec-1', title: '一、选择题', order: 0 }],
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
      ],
      templatePreset: 'default',
      outputModes: ['student', 'teacher'],
      version: 1,
      status: 'draft',
    }
    expect(PaperProjectSchema.parse(paper)).toEqual(paper)
  })
})
