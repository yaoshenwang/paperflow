import { z } from 'zod'
import { BlueprintSchema } from './blueprint.js'
import { QuestionClipSchema } from './question-clip.js'
import { OutputModeSchema, PaperStatusSchema } from './enums.js'

export const SectionNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int().min(0),
})

export const PaperProjectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  blueprint: BlueprintSchema,
  sections: z.array(SectionNodeSchema),
  clips: z.array(QuestionClipSchema),
  templatePreset: z.string(),
  outputModes: z.array(OutputModeSchema),
  version: z.number().int().min(1),
  status: PaperStatusSchema,
})

export type PaperProject = z.infer<typeof PaperProjectSchema>
export type SectionNode = z.infer<typeof SectionNodeSchema>
