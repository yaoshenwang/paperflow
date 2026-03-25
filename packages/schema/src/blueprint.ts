import { z } from 'zod'
import { QuestionTypeSchema } from './enums.js'

const SectionSpecSchema = z.object({
  questionType: QuestionTypeSchema,
  count: z.number().int().min(1),
  scorePerItem: z.number().min(0),
})

const DifficultyDistributionSchema = z.object({
  easy: z.number().min(0).max(1),
  medium: z.number().min(0).max(1),
  hard: z.number().min(0).max(1),
})

export const BlueprintSchema = z.object({
  subject: z.string(),
  grade: z.string(),
  totalScore: z.number().min(0),
  duration: z.number().int().min(1).optional(),
  sections: z.array(SectionSpecSchema),
  difficultyDistribution: DifficultyDistributionSchema.optional(),
  knowledgeCoverage: z.array(z.string()).optional(),
  sourcePreference: z.array(z.string()).optional(),
  excludedSources: z.array(z.string()).optional(),
  excludedKnowledge: z.array(z.string()).optional(),
  regionPreference: z.array(z.string()).optional(),
  yearRange: z.tuple([z.number().int(), z.number().int()]).optional(),
  parallelVersions: z.number().int().min(1).optional(),
  outputModes: z.array(z.enum(['student', 'teacher', 'answer_sheet', 'solution_book'])).optional(),
})

export type Blueprint = z.infer<typeof BlueprintSchema>
