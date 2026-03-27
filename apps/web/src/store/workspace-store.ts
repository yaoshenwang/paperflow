'use client'

import { create } from 'zustand'

export type WorkspacePreviewMode = 'student' | 'teacher' | 'answer_sheet' | 'solution_book'
export type WorkspaceTemplatePreset =
  | 'default'
  | 'school-default'
  | 'exam-standard'
  | 'teacher-annotated'
  | 'answer-sheet'

export type WorkspaceBlueprint = {
  intent?: string
  subject: string
  grade: string
  totalScore: number
  duration?: number
  sections: Array<{
    questionType: string
    count: number
    scorePerItem: number
  }>
  difficultyDistribution?: {
    easy: number
    medium: number
    hard: number
  }
  knowledgeCoverage?: string[]
  sourcePreference?: string[]
  excludedSources?: string[]
  excludedKnowledge?: string[]
  regionPreference?: string[]
  yearRange?: [number, number]
  parallelVersions?: number
  outputModes?: WorkspacePreviewMode[]
}

export type WorkspaceSection = {
  id: string
  title: string
  note?: string
  order: number
}

export type WorkspaceClip = {
  id: string
  questionId: string
  sectionId: string
  order: number
  score: number
  locked: boolean
  hiddenParts: Array<'answer' | 'analysis'>
  layoutHints?: {
    keepWithNext?: boolean
    forcePageBreakBefore?: boolean
    answerAreaSize?: 's' | 'm' | 'l'
  }
}

export type WorkspaceQuestion = {
  id: string
  title: string
  subject: string
  grade: string
  type: string
  difficulty?: number | null
  sourceLabel: string
  sourcePath?: string
  sourceYear?: number | null
  sourceRegion?: string
  sourceExam?: string
  rightsStatus?: string
  status: string
  markdown: string
  preview: string
  tags: string[]
  hasAnswer?: boolean
  hasAnalysis?: boolean
  usedInPaper?: boolean
  matchTier?: 'exact' | 'replacement' | 'parallel'
  matchReason?: string
  similarCount?: number
  updatedAt?: string
}

export type WorkspaceProject = {
  projectPath: string
  title: string
  subject: string
  grade: string
  templatePreset: WorkspaceTemplatePreset
  mode: WorkspacePreviewMode
  blueprint?: WorkspaceBlueprint
  sections: WorkspaceSection[]
  clips: WorkspaceClip[]
  questions: WorkspaceQuestion[]
}

export type QuestionDraft = {
  id: string
  title: string
  subject: string
  grade: string
  type: string
  difficulty?: number | null
  sourceLabel: string
  sourcePath: string
  sourceYear?: number | null
  sourceRegion?: string
  sourceExam?: string
  rights?: string
  status: string
  markdown: string
  tags: string[]
  updatedAt?: string
}

export type WorkspaceSearchItem = WorkspaceQuestion & {
  scoreSuggested?: number
}

type InitWorkspaceInput = {
  projectPath: string
  title: string
  subject: string
  grade: string
  templatePreset: WorkspaceTemplatePreset
  mode: WorkspacePreviewMode
  generateDemoQuestions: boolean
}

type SearchFilters = {
  subject?: string
  grade?: string
  type?: string
  review?: string
  rights?: string
  knowledge?: string
  sampleProjectPath?: string
  scope?: 'all' | 'public' | 'school'
}

type EditableWorkspaceField = 'title' | 'subject' | 'grade' | 'templatePreset' | 'mode'

