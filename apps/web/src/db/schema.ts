import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core'

/**
 * source_documents — 来源文档表
 */
export const sourceDocuments = pgTable('source_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type', {
    enum: ['provider', 'school_upload', 'teacher_upload', 'curated', 'ai_lab'],
  }).notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  grade: text('grade').notNull(),
  region: text('region'),
  year: integer('year'),
  examName: text('exam_name'),
  paperType: text('paper_type'),
  fileRef: text('file_ref').notNull(),
  pageCount: integer('page_count').notNull(),
  rightsStatus: text('rights_status', {
    enum: ['public_domain', 'cc', 'school_owned', 'licensed', 'restricted', 'prohibited'],
  }).notNull(),
  ownerOrgId: text('owner_org_id'),
  uploadedBy: text('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * question_items — 题目表
 */
export const questionItems = pgTable(
  'question_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalId: text('canonical_id').notNull(),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id),
    sourceLocator: jsonb('source_locator').$type<{
      page: number
      bbox?: [number, number, number, number]
      questionNo?: string
    }>(),

    // taxonomy
    subject: text('subject').notNull(),
    grade: text('grade').notNull(),
    textbookVersion: text('textbook_version'),
    knowledgeIds: jsonb('knowledge_ids').$type<string[]>().notNull().default([]),
    abilityTags: jsonb('ability_tags').$type<string[]>().notNull().default([]),
    questionType: text('question_type', {
      enum: [
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
      ],
    }).notNull(),
    difficulty: real('difficulty'),

    // content — 整块 JSON 存储（Block AST）
    content: jsonb('content')
      .$type<{
        stem: unknown[]
        options?: unknown[]
        subquestions?: unknown[]
        answer?: unknown[]
        analysis?: unknown[]
        assets: unknown[]
      }>()
      .notNull(),

    // provenance
    examName: text('exam_name'),
    region: text('region'),
    school: text('school'),
    year: integer('year'),
    sourceLabel: text('source_label').notNull(),

    // quality
    reviewStatus: text('review_status', {
      enum: ['draft', 'parsed', 'tagged', 'checked', 'approved', 'published', 'archived'],
    })
      .notNull()
      .default('draft'),
    answerVerified: boolean('answer_verified').notNull().default(false),
    duplicateClusterId: text('duplicate_cluster_id'),
    ocrConfidence: real('ocr_confidence'),
    reviewerId: text('reviewer_id'),

    rightsStatus: text('rights_status', {
      enum: ['public_domain', 'cc', 'school_owned', 'licensed', 'restricted', 'prohibited'],
    }).notNull(),

    // full-text search column
    searchText: text('search_text'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qi_subject_grade').on(table.subject, table.grade),
    index('idx_qi_question_type').on(table.questionType),
    index('idx_qi_review_status').on(table.reviewStatus),
    index('idx_qi_difficulty').on(table.difficulty),
  ],
)

/**
 * paper_projects — 试卷项目表
 */
export const paperProjects = pgTable('paper_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: text('org_id').notNull(),
  title: text('title').notNull(),
  blueprint: jsonb('blueprint').notNull(),
  sections: jsonb('sections').$type<unknown[]>().notNull().default([]),
  clips: jsonb('clips').$type<unknown[]>().notNull().default([]),
  templatePreset: text('template_preset').notNull().default('default'),
  outputModes: jsonb('output_modes').$type<string[]>().notNull().default(['student', 'teacher']),
  version: integer('version').notNull().default(1),
  status: text('status', {
    enum: ['draft', 'reviewing', 'approved', 'published'],
  })
    .notNull()
    .default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
