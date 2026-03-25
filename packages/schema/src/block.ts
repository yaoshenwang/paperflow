import { z } from 'zod'

/** 文本段落中的行内元素 */
export const InlineNodeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
    marks: z
      .array(z.enum(['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript']))
      .optional(),
  }),
  z.object({
    type: z.literal('math_inline'),
    typst: z.string(),
  }),
])
export type InlineNode = z.infer<typeof InlineNodeSchema>

/** 内容块 — 所有题目内容的最小单元 */
export const BlockSchema: z.ZodType<Block> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('paragraph'),
    children: z.array(InlineNodeSchema),
  }),
  z.object({
    type: z.literal('math_block'),
    typst: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    src: z.string(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({
    type: z.literal('table'),
    rows: z.array(z.array(z.array(InlineNodeSchema))),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string().optional(),
    code: z.string(),
  }),
])

export type Block =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'math_block'; typst: string }
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'table'; rows: InlineNode[][][] }
  | { type: 'code'; language?: string; code: string }

/** 选项（选择题） */
export const OptionSchema = z.object({
  label: z.string(),
  content: z.array(BlockSchema),
})
export type Option = z.infer<typeof OptionSchema>

/** 小问（复合题） */
export const SubQuestionSchema = z.object({
  order: z.number().int().min(1),
  score: z.number().optional(),
  stem: z.array(BlockSchema),
  answer: z.array(BlockSchema).optional(),
  analysis: z.array(BlockSchema).optional(),
})
export type SubQuestion = z.infer<typeof SubQuestionSchema>