type WorkspaceState = {
  workspace: WorkspaceProject | null
  loading: boolean
  error: string | null

  selectedSectionId: string | null
  selectedQuestionId: string | null
  previewPdfUrl: string | null
  previewLoading: boolean
  previewError: string | null

  searchQuery: string
  searchResults: WorkspaceSearchItem[]
  searchLoading: boolean

  questionDraft: QuestionDraft | null
  questionLoading: boolean
  questionSaving: boolean
  questionError: string | null
  questionDirty: boolean
  workspaceSaving: boolean
  workspaceDirty: boolean

  loadWorkspace: (projectPath: string) => Promise<void>
  initWorkspace: (input: InitWorkspaceInput) => Promise<WorkspaceProject>
  setWorkspace: (workspace: WorkspaceProject) => void
  saveWorkspace: () => Promise<void>
  updateBlueprint: (blueprint: WorkspaceBlueprint) => void
  updateWorkspaceField: <K extends EditableWorkspaceField>(
    field: K,
    value: WorkspaceProject[K],
  ) => void
  selectSection: (sectionId: string | null) => void
  selectQuestion: (questionId: string | null) => void
  addSection: (title?: string) => void
  renameSection: (sectionId: string, title: string) => void
  removeSection: (sectionId: string) => void
  addQuestionToSection: (sectionId: string, question: WorkspaceSearchItem, score?: number) => void
  moveClip: (clipId: string, targetSectionId: string, targetOrder: number) => void
  updateClipScore: (clipId: string, score: number) => void
  toggleClipLock: (clipId: string) => void
  updateClipHiddenPart: (clipId: string, part: 'answer' | 'analysis', hidden: boolean) => void

  searchItems: (query: string, filters?: SearchFilters) => Promise<void>
  loadQuestion: (questionId: string) => Promise<void>
  updateQuestionDraft: (patch: Partial<QuestionDraft>) => void
  saveQuestion: () => Promise<QuestionDraft | null>
  deleteQuestion: (questionId?: string) => Promise<void>
  refreshPreview: () => Promise<void>
  lintWorkspace: () => Promise<unknown>
}

const DEFAULT_WORKSPACE: WorkspaceProject = {
  projectPath: '',
  title: '未命名试卷',
  subject: '',
  grade: '',
  templatePreset: 'school-default',
  mode: 'student',
  sections: [],
  clips: [],
  questions: [],
}

function cloneWorkspace(workspace: WorkspaceProject): WorkspaceProject {
  return {
    ...workspace,
    sections: [...workspace.sections].sort((a, b) => a.order - b.order),
    clips: [...workspace.clips].sort((a, b) => a.order - b.order),
    questions: [...workspace.questions],
  }
}

function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function safeNestedLabel(value: unknown, fallback = ''): string {
  if (!value || typeof value !== 'object') return fallback
  return safeText((value as Record<string, unknown>).label, fallback)
}

function normalizeQuestion(raw: Record<string, unknown>): WorkspaceQuestion {
  const markdown = safeText(
    raw.markdown ?? raw.sourceMarkdown ?? raw.body ?? raw.content ?? raw.text,
    '',
  )
  const preview = safeText(raw.preview, markdown.slice(0, 120).replace(/\s+/g, ' '))
  return {
    id: safeText(raw.id, `q-${Date.now()}`),
    title: safeText(raw.title ?? raw.name, '未命名题目'),
    subject: safeText(raw.subject, '未分类'),
    grade: safeText(raw.grade, '未分级'),
    type: safeText(raw.type ?? raw.questionType, 'essay'),
    difficulty: typeof raw.difficulty === 'number' ? raw.difficulty : null,
    sourceLabel: safeText(raw.sourceLabel ?? safeNestedLabel(raw.source), '本地工作区'),
    sourcePath: safeText(raw.sourcePath ?? raw.path, ''),
    sourceYear: typeof raw.sourceYear === 'number'
      ? raw.sourceYear
      : typeof (raw.source as { year?: unknown } | undefined)?.year === 'number'
        ? ((raw.source as { year: number }).year)
        : null,
    sourceRegion: safeText(raw.sourceRegion ?? (raw.source as { region?: unknown } | undefined)?.region, ''),
    sourceExam: safeText(raw.sourceExam ?? (raw.source as { exam?: unknown } | undefined)?.exam, ''),
    rightsStatus: safeText(raw.rightsStatus ?? raw.rights, ''),
    status: safeText(raw.status ?? raw.reviewStatus, 'draft'),
    markdown,
    preview,
    tags: safeArray<string>(raw.tags ?? raw.knowledgeIds).filter(Boolean),
    hasAnswer: typeof raw.hasAnswer === 'boolean' ? raw.hasAnswer : undefined,
    hasAnalysis: typeof raw.hasAnalysis === 'boolean' ? raw.hasAnalysis : undefined,
    usedInPaper: typeof raw.usedInPaper === 'boolean' ? raw.usedInPaper : undefined,
    matchTier: ['exact', 'replacement', 'parallel'].includes(safeText(raw.matchTier))
      ? safeText(raw.matchTier) as WorkspaceQuestion['matchTier']
      : undefined,
    matchReason: safeText(raw.matchReason),
    similarCount: typeof raw.similarCount === 'number' ? raw.similarCount : undefined,
    updatedAt: safeText(raw.updatedAt ?? raw.modifiedAt, ''),
  }
}

