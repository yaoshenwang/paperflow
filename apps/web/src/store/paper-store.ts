'use client'

import { create } from 'zustand'

export type QuestionClip = {
  id: string
  questionItemId: string
  sectionId: string
  order: number
  score: number
  locked: boolean
  hiddenParts: ('answer' | 'analysis')[]
  altItemIds: string[]
  layoutHints?: {
    keepWithNext?: boolean
    forcePageBreakBefore?: boolean
    answerAreaSize?: 's' | 'm' | 'l'
  }
}

export type SectionNode = {
  id: string
  title: string
  order: number
}

export type QuestionItemSummary = {
  id: string
  subject: string
  grade: string
  questionType: string
  difficulty: number | null
  sourceLabel: string
  reviewStatus: string
  contentPreview: string
  libraryScope: 'public' | 'school'
}

export type PaperState = {
  // Paper metadata
  paperId: string | null
  title: string
  sections: SectionNode[]
  clips: QuestionClip[]

  // Source bin
  searchResults: QuestionItemSummary[]
  searchLoading: boolean
  itemSummaries: Record<string, QuestionItemSummary>

  // Selection
  selectedClipId: string | null

  // Preview
  previewPdf: string | null
  previewLoading: boolean

  // Actions
  setTitle: (title: string) => void
  addSection: (title: string) => void
  removeSection: (sectionId: string) => void

  addClip: (sectionId: string, item: QuestionItemSummary, score: number) => void
  removeClip: (clipId: string) => void
  moveClip: (clipId: string, targetSectionId: string, newOrder: number) => void
  reorderClips: (sectionId: string, clipIds: string[]) => void
  updateClipScore: (clipId: string, score: number) => void
  updateClipSection: (clipId: string, sectionId: string) => void
  toggleClipLock: (clipId: string) => void
  moveClipInSection: (clipId: string, direction: 'up' | 'down') => void

  selectClip: (clipId: string | null) => void
  loadPaper: (paper: { title: string; sections: SectionNode[]; clips: QuestionClip[] }, items: QuestionItemSummary[]) => void

  searchItems: (query: string, options?: { scope?: 'public' | 'school' | 'all' }) => Promise<void>
  refreshPreview: () => Promise<void>
}

let clipCounter = 0

