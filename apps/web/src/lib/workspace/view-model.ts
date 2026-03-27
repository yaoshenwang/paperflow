import { serializeQuestionFile } from '@paperflow/exam-markdown'
import { normalizeWorkspaceBlueprint } from './blueprint'
import type { ProjectSnapshot, QuestionFile } from './types'

function questionTitle(question: QuestionFile) {
  const firstLine = question.stem
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine ? firstLine.replace(/^#+\s*/, '').slice(0, 48) : question.id
}

function questionPreview(question: QuestionFile) {
  return [question.stem, question.answer, question.analysis]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

function toMarkdown(question: QuestionFile) {
  return serializeQuestionFile({
    frontMatter: {
      ...question.frontmatter,
      id: question.id,
      type: question.type as never,
      subject: question.subject,
      grade: question.grade,
      difficulty: question.difficulty ?? undefined,
      score_suggest: question.scoreSuggest ?? undefined,
      knowledge: question.knowledge,
      source: question.source,
      rights: question.rights as never,
      review: question.review as never,
      tags: question.tags,
      layout: {
        option_cols: question.layout.optionCols,
        keep_with_next: question.layout.keepWithNext,
        force_page_break_before: question.layout.forcePageBreakBefore,
        answer_area_size: question.layout.answerAreaSize,
      },
    },
    sections: [
      { name: 'stem', content: question.stem },
      ...(question.options.length > 0
        ? [{ name: 'options', content: question.options.map((option) => `- ${option.label}. ${option.text}`).join('\n') }]
        : []),
      ...(question.answer.trim() ? [{ name: 'answer', content: question.answer }] : []),
      ...(question.analysis.trim() ? [{ name: 'analysis', content: question.analysis }] : []),
    ],
  })
}

function questionToWorkspaceRecord(question: QuestionFile, usedInPaper = false) {
  return {
    id: question.id,
    title: questionTitle(question),
    subject: question.subject,
    grade: question.grade,
    type: question.type,
    difficulty: question.difficulty,
    sourceLabel: question.source.label ?? '本地工作区',
    sourcePath: question.relativePath,
    sourceYear: question.source.year ?? null,
    sourceRegion: question.source.region ?? '',
    sourceExam: question.source.exam ?? '',
    rightsStatus: question.rights,
    status: question.review,
    markdown: toMarkdown(question),
    preview: questionPreview(question),
    tags: question.tags.length > 0 ? question.tags : question.knowledge,
    hasAnswer: Boolean(question.answer.trim()),
    hasAnalysis: Boolean(question.analysis.trim()),
    usedInPaper,
    updatedAt: '',
  }
}

export function snapshotToWorkspace(snapshot: ProjectSnapshot, projectPath = snapshot.rootDir) {
  const questionByPath = new Map(snapshot.questions.map((question) => [question.relativePath, question]))
  const usedQuestionIds = new Set<string>()
  const blueprint = normalizeWorkspaceBlueprint(snapshot.paper.paperflow.blueprint, snapshot)
  const sections = snapshot.paper.sections.map((section, index) => ({
    id: section.id,
    title: section.title,
    order: index,
  }))

  const clips = snapshot.paper.sections.flatMap((section) =>
    section.questions.map((entry, index) => {
      const question = questionByPath.get(entry.file)
      return {
        id: `${section.id}-${index + 1}`,
        questionId: question?.id ?? entry.file,
        sectionId: section.id,
        order: index,
        score: entry.score ?? question?.scoreSuggest ?? 0,
        locked: entry.locked,
        hiddenParts: entry.hiddenParts,
        layoutHints: entry.layoutHints,
      }
    }),
  )

  clips.forEach((clip) => usedQuestionIds.add(clip.questionId))
  const questions = snapshot.questions.map((question) => questionToWorkspaceRecord(question, usedQuestionIds.has(question.id)))

  return {
    workspace: {
      projectPath,
      title: snapshot.paper.title,
      subject: (snapshot.paper.frontmatter.subject as string | undefined) ?? snapshot.questions[0]?.subject ?? '',
      grade: (snapshot.paper.frontmatter.grade as string | undefined) ?? snapshot.questions[0]?.grade ?? '',
      templatePreset: snapshot.paper.paperflow.templatePreset,
      mode: snapshot.paper.paperflow.mode,
      blueprint,
      sections,
      clips,
      questions,
    },
  }
}

export function questionToWorkspaceQuestion(question: QuestionFile) {
  return questionToWorkspaceRecord(question)
}
