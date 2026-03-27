export type WorkspaceMode = 'student' | 'teacher' | 'answer_sheet' | 'solution_book'

export type WorkspaceBlueprintSection = {
  questionType: string
  count: number
  scorePerItem: number
}

export type WorkspaceBlueprintDifficulty = {
  easy: number
  medium: number
  hard: number
}

export type WorkspaceBlueprint = {
  intent?: string
  subject: string
  grade: string
  totalScore: number
  duration?: number
  sections: WorkspaceBlueprintSection[]
  difficultyDistribution?: WorkspaceBlueprintDifficulty
  knowledgeCoverage?: string[]
  sourcePreference?: string[]
  excludedSources?: string[]
  excludedKnowledge?: string[]
  regionPreference?: string[]
  yearRange?: [number, number]
  parallelVersions?: number
  outputModes?: WorkspaceMode[]
}

export type QuestionOption = {
  label: string
  text: string
}

export type QuestionLayout = {
  optionCols?: number
  keepWithNext?: boolean
  forcePageBreakBefore?: boolean
  answerAreaSize?: 's' | 'm' | 'l'
}

export type QuestionSource = {
  label?: string
  year?: number
  region?: string
  exam?: string
  school?: string
}

export type QuestionFile = {
  id: string
  path: string
  relativePath: string
  type: string
  subject: string
  grade: string
  difficulty: number | null
  scoreSuggest: number | null
  knowledge: string[]
  source: QuestionSource
  rights: string
  review: string
  tags: string[]
  layout: QuestionLayout
  stem: string
  options: QuestionOption[]
  answer: string
  analysis: string
  frontmatter: Record<string, unknown>
}

export type PaperQuestionRef = {
  file: string
  score: number | null
  locked: boolean
  hiddenParts: Array<'answer' | 'analysis'>
  layoutHints?: {
    keepWithNext?: boolean
    forcePageBreakBefore?: boolean
    answerAreaSize?: 's' | 'm' | 'l'
  }
}

export type PaperSection = {
  id: string
  title: string
  questions: PaperQuestionRef[]
}

export type PaperFile = {
  path: string
  relativePath: string
  title: string
  frontmatter: Record<string, unknown>
  paperflow: {
    mode: WorkspaceMode
    template: string
    templatePreset: string
    showScore: boolean
    showAnswer: boolean
    showAnalysis: boolean
    blueprint?: WorkspaceBlueprint
  }
  sections: PaperSection[]
}

export type ProjectSnapshot = {
  rootDir: string
  paper: PaperFile
  questions: QuestionFile[]
}

export type QuestionSummary = {
  id: string
  subject: string
  grade: string
  questionType: string
  difficulty: number | null
  sourceLabel: string
  reviewStatus: string
  contentPreview: string
  file: string
}

export type ReviewCheck = {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}
