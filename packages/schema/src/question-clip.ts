import { z } from 'zod'

const LayoutHintsSchema = z.object({
  keepWithNext: z.boolean().optional(),
  forcePageBreakBefore: z.boolean().optional(),
  answerAreaSize: z.enum(['s', 'm', 'l']).optional(),
})

export const QuestionClipSchema = z.object({
  id: z.string(),
  questionItemId: z.string(),
  sectionId: z.string(),
  order: z.number().int().min(0),
  score: z.number().min(0),
  locked: z.boolean(),
  hiddenParts: z.array(z.enum(['answer', 'analysis'])),
  altItemIds: z.array(z.string()),
  layoutHints: LayoutHintsSchema.optional(),
})

export type QuestionClip = z.infer<typeof QuestionClipSchema>