function normalizeBlueprint(raw: unknown): WorkspaceBlueprint | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const sections = safeArray<Record<string, unknown>>(value.sections).map((section) => ({
    questionType: safeText(section.questionType, 'essay'),
    count: Number(section.count ?? 0),
    scorePerItem: Number(section.scorePerItem ?? 0),
  }))

  return {
    intent: safeText(value.intent),
    subject: safeText(value.subject),
    grade: safeText(value.grade),
    totalScore: Number(value.totalScore ?? 0),
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    sections,
    difficultyDistribution: value.difficultyDistribution && typeof value.difficultyDistribution === 'object'
      ? {
          easy: Number((value.difficultyDistribution as Record<string, unknown>).easy ?? 0),
          medium: Number((value.difficultyDistribution as Record<string, unknown>).medium ?? 0),
          hard: Number((value.difficultyDistribution as Record<string, unknown>).hard ?? 0),
        }
      : undefined,
    knowledgeCoverage: safeArray<string>(value.knowledgeCoverage).filter(Boolean),
    sourcePreference: safeArray<string>(value.sourcePreference).filter(Boolean),
    excludedSources: safeArray<string>(value.excludedSources).filter(Boolean),
    excludedKnowledge: safeArray<string>(value.excludedKnowledge).filter(Boolean),
    regionPreference: safeArray<string>(value.regionPreference).filter(Boolean),
    yearRange: Array.isArray(value.yearRange) && value.yearRange.length === 2
      && typeof value.yearRange[0] === 'number' && typeof value.yearRange[1] === 'number'
      ? [value.yearRange[0], value.yearRange[1]]
      : undefined,
    parallelVersions: typeof value.parallelVersions === 'number' ? value.parallelVersions : undefined,
    outputModes: safeArray<WorkspacePreviewMode>(value.outputModes)
      .filter((entry): entry is WorkspacePreviewMode => ['student', 'teacher', 'answer_sheet', 'solution_book'].includes(entry)),
  }
}

