import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createProjectScaffold,
  lintProject,
  parsePaperFile,
  parseQuestionFile,
  readProject,
  serializePaperFile,
  serializeQuestionFile,
  writePaperFile,
  writeQuestionFile,
} from '../src/index.js'

describe('question file roundtrip', () => {
  it('parses and serializes sectioned question markdown', () => {
    const source = [
      '---',
      'id: q-001',
      'type: single_choice',
      'subject: math',
      'grade: high-1',
      'rights: school_owned',
      'review: checked',
      '---',
      '',
      '::: {.stem}',
      '已知函数 $f(x)=x^2$。',
      ':::',
      '',
      '::: {.options}',
      '- A. 1',
      '- B. 2',
      ':::',
      '',
      '::: {.answer}',
      'B',
      ':::',
      '',
    ].join('\n')

    const parsed = parseQuestionFile(source)
    expect(parsed.frontMatter.id).toBe('q-001')
    expect(parsed.sections).toHaveLength(3)
    expect(serializeQuestionFile(parsed)).toContain('::: {.stem}')
  })
})

describe('paper file roundtrip', () => {
  it('parses and serializes paper markdown with question shortcodes', () => {
    const source = [
      '---',
      'title: Sample Exam',
      'paperflow:',
      '  mode: student',
      '---',
      '',
      '## Section A',
      '',
      '{{< question file="questions/q-001.md" score="5" >}}',
      '',
      'Some note.',
      '',
    ].join('\n')

    const parsed = parsePaperFile(source)
    expect(parsed.frontMatter.title).toBe('Sample Exam')
    expect(parsed.nodes.some((node) => node.type === 'question')).toBe(true)
    expect(serializePaperFile(parsed)).toContain('{{< question file="questions/q-001.md" score="5" >}}')
  })
})

describe('project scaffold', () => {
  it('creates a file-first project scaffold and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'paperflow-exam-markdown-'))
    try {
      await createProjectScaffold({
        rootDir: root,
        title: '高一数学期中测试卷',
        subject: '数学',
        grade: '高一',
        includeSampleQuestions: true,
        outputMode: 'student',
      })

      const project = await readProject(root)
      expect(project.paper.frontMatter.title).toBe('高一数学期中测试卷')
      expect(project.questionFiles).toHaveLength(3)

      const paperPath = join(root, 'paper.qmd')
      const paperSource = await readFile(paperPath, 'utf-8')
      expect(paperSource).toContain('{{< question file="questions/q-001.md" score="5" >}}')

      const qPath = join(root, 'questions', 'q-001.md')
      const qSource = await readFile(qPath, 'utf-8')
      expect(qSource).toContain('id: q-001')

      await writeQuestionFile(
        join(root, 'questions', 'q-extra.md'),
        parseQuestionFile([
          '---',
          'id: q-extra',
          'type: fill_blank',
          'subject: math',
          'grade: high-1',
          '---',
          '',
          '::: {.stem}',
          '1 + 1 = ____',
          ':::',
          '',
        ].join('\n')),
      )
      await writePaperFile(
        join(root, 'paper.qmd'),
        parsePaperFile([
          '---',
          'title: Updated',
          '---',
          '',
          '## Section A',
          '',
          '{{< question file="questions/q-extra.md" score="2" >}}',
          '',
        ].join('\n')),
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('project lint', () => {
  it('reports missing question references and invalid assets without crashing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'paperflow-exam-markdown-lint-'))
    try {
      await createProjectScaffold({
        rootDir: root,
        title: 'Lint Exam',
        subject: '数学',
        grade: '高一',
        includeSampleQuestions: true,
        outputMode: 'student',
      })

      await writePaperFile(
        join(root, 'paper.qmd'),
        parsePaperFile([
          '---',
          'title: Lint Exam',
          'paperflow:',
          '  template: school-default',
          '---',
          '',
          '## 一、选择题',
          '',
          '{{< question file="questions/q-001.md" score="5" >}}',
          '',
          '## 二、填空题',
          '',
          '{{< question file="questions/missing.md" >}}',
          '',
        ].join('\n')),
      )

      await writeQuestionFile(
        join(root, 'questions', 'q-001.md'),
        parseQuestionFile([
          '---',
          'id: q-001',
          'type: single_choice',
          'subject: math',
          'grade: high-1',
          'review: raw',
          'source:',
          '  label: 本地题',
          '---',
          '',
          '::: {.stem}',
          '题干 ![](./missing.png)',
          ':::',
          '',
        ].join('\n')),
      )

      const report = await lintProject(root)
      expect(report.summary.fail).toBeGreaterThan(0)
      expect(report.checks.find((check) => check.id === 'missing_files')?.status).toBe('fail')
      expect(report.checks.find((check) => check.id === 'assets')?.status).toBe('fail')
      expect(report.checks.find((check) => check.id === 'raw_review')?.status).toBe('warn')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
