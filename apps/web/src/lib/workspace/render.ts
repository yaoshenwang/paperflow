import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createZipArchive, type ZipEntry } from '@paperflow/cli/zip'
import YAML from 'yaml'
import { buildQuartoRenderMetadata, readProject as readExamProject } from '@paperflow/exam-markdown'
import { renderToDocxXml } from '@paperflow/render-docx'
import { renderItemToQti, renderTestToQti } from '@paperflow/render-qti'
import { renderToTypst, resolveTemplatePreset } from '@paperflow/render-typst'
import type { OutputMode } from '@paperflow/schema'
import { projectToLegacyPaper } from './compat'
import { createDocxBuffer } from './docx'
import { readProject } from './project'
import type { WorkspaceMode } from './types'

export type ReviewArtifact = {
  id: string
  label: string
  filename: string
  format: 'pdf' | 'docx' | 'json' | 'qti'
  mode: WorkspaceMode
  ready: boolean
  size: number
  pages?: number
  error?: string
}

function execFileAsync(file: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, { cwd, env, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function hasCommand(file: string, args = ['--version']) {
  return execFileAsync(file, args)
    .then(() => true)
    .catch(() => false)
}

async function compileTypstToPdf(source: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'paperflow-preview-'))
  const inputPath = path.join(dir, 'input.typ')
  const outputPath = path.join(dir, 'output.pdf')

  try {
    await writeFile(inputPath, source, 'utf-8')
    await execFileAsync('typst', ['compile', inputPath, outputPath])
    return await readFile(outputPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function zipDirectory(projectPath: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'paperflow-zip-'))
  const outputPath = path.join(dir, 'project.zip')

  try {
    await execFileAsync('zip', ['-qr', outputPath, '.'], projectPath)
    return await readFile(outputPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function shouldUseQuarto(mode: WorkspaceMode) {
  return mode !== 'answer_sheet'
}

async function readLegacyBundle(projectPath: string, mode: WorkspaceMode) {
  const snapshot = await readProject(projectPath)
  const legacy = projectToLegacyPaper(snapshot, mode)
  const templatePreset = snapshot.paper.paperflow.templatePreset || snapshot.paper.paperflow.template
  return { snapshot, legacy, templatePreset }
}

async function renderWithQuarto(
  projectPath: string,
  mode: 'student' | 'teacher' | 'solution_book',
  format: 'typst' | 'docx',
) {
  const project = await readExamProject(projectPath)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const metadataName = `.paperflow-quarto-${id}.yml`
  const outputName = `.paperflow-quarto-${id}.${format === 'docx' ? 'docx' : 'pdf'}`
  const inputName = path.basename(project.paperPath)
  const metadataPath = path.join(projectPath, metadataName)
  const outputPath = path.join(projectPath, outputName)
  const metadata = buildQuartoRenderMetadata(project, {
    mode,
    template: project.paper.frontMatter.paperflow?.template ?? 'school-default',
  })

  await writeFile(metadataPath, YAML.stringify(metadata), 'utf-8')
  try {
    await execFileAsync(
      'quarto',
      ['render', inputName, '--to', format, '--output', outputName, '--metadata-file', metadataName],
      projectPath,
      {
        ...process.env,
        PAPERFLOW_MODE: metadata.paperflow.mode,
        PAPERFLOW_SHOW_SCORE: String(metadata.paperflow.show_score),
        PAPERFLOW_SHOW_ANSWER: String(metadata.paperflow.show_answer),
        PAPERFLOW_SHOW_ANALYSIS: String(metadata.paperflow.show_analysis),
      },
    )
    return await readFile(outputPath)
  } finally {
    await rm(metadataPath, { force: true })
    await rm(outputPath, { force: true })
  }
}

export async function renderProjectTypst(projectPath: string, mode: WorkspaceMode) {
  const { legacy, templatePreset } = await readLegacyBundle(projectPath, mode)
  return renderToTypst(legacy.paper, legacy.items, {
    mode: mode as OutputMode,
    template: resolveTemplatePreset(templatePreset),
  })
}

export async function renderProjectPdf(projectPath: string, mode: WorkspaceMode) {
  if (shouldUseQuarto(mode) && await hasCommand('quarto')) {
    try {
      return await renderWithQuarto(projectPath, mode, 'typst')
    } catch {
      // Fall back to the legacy Typst path when Quarto is unavailable or misconfigured.
    }
  }
  return compileTypstToPdf(await renderProjectTypst(projectPath, mode))
}

export async function renderProjectDocx(projectPath: string, mode: WorkspaceMode) {
  if (shouldUseQuarto(mode) && await hasCommand('quarto')) {
    try {
      return await renderWithQuarto(projectPath, mode, 'docx')
    } catch {
      // Fall back to the minimal OOXML path when Quarto is unavailable or misconfigured.
    }
  }
  const snapshot = await readProject(projectPath)
  const legacy = projectToLegacyPaper(snapshot, mode)
  const documentXml = renderToDocxXml(legacy.paper, legacy.items, {
    mode: mode as OutputMode,
  })

  return createDocxBuffer(documentXml, legacy.paper.title)
}

export async function renderProjectJson(projectPath: string, mode: WorkspaceMode) {
  const { snapshot, legacy } = await readLegacyBundle(projectPath, mode)
  return Buffer.from(
    JSON.stringify(
      {
        projectPath,
        mode,
        paper: legacy.paper,
        items: legacy.items,
        summaries: legacy.summaries,
        source: {
          title: snapshot.paper.title,
          templatePreset: snapshot.paper.paperflow.templatePreset,
          templateFolder: snapshot.paper.paperflow.template,
        },
      },
      null,
      2,
    ),
    'utf-8',
  )
}

export async function renderProjectQti(projectPath: string, mode: WorkspaceMode) {
  const { legacy } = await readLegacyBundle(projectPath, mode)
  const dir = await mkdtemp(path.join(tmpdir(), 'paperflow-qti-'))
  const outputPath = path.join(dir, 'paperflow-qti.zip')

  try {
    await writeFile(path.join(dir, 'assessment-test.xml'), renderTestToQti(legacy.paper, legacy.items), 'utf-8')
    await Promise.all(
      legacy.items.map((item) =>
        writeFile(path.join(dir, `${item.id}.xml`), renderItemToQti(item), 'utf-8'),
      ),
    )
    await execFileAsync('zip', ['-qr', outputPath, '.'], dir)
    return await readFile(outputPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function renderProjectZip(projectPath: string) {
  return zipDirectory(projectPath)
}

function countPdfPages(buffer: Buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
}

const EXPORT_ARTIFACT_SPECS: Array<{
  id: string
  label: string
  filename: string
  format: ReviewArtifact['format']
  mode: WorkspaceMode
}> = [
  { id: 'student-pdf', label: '学生卷 PDF', filename: 'student.pdf', format: 'pdf', mode: 'student' },
  { id: 'teacher-pdf', label: '教师卷 PDF', filename: 'teacher.pdf', format: 'pdf', mode: 'teacher' },
  { id: 'answer-sheet-pdf', label: '答题卡 PDF', filename: 'answer-sheet.pdf', format: 'pdf', mode: 'answer_sheet' },
  { id: 'solution-book-pdf', label: '解析册 PDF', filename: 'solution-book.pdf', format: 'pdf', mode: 'solution_book' },
  { id: 'student-docx', label: 'DOCX 兼容版', filename: 'student.docx', format: 'docx', mode: 'student' },
  { id: 'student-json', label: 'JSON AST', filename: 'student.json', format: 'json', mode: 'student' },
  { id: 'student-qti', label: 'QTI 交换包', filename: 'student.qti.zip', format: 'qti', mode: 'student' },
]

async function renderArtifactBuffer(
  projectPath: string,
  format: ReviewArtifact['format'],
  mode: WorkspaceMode,
) {
  switch (format) {
    case 'pdf':
      return renderProjectPdf(projectPath, mode)
    case 'docx':
      return renderProjectDocx(projectPath, mode)
    case 'json':
      return renderProjectJson(projectPath, mode)
    case 'qti':
      return renderProjectQti(projectPath, mode)
  }
}

export async function collectReviewArtifacts(projectPath: string): Promise<ReviewArtifact[]> {
  return Promise.all(
    EXPORT_ARTIFACT_SPECS.map(async (spec) => {
      try {
        const buffer = await renderArtifactBuffer(projectPath, spec.format, spec.mode)
        return {
          ...spec,
          ready: true,
          size: buffer.length,
          pages: spec.format === 'pdf' ? countPdfPages(buffer) : undefined,
        } satisfies ReviewArtifact
      } catch (error) {
        return {
          ...spec,
          ready: false,
          size: 0,
          error: error instanceof Error ? error.message : 'Unknown artifact error',
        } satisfies ReviewArtifact
      }
    }),
  )
}

export async function renderProjectBundle(projectPath: string) {
  const entries: ZipEntry[] = []

  for (const spec of EXPORT_ARTIFACT_SPECS) {
    const buffer = await renderArtifactBuffer(projectPath, spec.format, spec.mode)
    entries.push({
      path: spec.filename,
      data: buffer,
    })
  }

  return createZipArchive(entries)
}

export async function exportPreviewArtifacts(projectPath: string) {
  const previewDir = path.join(projectPath, '.paperflow', 'preview')
  await mkdir(previewDir, { recursive: true })
  const [studentPdf, teacherPdf] = await Promise.all([
    renderProjectPdf(projectPath, 'student'),
    renderProjectPdf(projectPath, 'teacher'),
  ])

  await Promise.all([
    writeFile(path.join(previewDir, 'student.pdf'), studentPdf),
    writeFile(path.join(previewDir, 'teacher.pdf'), teacherPdf),
  ])
}
