import { z } from 'zod'

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

export const RightsStatusSchema = z.enum([
  'public_domain',
  'cc',
  'school_owned',
  'licensed',
  'restricted',
  'prohibited',
])

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

export const PaperOutputModeSchema = z.enum([
  'student',
  'teacher',
  'answer_sheet',
  'solution_book',
])

export const QuestionLayoutSchema = z
  .object({
    option_cols: z.number().int().min(1).max(4).optional(),
    keep_with_next: z.boolean().optional(),
    force_page_break_before: z.boolean().optional(),
    answer_area_size: z.enum(['s', 'm', 'l']).optional(),
  })
  .passthrough()

export const QuestionSourceSchema = z
  .object({
    label: z.string().optional(),
    year: z.number().int().optional(),
    region: z.string().optional(),
    exam: z.string().optional(),
    school: z.string().optional(),
  })
  .passthrough()

export const QuestionFrontMatterSchema = z
  .object({
    id: z.string().min(1),
    type: QuestionTypeSchema,
    subject: z.string().min(1),
    grade: z.string().min(1),
    difficulty: z.number().min(0).max(1).optional(),
    score_suggest: z.number().min(0).optional(),
    knowledge: z.array(z.string()).optional(),
    source: QuestionSourceSchema.optional(),
    rights: RightsStatusSchema.optional(),
    review: ReviewStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    layout: QuestionLayoutSchema.optional(),
    canonical_id: z.string().optional(),
    source_document_id: z.string().optional(),
  })
  .passthrough()

export const QuestionSectionSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
})

export const QuestionFileSchema = z.object({
  frontMatter: QuestionFrontMatterSchema,
  sections: z.array(QuestionSectionSchema),
})

export const PaperFlowFrontMatterSchema = z
  .object({
    mode: PaperOutputModeSchema.optional(),
    template: z.string().optional(),
    template_preset: z.string().optional(),
    show_score: z.boolean().optional(),
    show_answer: z.boolean().optional(),
    show_analysis: z.boolean().optional(),
  })
  .passthrough()

export const PaperFrontMatterSchema = z
  .object({
    title: z.string().min(1),
    subject: z.string().optional(),
    grade: z.string().optional(),
    format: z.record(z.unknown()).optional(),
    paperflow: PaperFlowFrontMatterSchema.optional(),
  })
  .passthrough()

export const PaperBodyHeadingSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(6),
  title: z.string(),
})

export const PaperBodyMarkdownSchema = z.object({
  type: z.literal('markdown'),
  content: z.string(),
})

export const PaperBodyQuestionSchema = z
  .object({
    type: z.literal('question'),
    file: z.string().min(1),
    score: z.number().optional(),
    attrs: z.record(z.string()).optional(),
  })
  .passthrough()

export const PaperBodyNodeSchema = z.discriminatedUnion('type', [
  PaperBodyHeadingSchema,
  PaperBodyMarkdownSchema,
  PaperBodyQuestionSchema,
])

export const PaperFileSchema = z.object({
  frontMatter: PaperFrontMatterSchema,
  nodes: z.array(PaperBodyNodeSchema),
})

export const ProjectScaffoldOptionsSchema = z
  .object({
    rootDir: z.string().min(1),
    title: z.string().min(1),
    subject: z.string().min(1),
    grade: z.string().min(1),
    template: z.string().min(1).default('school-default'),
    outputMode: PaperOutputModeSchema.default('student'),
    includeSampleQuestions: z.boolean().default(true),
    overwrite: z.boolean().default(false),
  })
  .passthrough()

export type QuestionType = z.infer<typeof QuestionTypeSchema>
export type RightsStatus = z.infer<typeof RightsStatusSchema>
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>
export type PaperOutputMode = z.infer<typeof PaperOutputModeSchema>
export type QuestionLayout = z.infer<typeof QuestionLayoutSchema>
export type QuestionSource = z.infer<typeof QuestionSourceSchema>
export type QuestionFrontMatter = z.infer<typeof QuestionFrontMatterSchema>
export type QuestionSection = z.infer<typeof QuestionSectionSchema>
export type QuestionFile = z.infer<typeof QuestionFileSchema>
export type PaperFlowFrontMatter = z.infer<typeof PaperFlowFrontMatterSchema>
export type PaperFrontMatter = z.infer<typeof PaperFrontMatterSchema>
export type PaperBodyHeading = z.infer<typeof PaperBodyHeadingSchema>
export type PaperBodyMarkdown = z.infer<typeof PaperBodyMarkdownSchema>
export type PaperBodyQuestion = z.infer<typeof PaperBodyQuestionSchema>
export type PaperBodyNode = z.infer<typeof PaperBodyNodeSchema>
export type PaperFile = z.infer<typeof PaperFileSchema>
export type ProjectScaffoldOptions = z.infer<typeof ProjectScaffoldOptionsSchema>

export interface ProjectQuestionFile {
  path: string
  file: QuestionFile
}

export interface ProjectQuestionLookup {
  path: string
  file: QuestionFile
}

export interface ReadProjectResult {
  rootDir: string
  paperPath: string
  paper: PaperFile
  questionFiles: ProjectQuestionFile[]
  questionFilesById: Record<string, ProjectQuestionLookup>
}