function normalizeWorkspace(raw: Record<string, unknown>): WorkspaceProject {
  const project = (raw.workspace ?? raw.project ?? raw.data ?? raw) as Record<string, unknown>
  return cloneWorkspace({
    projectPath: safeText(project.projectPath, DEFAULT_WORKSPACE.projectPath),
    title: safeText(project.title, DEFAULT_WORKSPACE.title),
    subject: safeText(project.subject, DEFAULT_WORKSPACE.subject),
    grade: safeText(project.grade, DEFAULT_WORKSPACE.grade),
    templatePreset: safeText(project.templatePreset, DEFAULT_WORKSPACE.templatePreset) as WorkspaceTemplatePreset,
    mode: safeText(project.mode, DEFAULT_WORKSPACE.mode) as WorkspacePreviewMode,
    blueprint: normalizeBlueprint(project.blueprint),
    sections: safeArray<Record<string, unknown>>(project.sections).map((section, index) => ({
      id: safeText(section.id, `sec-${index + 1}`),
      title: safeText(section.title, `分区 ${index + 1}`),
      note: safeText(section.note, ''),
      order: Number(section.order ?? index),
    })),
    clips: safeArray<Record<string, unknown>>(project.clips).map((clip, index) => ({
      id: safeText(clip.id, `clip-${index + 1}`),
      questionId: safeText(clip.questionId ?? clip.questionItemId, ''),
      sectionId: safeText(clip.sectionId, ''),
      order: Number(clip.order ?? index),
      score: Number(clip.score ?? 0),
      locked: Boolean(clip.locked),
      hiddenParts: safeArray<'answer' | 'analysis'>(clip.hiddenParts).filter(Boolean),
      layoutHints: clip.layoutHints as WorkspaceClip['layoutHints'],
    })),
    questions: safeArray<Record<string, unknown>>(project.questions ?? project.items).map(normalizeQuestion),
  })
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

function questionDraftFromQuestion(question: WorkspaceQuestion): QuestionDraft {
  return {
    id: question.id,
    title: question.title,
    subject: question.subject,
    grade: question.grade,
    type: question.type,
    difficulty: question.difficulty,
    sourceLabel: question.sourceLabel,
    sourcePath: question.sourcePath ?? '',
    sourceYear: question.sourceYear,
    sourceRegion: question.sourceRegion,
    sourceExam: question.sourceExam,
    rights: question.rightsStatus,
    status: question.status,
    markdown: question.markdown,
    tags: question.tags,
    updatedAt: question.updatedAt,
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return {}
  return (await response.json()) as Record<string, unknown>
}

function updateWorkspaceClipOrder(clips: WorkspaceClip[], clipId: string, sectionId: string, order: number): WorkspaceClip[] {
  const moving = clips.find((clip) => clip.id === clipId)
  if (!moving) return clips

  const sourceClips = clips
    .filter((clip) => clip.sectionId === moving.sectionId && clip.id !== clipId)
    .sort((a, b) => a.order - b.order)
  const targetClips = clips
    .filter((clip) => clip.sectionId === sectionId && clip.id !== clipId)
    .sort((a, b) => a.order - b.order)

  const nextTarget = [...targetClips]
  nextTarget.splice(Math.max(0, Math.min(order, nextTarget.length)), 0, { ...moving, sectionId })

  const sourceOrderMap = new Map(sourceClips.map((clip, index) => [clip.id, index]))
  const targetOrderMap = new Map(nextTarget.map((clip, index) => [clip.id, index]))

  return clips.map((clip) => {
    if (clip.id === clipId) {
      return { ...clip, sectionId, order: Math.max(0, Math.min(order, nextTarget.length - 1)) }
    }
    if (clip.sectionId === sectionId) {
      return { ...clip, order: targetOrderMap.get(clip.id) ?? clip.order }
    }
    if (clip.sectionId === moving.sectionId) {
      return { ...clip, order: sourceOrderMap.get(clip.id) ?? clip.order }
    }
    return clip
  })
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  loading: false,
  error: null,

  selectedSectionId: null,
  selectedQuestionId: null,
  previewPdfUrl: null,
  previewLoading: false,
  previewError: null,

  searchQuery: '',
  searchResults: [],
  searchLoading: false,

  questionDraft: null,
  questionLoading: false,
  questionSaving: false,
  questionError: null,
  questionDirty: false,
  workspaceSaving: false,
  workspaceDirty: false,

  loadWorkspace: async (projectPath) => {
    set({ loading: true, error: null })
    try {
      const query = projectPath
        ? `?projectPath=${encodeURIComponent(projectPath)}`
        : ''
      const response = await fetch(`/api/workspace${query}`)
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Failed to load workspace: ${response.status}`))
      }
      const workspace = normalizeWorkspace(data)
      set({
        workspace,
        selectedSectionId: workspace.sections[0]?.id ?? null,
        selectedQuestionId: workspace.clips[0]?.questionId ?? workspace.questions[0]?.id ?? null,
        questionDraft: workspace.questions[0] ? questionDraftFromQuestion(workspace.questions[0]) : null,
        workspaceDirty: false,
      })
    } catch (error) {
      set({
        workspace: null,
        error: extractErrorMessage(error),
        selectedSectionId: null,
        selectedQuestionId: null,
        questionDraft: null,
        searchResults: [],
        workspaceDirty: false,
      })
    } finally {
      set({ loading: false })
    }
  },

  initWorkspace: async (input) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/workspace/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Failed to initialize workspace: ${response.status}`))
      }
      const workspace = normalizeWorkspace(data)
      set({
        workspace,
        selectedSectionId: workspace.sections[0]?.id ?? null,
        selectedQuestionId: workspace.clips[0]?.questionId ?? workspace.questions[0]?.id ?? null,
        questionDraft: workspace.questions[0] ? questionDraftFromQuestion(workspace.questions[0]) : null,
        workspaceDirty: false,
      })
      return workspace
    } catch (error) {
      set({
        workspace: null,
        error: extractErrorMessage(error),
        selectedSectionId: null,
        selectedQuestionId: null,
        questionDraft: null,
        searchResults: [],
        workspaceDirty: false,
      })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  setWorkspace: (workspace) => {
    const normalized = cloneWorkspace(workspace)
    set({
      workspace: normalized,
      selectedSectionId: normalized.sections[0]?.id ?? null,
      selectedQuestionId: normalized.clips[0]?.questionId ?? normalized.questions[0]?.id ?? null,
      questionDraft: normalized.questions[0] ? questionDraftFromQuestion(normalized.questions[0]) : null,
      workspaceDirty: false,
    })
  },

  updateBlueprint: (blueprint) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          blueprint,
          subject: blueprint.subject || state.workspace.subject,
          grade: blueprint.grade || state.workspace.grade,
        },
        workspaceDirty: true,
      }
    })
  },

  saveWorkspace: async () => {
    const workspace = get().workspace
    if (!workspace) return
    set({ workspaceSaving: true, error: null })
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: workspace.projectPath, workspace }),
      })
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Failed to save workspace: ${response.status}`))
      }
      set({ workspaceDirty: false })
    } catch (error) {
      set({ error: extractErrorMessage(error) })
      throw error
    } finally {
      set({ workspaceSaving: false })
    }
  },

  updateWorkspaceField: (field, value) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          [field]: value,
        },
        workspaceDirty: true,
      }
    })
  },

  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),
  selectQuestion: (questionId) => set({ selectedQuestionId: questionId }),

  addSection: (title) => {
    set((state) => {
      if (!state.workspace) return state
      const nextSection: WorkspaceSection = {
        id: `sec-${Date.now()}`,
        title: title ?? `新分区 ${state.workspace.sections.length + 1}`,
        order: state.workspace.sections.length,
      }
      return {
        workspace: {
          ...state.workspace,
          sections: [...state.workspace.sections, nextSection],
        },
        selectedSectionId: nextSection.id,
        workspaceDirty: true,
      }
    })
  },

  renameSection: (sectionId, title) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          sections: state.workspace.sections.map((section) =>
            section.id === sectionId ? { ...section, title } : section,
          ),
        },
        workspaceDirty: true,
      }
    })
  },

  removeSection: (sectionId) => {
    set((state) => {
      if (!state.workspace) return state
      const remainingSections = state.workspace.sections
        .filter((section) => section.id !== sectionId)
        .map((section, index) => ({ ...section, order: index }))
      const remainingClips = state.workspace.clips
        .filter((clip) => clip.sectionId !== sectionId)
        .map((clip) => ({ ...clip }))
      return {
        workspace: {
          ...state.workspace,
          sections: remainingSections,
          clips: remainingClips,
        },
        selectedSectionId:
          state.selectedSectionId === sectionId ? remainingSections[0]?.id ?? null : state.selectedSectionId,
        workspaceDirty: true,
      }
    })
  },

  addQuestionToSection: (sectionId, question, score = question.scoreSuggested ?? 5) => {
    set((state) => {
      if (!state.workspace) return state
      const hasQuestion = state.workspace.questions.some((item) => item.id === question.id)
      const nextQuestion = hasQuestion ? state.workspace.questions : [...state.workspace.questions, question]
      const nextSectionClips = state.workspace.clips.filter((clip) => clip.sectionId === sectionId)
      const nextClip: WorkspaceClip = {
        id: `clip-${Date.now()}`,
        questionId: question.id,
        sectionId,
        order: nextSectionClips.length,
        score,
        locked: false,
        hiddenParts: [],
      }
      return {
        workspace: {
          ...state.workspace,
          questions: nextQuestion,
          clips: [...state.workspace.clips, nextClip],
        },
        selectedQuestionId: question.id,
        workspaceDirty: true,
      }
    })
  },

  moveClip: (clipId, targetSectionId, targetOrder) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          clips: updateWorkspaceClipOrder(state.workspace.clips, clipId, targetSectionId, targetOrder),
        },
        workspaceDirty: true,
      }
    })
  },

  updateClipScore: (clipId, score) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          clips: state.workspace.clips.map((clip) => (clip.id === clipId ? { ...clip, score } : clip)),
        },
        workspaceDirty: true,
      }
    })
  },

  toggleClipLock: (clipId) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          clips: state.workspace.clips.map((clip) =>
            clip.id === clipId ? { ...clip, locked: !clip.locked } : clip,
          ),
        },
        workspaceDirty: true,
      }
    })
  },

  updateClipHiddenPart: (clipId, part, hidden) => {
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          clips: state.workspace.clips.map((clip) => {
            if (clip.id !== clipId) return clip
            const nextHidden = hidden
              ? Array.from(new Set([...clip.hiddenParts, part]))
              : clip.hiddenParts.filter((value) => value !== part)
            return { ...clip, hiddenParts: nextHidden }
          }),
        },
        workspaceDirty: true,
      }
    })
  },

  searchItems: async (query, filters) => {
    set({ searchQuery: query, searchLoading: true, error: null })
    try {
      const workspace = get().workspace
      const projectPath = workspace?.projectPath
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (filters?.subject) params.set('subject', filters.subject)
      if (filters?.grade) params.set('grade', filters.grade)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.review) params.set('review', filters.review)
      if (filters?.rights) params.set('rights', filters.rights)
      if (filters?.knowledge) params.set('knowledge', filters.knowledge)
      if (filters?.sampleProjectPath) params.set('sampleProjectPath', filters.sampleProjectPath)
      if (filters?.scope) params.set('scope', filters.scope)
      const relatedQuestionId = get().selectedQuestionId
      if (relatedQuestionId) params.set('relatedToQuestionId', relatedQuestionId)
      if (workspace?.blueprint) {
        params.set('blueprintSubject', workspace.blueprint.subject)
        params.set('blueprintGrade', workspace.blueprint.grade)
      }
      if (projectPath) params.set('projectPath', projectPath)
      params.set('limit', '50')

      const response = await fetch(`/api/items?${params.toString()}`)
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Search failed: ${response.status}`))
      }

      const items = safeArray<Record<string, unknown>>(data.items).map((item) => normalizeQuestion(item))
      set({
        searchResults: items.map((item, index) => ({
          ...item,
          scoreSuggested: index === 0 && /证明|解答/.test(item.type) ? 10 : 5,
        })),
      })
    } catch (error) {
      set({
        searchResults: [],
        error: extractErrorMessage(error),
      })
    } finally {
      set({ searchLoading: false })
    }
  },

  loadQuestion: async (questionId) => {
    set({ questionLoading: true, questionError: null, selectedQuestionId: questionId })
    try {
      const projectPath = get().workspace?.projectPath
      const params = new URLSearchParams()
      if (projectPath) params.set('projectPath', projectPath)
      const response = await fetch(`/api/items/${encodeURIComponent(questionId)}?${params.toString()}`)
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Failed to load question: ${response.status}`))
      }
      const question = normalizeQuestion(data)
      set({
        questionDraft: {
          id: question.id,
          title: question.title,
          subject: question.subject,
          grade: question.grade,
          type: question.type,
          difficulty: question.difficulty,
          sourceLabel: question.sourceLabel,
          sourcePath: question.sourcePath ?? '',
          sourceYear: question.sourceYear,
          sourceRegion: question.sourceRegion,
          sourceExam: question.sourceExam,
          rights: question.rightsStatus,
          status: question.status,
          markdown: question.markdown,
          tags: question.tags,
          updatedAt: question.updatedAt,
        },
        questionDirty: false,
      })
    } catch (error) {
      set({
        questionDraft: null,
        questionError: extractErrorMessage(error),
        questionDirty: false,
      })
    } finally {
      set({ questionLoading: false })
    }
  },

  updateQuestionDraft: (patch) => {
    set((state) => {
      if (!state.questionDraft) return state
      return {
        questionDraft: {
          ...state.questionDraft,
          ...patch,
        },
        questionDirty: true,
      }
    })
  },

  saveQuestion: async () => {
    const draft = get().questionDraft
    if (!draft) return null
    const projectPath = get().workspace?.projectPath
    set({ questionSaving: true, questionError: null })
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(draft.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, projectPath }),
      })
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error(safeText(data.error, `Failed to save question: ${response.status}`))
      }
      const question = normalizeQuestion(data)
      const nextDraft: QuestionDraft = {
        id: question.id,
        title: question.title,
        subject: question.subject,
        grade: question.grade,
        type: question.type,
        difficulty: question.difficulty,
        sourceLabel: question.sourceLabel,
        sourcePath: question.sourcePath ?? '',
        sourceYear: question.sourceYear,
        sourceRegion: question.sourceRegion,
        sourceExam: question.sourceExam,
        rights: question.rightsStatus,
        status: question.status,
        markdown: question.markdown,
        tags: question.tags,
        updatedAt: question.updatedAt,
      }
      set((state) => ({
        questionDraft: nextDraft,
        questionDirty: false,
        workspace: state.workspace
          ? {
              ...state.workspace,
              questions: state.workspace.questions.map((item) => (item.id === question.id ? question : item)),
            }
          : state.workspace,
      }))
      return nextDraft
    } catch (error) {
      set({ questionError: extractErrorMessage(error) })
      return null
    } finally {
      set({ questionSaving: false })
    }
  },

  deleteQuestion: async (questionId) => {
    const currentId = questionId ?? get().questionDraft?.id
    if (!currentId) return
    const projectPath = get().workspace?.projectPath
    const response = await fetch(`/api/items/${encodeURIComponent(currentId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    })
    if (!response.ok) {
      const data = await readJson(response)
      set({ questionError: safeText(data.error, `Failed to delete question: ${response.status}`) })
      return
    }
    set((state) => {
      if (!state.workspace) return state
      return {
        workspace: {
          ...state.workspace,
          questions: state.workspace.questions.filter((question) => question.id !== currentId),
          clips: state.workspace.clips.filter((clip) => clip.questionId !== currentId),
        },
        questionDraft: null,
        selectedQuestionId: state.selectedQuestionId === currentId ? null : state.selectedQuestionId,
        workspaceDirty: true,
      }
    })
  },

  refreshPreview: async () => {
    const workspace = get().workspace
    if (!workspace) return

    set({ previewLoading: true, previewError: null })
    try {
      if (get().workspaceDirty) {
        await get().saveWorkspace()
      }
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: workspace.projectPath,
          mode: workspace.mode,
          workspace,
        }),
      })

      if (!response.ok) {
        const data = await readJson(response)
        throw new Error(safeText(data.error, `Preview failed: ${response.status}`))
      }

      const blob = await response.blob()
      const previewUrl = URL.createObjectURL(blob)
      set((state) => {
        if (state.previewPdfUrl) URL.revokeObjectURL(state.previewPdfUrl)
        return { previewPdfUrl: previewUrl }
      })
    } catch (error) {
      set({ previewError: extractErrorMessage(error) })
    } finally {
      set({ previewLoading: false })
    }
  },

  lintWorkspace: async () => {
    const workspace = get().workspace
    if (!workspace?.projectPath) {
      return { error: 'No workspace selected' }
    }
    if (get().workspaceDirty) {
      await get().saveWorkspace()
    }
    const response = await fetch('/api/lint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: workspace.projectPath }),
    })
    return readJson(response)
  },
}))

export { DEFAULT_WORKSPACE }
