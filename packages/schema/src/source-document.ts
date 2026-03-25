import { z } from 'zod'
import { RightsStatusSchema, SourceTypeSchema } from './enums.js'

export const SourceDocumentSchema = z.object({
  id: z.string(),
  sourceType: SourceTypeSchema,
  title: z.string(),
  subject: z.string(),
  grade: z.string(),
  region: z.string().optional(),
  year: z.number().int().optional(),
  examName: z.string().optional(),
  paperType: z.string().optional(),
  fileRef: z.string(),
  pageCount: z.number().int().min(1),
  rightsStatus: RightsStatusSchema,
  ownerOrgId: z.string().optional(),
  uploadedBy: z.string().optional(),
  createdAt: z.string().datetime(),
})

export type SourceDocument = z.infer<typeof SourceDocumentSchema>
