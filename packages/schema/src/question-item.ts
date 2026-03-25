import { z } from 'zod'
import { BlockSchema, OptionSchema, SubQuestionSchema } from './block.js'
import { QuestionTypeSchema, ReviewStatusSchema, RightsStatusSchema } from './enums.js'

const SourceLocatorSchema = z.object({
  page: z.number().int().min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  questionNo: z.string().optional(),
})

const TaxonomySchema = z.object({
  subject: z.string(),
  grade: z.string(),
  textbookVersion: z.string().optional(),
  knowledgeIds: z.array(z.string()),
  abilityTags: z.array(z.string()),
  questionType: QuestionTypeSchema,
  difficulty: z.number().min(0).max(1).optional(),
})

const AssetRefSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'audio', 'video']),
  src: z.string(),
})

const ContentSchema = z.object({
  stem: z.array(BlockSchema),
  options: z.array(OptionSchema).optional(),
  subquestions: z.array(SubQuestionSchema).optional(),
  answer: z.array(BlockSchema).optional(),
  analysis: z.array(BlockSchema).optional(),
  assets: z.array(AssetRefSchema),
})

const ProvenanceSchema = z.object({
  examName: z.string().optional(),
  region: z.string().optional(),
  school: z.string().optional(),
  year: z.number().int().optional(),
  sourceLabel: z.string(),
})

const QualitySchema = z.object({
  reviewStatus: ReviewStatusSchema,
  answerVerified: z.boolean(),
  duplicateClusterId: z.string().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  reviewerId: z.string().optional(),
})

export const QuestionItemSchema = z.object({
  id: z.string(),
  canonicalId: z.string(),
  sourceDocumentId: z.string(),
  sourceLocator: SourceLocatorSchema,
  taxonomy: TaxonomySchema,
  content: ContentSchema,
  provenance: ProvenanceSchema,
  quality: QualitySchema,
  rightsStatus: RightsStatusSchema,
})

export type QuestionItem = z.infer<typeof QuestionItemSchema>
