import { lintProject as lintExamProject } from '@paperflow/exam-markdown'

export async function lintProject(projectPath: string) {
  return lintExamProject(projectPath)
}
