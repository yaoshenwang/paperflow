import { z } from 'zod'

/** 版权状态 */
export const RightsStatusSchema = z.enum([
  'public_domain',
  'cc',
  'school_owned',
  'licensed',
  'restricted',
  'prohibited',
])
export type RightsStatus = z.infer<typeof RightsStatusSchema>

/** 审核状态（题目状态机） */
export const ReviewStatusSchema = z.enum([
  'raw',
  'draft',
  'parsed',
  'tagged',
  'checked',
  'approved',
  'published',
  'archived',
])
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

/** 来源类型 */
export const SourceTypeSchema = z.enum([
  'provider',
  'school_upload',
  'teacher_upload',
  'curated',
  'ai_lab',
])
export type SourceType = z.infer<typeof SourceTypeSchema>

/** 题型 */
export const QuestionTypeSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'fill_blank',
  'short_answer',
  'essay',
  'proof',
  'computation',
  'true_false',
  'matching',
  'composite',
])
export type QuestionType = z.infer<typeof QuestionTypeSchema>

/** 试卷状态 */
export const PaperStatusSchema = z.enum(['draft', 'reviewing', 'approved', 'published'])
export type PaperStatus = z.infer<typeof PaperStatusSchema>

/** 输出模式 */
export const OutputModeSchema = z.enum(['student', 'teacher', 'answer_sheet', 'solution_book'])
export type OutputMode = z.infer<typeof OutputModeSchema>