export const usePaperStore = create<PaperState>((set, get) => ({
  paperId: null,
  title: '未命名试卷',
  sections: [
    { id: 'sec-1', title: '一、选择题', order: 0 },
    { id: 'sec-2', title: '二、填空题', order: 1 },
    { id: 'sec-3', title: '三、解答题', order: 2 },
  ],
  clips: [],
  searchResults: [],
  searchLoading: false,
  itemSummaries: {},
  selectedClipId: null,
  previewPdf: null,
  previewLoading: false,

  setTitle: (title) => set({ title }),

  addSection: (title) => {
    const sections = get().sections
    set({
      sections: [
        ...sections,
        { id: `sec-${Date.now()}`, title, order: sections.length },
      ],
    })
  },

  removeSection: (sectionId) => {
    set((s) => ({
      sections: s.sections.filter((sec) => sec.id !== sectionId),
      clips: s.clips.filter((c) => c.sectionId !== sectionId),
    }))
  },

  addClip: (sectionId, item, score) => {
    const { clips, itemSummaries } = get()
    const sectionClips = clips.filter((c) => c.sectionId === sectionId)
    const newClip: QuestionClip = {
      id: `qc-${++clipCounter}-${Date.now()}`,
      questionItemId: item.id,
      sectionId,
      order: sectionClips.length,
      score,
      locked: false,
      hiddenParts: [],
      altItemIds: [],
    }
    set({
      clips: [...clips, newClip],
      itemSummaries: {
        ...itemSummaries,
        [item.id]: item,
      },
    })
  },

  removeClip: (clipId) => {
    set((s) => {
      const removingClip = s.clips.find((clip) => clip.id === clipId)
      if (!removingClip) return s

      const remainingSectionClips = s.clips
        .filter((clip) => clip.sectionId === removingClip.sectionId && clip.id !== clipId)
        .sort((a, b) => a.order - b.order)
      const orderMap = new Map(remainingSectionClips.map((clip, index) => [clip.id, index]))

      return {
        clips: s.clips
          .filter((clip) => clip.id !== clipId)
          .map((clip) =>
            clip.sectionId === removingClip.sectionId
              ? { ...clip, order: orderMap.get(clip.id) ?? clip.order }
              : clip,
          ),
      }
    })
  },

  moveClip: (clipId, targetSectionId, newOrder) => {
    set((s) => {
      const movingClip = s.clips.find((clip) => clip.id === clipId)
      if (!movingClip) return s

      const targetSectionClips = s.clips
        .filter((clip) => clip.sectionId === targetSectionId && clip.id !== clipId)
        .sort((a, b) => a.order - b.order)

      const insertAt = Math.max(0, Math.min(newOrder, targetSectionClips.length))
      const reorderedTarget = [...targetSectionClips]
      reorderedTarget.splice(insertAt, 0, { ...movingClip, sectionId: targetSectionId })
      const targetOrderMap = new Map(reorderedTarget.map((clip, index) => [clip.id, index]))

      const sourceSectionClips = s.clips
        .filter((clip) => clip.sectionId === movingClip.sectionId && clip.id !== clipId)
        .sort((a, b) => a.order - b.order)
      const sourceOrderMap = new Map(sourceSectionClips.map((clip, index) => [clip.id, index]))

      return {
        clips: s.clips.map((clip) => {
          if (clip.id === clipId) {
            return { ...clip, sectionId: targetSectionId, order: insertAt }
          }
          if (clip.sectionId === targetSectionId) {
            return { ...clip, order: targetOrderMap.get(clip.id) ?? clip.order }
          }
          if (clip.sectionId === movingClip.sectionId) {
            return { ...clip, order: sourceOrderMap.get(clip.id) ?? clip.order }
          }
          return clip
        }),
      }
    })
  },

  reorderClips: (sectionId, clipIds) => {
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.sectionId !== sectionId) return c
        const idx = clipIds.indexOf(c.id)
        return idx >= 0 ? { ...c, order: idx } : c
      }),
    }))
  },

  updateClipScore: (clipId, score) => {
    set((s) => ({
      clips: s.clips.map((c) => (c.id === clipId ? { ...c, score } : c)),
    }))
  },

  updateClipSection: (clipId, sectionId) => {
    const state = get()
    const targetOrder = state.clips.filter((clip) => clip.sectionId === sectionId).length
    state.moveClip(clipId, sectionId, targetOrder)
  },

  toggleClipLock: (clipId) => {
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, locked: !c.locked } : c,
      ),
    }))
  },

  moveClipInSection: (clipId, direction) => {
    set((s) => {
      const current = s.clips.find((clip) => clip.id === clipId)
      if (!current) return s

      const sectionClips = s.clips
        .filter((clip) => clip.sectionId === current.sectionId)
        .sort((a, b) => a.order - b.order)

      const currentIndex = sectionClips.findIndex((clip) => clip.id === clipId)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sectionClips.length) {
        return s
      }

      const reordered = [...sectionClips]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      const orderMap = new Map(reordered.map((clip, index) => [clip.id, index]))

      return {
        clips: s.clips.map((clip) =>
          clip.sectionId === current.sectionId
            ? { ...clip, order: orderMap.get(clip.id) ?? clip.order }
            : clip,
        ),
      }
    })
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  loadPaper: (paper, items) => {
    set((state) => ({
      title: paper.title,
      sections: paper.sections,
      clips: paper.clips,
      searchResults: items,
      itemSummaries: {
        ...state.itemSummaries,
        ...Object.fromEntries(items.map((item) => [item.id, item])),
      },
      selectedClipId: paper.clips[0]?.id ?? null,
    }))
  },

  searchItems: async (query, options) => {
    set({ searchLoading: true })
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (options?.scope) params.set('scope', options.scope)
      params.set('limit', '50')
      const res = await fetch(`/api/items?${params}`)
      const data = await res.json()
      const items: QuestionItemSummary[] = data.items.map((item: Record<string, unknown>) => ({
        id: item.id,
        subject: item.subject,
        grade: item.grade,
        questionType: item.questionType,
        difficulty: item.difficulty,
        sourceLabel: item.sourceLabel,
        reviewStatus: item.reviewStatus,
        contentPreview: item.searchText || '',
        libraryScope: item.libraryScope === 'school' ? 'school' : 'public',
      }))
      set((state) => ({
        searchResults: items,
        itemSummaries: {
          ...state.itemSummaries,
          ...Object.fromEntries(items.map((item) => [item.id, item])),
        },
      }))
    } finally {
      set({ searchLoading: false })
    }
  },

  refreshPreview: async () => {
    set({ previewLoading: true })
    try {
      const { title, sections, clips } = get()
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sections, clips, mode: 'student' }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        set((s) => {
          if (s.previewPdf) URL.revokeObjectURL(s.previewPdf)
          return { previewPdf: url }
        })
      }
    } finally {
      set({ previewLoading: false })
    }
  },
}))
