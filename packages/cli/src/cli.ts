#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, writeFile, cp, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import YAML from 'yaml'
import {
  buildQuartoRenderMetadata,
  createProjectScaffold,
  lintProject,
  readProject,
  type QuestionFile,
  type ReadProjectResult,
} from '@paperflow/exam-markdown'
import { renderToDocxXml } from '@paperflow/render-docx'
import { renderItemToQti, renderTestToQti } from '@paperflow/render-qti'
import { renderToTypst, resolveTemplatePreset } from '@paperflow/render-typst'
import type { Block, OutputMode, PaperProject, QuestionItem } from '@paperflow/schema'
import { PaperProjectSchema, QuestionItemSchema } from '@paperflow/schema'
import { probeCapabilities } from './capabilities.js'
import {
  buildPackArchive,
  installPackArchive,
  loadPackInstallSource,
  readPackDirectoryManifest,
  readPacksLock,
  resolvePackBuildOutput,
  writePacksLock,
} from './pack-artifacts.js'

type Command = 'init' | 'render' | 'lint' | 'pack' | '--help' | '-h'

type ParsedArgs = {
  _: string[]
  options: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('-')) {
      positional.push(arg)
      continue
    }

    const key = arg.replace(/^--?/, '')
    const next = argv[index + 1]
    if (next && !next.startsWith('-')) {
      options[key] = next
      index += 1
    } else {
      options[key] = true
    }
  }

  return { _: positional, options }
}

function getOption(args: ParsedArgs, key: string, fallback?: string): string {
  const value = args.options[key]
  if (typeof value === 'string') return value
  return fallback ?? ''
}

function getBooleanOption(args: ParsedArgs, key: string, fallback = false): boolean {
  const value = args.options[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value !== 'false'
  return fallback
}

function printUsage(): void {
  process.stdout.write([
    'Paperflow CLI',
    '',
    'Usage:',
    '  paperflow init [dir]',
    '  paperflow render [dir] [--format pdf|typst|docx|json|qti] [--mode student|teacher|answer_sheet|solution_book] [--out path]',
    '  paperflow lint [dir] [--json]',
    '  paperflow pack build [packDir] [--out dir|file.zip]',
    '  paperflow pack install [pack.zip|packDir] [--project dir]',
    '',
  ].join('\n'))
}

function log(message: string): void {
  process.stdout.write(`${message}\n`)
}

function error(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function resolveProjectDir(arg?: string): string {
  return resolve(arg ?? process.cwd())
}

function inlineNodesFromText(text: string): Block[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  return normalized
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\$\$[\s\S]*\$\$$/.test(part)) {
        return { type: 'math_block', typst: part.slice(2, -2).trim() } as const
      }

      if (/^```/.test(part)) {
        const lines = part.split('\n')
        const language = lines[0]?.replace(/^```/, '').trim() || undefined
        const code = lines.slice(1, -1).join('\n')
        return { type: 'code', language, code } as const
      }

      const children = part
        .replace(/\n+/g, ' ')
        .split(/(\$[^$\n]+\$)/g)
        .filter((chunk) => chunk.length > 0)
        .map((chunk) =>
          chunk.startsWith('$') && chunk.endsWith('$')
            ? ({ type: 'math_inline', typst: chunk.slice(1, -1) } as const)
            : ({ type: 'text', text: chunk } as const),
        )

      return { type: 'paragraph', children } as const
    })
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return block.children.map((child) => (child.type === 'text' ? child.text : `$${child.typst}$`)).join('')
        case 'math_block':
          return `$$\n${block.typst}\n$$`
        case 'image':
          return `![${block.alt ?? ''}](${block.src})`
        case 'table':
          return '[table]'
        case 'code':
          return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
      }
    })
    .join('\n\n')
}

function optionsFromText(text: string): QuestionItem['content']['options'] {
  const options = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line, index) => {
      const item = line.slice(2).trim()
      const match = item.match(/^([A-Z])[\.\s]+(.+)$/)
      const label = match?.[1] ?? String.fromCharCode(65 + index)
      const contentText = match?.[2] ?? item
      return {
        label,
        content: inlineNodesFromText(contentText),
      }
    })

  return options.length > 0 ? options : undefined
}

function questionFileToItem(file: QuestionFile): QuestionItem {
  const frontMatter = file.frontMatter
  const source = frontMatter.source ?? {}
  const stem = file.sections.find((section) => section.name === 'stem')?.content ?? ''
  const options = file.sections.find((section) => section.name === 'options')?.content
  const answer = file.sections.find((section) => section.name === 'answer')?.content ?? ''
  const analysis = file.sections.find((section) => section.name === 'analysis')?.content ?? ''

  return QuestionItemSchema.parse({
    id: frontMatter.id,
    canonicalId: frontMatter.canonical_id ?? frontMatter.id,
    sourceDocumentId: frontMatter.source_document_id ?? `${frontMatter.id}-source`,
    sourceLocator: { page: 1 },
    taxonomy: {
      subject: frontMatter.subject,
      grade: frontMatter.grade,
      textbookVersion: undefined,
      knowledgeIds: frontMatter.knowledge ?? [],
      abilityTags: [],
      questionType: frontMatter.type,
      difficulty: frontMatter.difficulty,
    },
    content: {
      stem: inlineNodesFromText(stem),
      options: options ? optionsFromText(options) : undefined,
      subquestions: undefined,
      answer: inlineNodesFromText(answer),
      analysis: inlineNodesFromText(analysis),
      assets: [],
    },
    provenance: {
      examName: source.exam ?? undefined,
      region: source.region ?? undefined,
      school: source.school ?? undefined,
      year: source.year ?? undefined,
      sourceLabel: source.label ?? frontMatter.id,
    },
    quality: {
      reviewStatus: frontMatter.review ?? 'draft',
      answerVerified: false,
    },
    rightsStatus: frontMatter.rights ?? 'school_owned',
  })
}

function deriveBlueprint(
  project: ReadProjectResult,
  itemsById: Map<string, QuestionItem>,
  clips: PaperProject['clips'],
): PaperProject['blueprint'] {
  const grouped = new Map<QuestionItem['taxonomy']['questionType'], { count: number; scoreTotal: number }>()
  const knowledge = new Set<string>()
  const buckets = { easy: 0, medium: 0, hard: 0 }

  clips.forEach((clip) => {
    const item = itemsById.get(clip.questionItemId)
    const questionType = item?.taxonomy.questionType ?? 'essay'
    const current = grouped.get(questionType) ?? { count: 0, scoreTotal: 0 }
    current.count += 1
    current.scoreTotal += clip.score
    grouped.set(questionType, current)
    item?.taxonomy.knowledgeIds.forEach((entry) => knowledge.add(entry))
    const difficulty = item?.taxonomy.difficulty
    if (difficulty == null) return
    if (difficulty <= 0.4) buckets.easy += 1
    else if (difficulty <= 0.7) buckets.medium += 1
    else buckets.hard += 1
  })

  const totalDifficulty = buckets.easy + buckets.medium + buckets.hard
  return {
    subject: project.paper.frontMatter.subject ?? itemsById.values().next().value?.taxonomy.subject ?? 'unknown',
    grade: project.paper.frontMatter.grade ?? itemsById.values().next().value?.taxonomy.grade ?? 'unknown',
    totalScore: clips.reduce((sum, clip) => sum + clip.score, 0),
    sections: Array.from(grouped.entries()).map(([questionType, stats]) => ({
      questionType,
      count: stats.count,
      scorePerItem: stats.count > 0 ? Number((stats.scoreTotal / stats.count).toFixed(2)) : 0,
    })),
    ...(knowledge.size > 0 ? { knowledgeCoverage: Array.from(knowledge) } : {}),
    ...(totalDifficulty > 0
      ? {
          difficultyDistribution: {
            easy: Number((buckets.easy / totalDifficulty).toFixed(3)),
            medium: Number((buckets.medium / totalDifficulty).toFixed(3)),
            hard: Number((buckets.hard / totalDifficulty).toFixed(3)),
          },
        }
      : {}),
  }
}

function ensureBlueprint(paper: PaperProject, items: QuestionItem[]) {
  if (paper.blueprint.sections.length > 0) {
    return paper
  }

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const derived = deriveBlueprint(
    {
      rootDir: '',
      paperPath: '',
      paper: {
        frontMatter: {
          title: paper.title,
          subject: paper.blueprint.subject,
          grade: paper.blueprint.grade,
          paperflow: {},
        },
        nodes: [],
      },
      questionFiles: [],
      questionFilesById: {},
    },
    itemsById,
    paper.clips,
  )

  return {
    ...paper,
    blueprint: {
      ...paper.blueprint,
      ...derived,
    },
  }
}

function projectToRenderBundle(project: ReadProjectResult): { paper: PaperProject; items: QuestionItem[] } {
  const itemsByRelativePath = new Map<string, QuestionItem>()
  const itemsById = new Map<string, QuestionItem>()
  for (const question of project.questionFiles) {
    const item = questionFileToItem(question.file)
    itemsByRelativePath.set(question.path.replaceAll('\\', '/'), item)
    itemsByRelativePath.set(question.path.replace(/^\.\//, ''), item)
    itemsById.set(item.id, item)
  }

  const sections: PaperProject['sections'] = []
  const clips: PaperProject['clips'] = []
  let currentSectionId = 'section-1'
  let sectionIndex = -1

  for (const node of project.paper.nodes) {
    if (node.type === 'heading') {
      sectionIndex += 1
      currentSectionId = `section-${sectionIndex + 1}-${node.title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
        .replace(/^-+|-+$/g, '')}`
      sections.push({
        id: currentSectionId,
        title: node.title,
        order: sectionIndex,
      })
      continue
    }

    if (node.type !== 'question') continue

    const relPath = node.file.replace(/^\.\//, '')
    const fallbackId = relPath.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
    const item = itemsByRelativePath.get(relPath) ?? itemsById.get(fallbackId)
    if (!item) {
      throw new Error(`Missing referenced question file: ${node.file}`)
    }

    clips.push({
      id: `clip-${clips.length + 1}`,
      questionItemId: item.id,
      sectionId: currentSectionId,
      order: clips.filter((clip) => clip.sectionId === currentSectionId).length,
      score: node.score ?? 0,
      locked: false,
      hiddenParts: [],
      altItemIds: [],
      layoutHints: {
        keepWithNext: node.attrs?.keep_with_next === 'true',
        forcePageBreakBefore: node.attrs?.force_page_break_before === 'true',
        answerAreaSize: node.attrs?.answer_area_size as 's' | 'm' | 'l' | undefined,
      },
    })
  }

  if (sections.length === 0) {
    sections.push({ id: 'section-1', title: '未命名分区', order: 0 })
  }

  const paperflow = project.paper.frontMatter.paperflow ?? {}
  const blueprint = (paperflow.blueprint && typeof paperflow.blueprint === 'object'
    ? paperflow.blueprint
    : deriveBlueprint(project, itemsById, clips)) as PaperProject['blueprint']
  const paper = PaperProjectSchema.parse({
    id: project.paper.frontMatter.title.toLowerCase().replace(/\s+/g, '-'),
    orgId: 'local',
    title: project.paper.frontMatter.title,
    blueprint,
    sections,
    clips,
    templatePreset: paperflow.template ?? 'default',
    outputModes: [paperflow.mode === 'teacher' ? 'teacher' : 'student'],
    version: 1,
    status: 'draft',
  })

  return { paper: ensureBlueprint(paper, [...itemsByRelativePath.values()]), items: [...itemsByRelativePath.values()] }
}

async function compileTypstToPdf(source: string, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  const tempDir = join(dirname(outputPath), `.paperflow-${Date.now()}`)
  const inputPath = join(tempDir, 'input.typ')
  await mkdir(tempDir, { recursive: true })
  await writeFile(inputPath, source, 'utf8')

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn('typst', ['compile', inputPath, outputPath], { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`typst compile failed with exit code ${code ?? 'unknown'}`))
    })
    child.on('error', rejectPromise)
  })

  await rm(tempDir, { recursive: true, force: true })
}

async function renderWithQuarto(
  projectDir: string,
  project: ReadProjectResult,
  mode: 'student' | 'teacher' | 'solution_book',
  format: 'typst' | 'docx',
  template: string,
  outputPath: string,
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const metadataName = `.paperflow-quarto-${id}.yml`
  const renderedName = `.paperflow-quarto-${id}.${format === 'docx' ? 'docx' : 'pdf'}`
  const inputName = basename(project.paperPath)
  const metadataPath = join(projectDir, metadataName)
  const renderedPath = join(projectDir, renderedName)
  const metadata = buildQuartoRenderMetadata(project, { mode, template })
  await writeFile(metadataPath, YAML.stringify(metadata), 'utf8')
  const paperflow = metadata.paperflow

  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(
        'quarto',
        ['render', inputName, '--to', format, '--output', renderedName, '--metadata-file', metadataName],
        {
          cwd: projectDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            PAPERFLOW_MODE: paperflow.mode,
            PAPERFLOW_SHOW_SCORE: String(paperflow.show_score),
            PAPERFLOW_SHOW_ANSWER: String(paperflow.show_answer),
            PAPERFLOW_SHOW_ANALYSIS: String(paperflow.show_analysis),
          },
        },
      )
      child.on('exit', (code) => {
        if (code === 0) resolvePromise()
        else rejectPromise(new Error(`quarto render failed with exit code ${code ?? 'unknown'}`))
      })
      child.on('error', rejectPromise)
    })
    await mkdir(dirname(outputPath), { recursive: true })
    await cp(renderedPath, outputPath)
  } finally {
    await rm(metadataPath, { force: true })
    await rm(renderedPath, { force: true })
  }
}

function shouldUseQuarto(mode: OutputMode) {
  return mode !== 'answer_sheet'
}

async function createQtiPackage(outputPath: string, paper: PaperProject, items: QuestionItem[]) {
  const tempDir = join(dirname(outputPath), `.paperflow-qti-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  try {
    await rm(outputPath, { force: true })
    await writeFile(join(tempDir, 'assessment-test.xml'), renderTestToQti(paper, items), 'utf8')
    await Promise.all(
      items.map((item) => writeFile(join(tempDir, `${item.id}.xml`), renderItemToQti(item), 'utf8')),
    )
    await mkdir(dirname(outputPath), { recursive: true })
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn('zip', ['-qr', outputPath, '.'], { cwd: tempDir, stdio: 'inherit' })
      child.on('exit', (code) => {
        if (code === 0) resolvePromise()
        else rejectPromise(new Error(`zip failed with exit code ${code ?? 'unknown'}`))
      })
      child.on('error', rejectPromise)
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function createDocx(outputPath: string, documentXml: string, title: string): Promise<void> {
  const tempDir = join(dirname(outputPath), `.paperflow-docx-${Date.now()}`)
  const contentDir = join(tempDir, 'word')
  const relsDir = join(tempDir, '_rels')
  const wordRelsDir = join(contentDir, '_rels')
  const docPropsDir = join(tempDir, 'docProps')
  const now = new Date().toISOString()

  await mkdir(contentDir, { recursive: true })
  await mkdir(relsDir, { recursive: true })
  await mkdir(wordRelsDir, { recursive: true })
  await mkdir(docPropsDir, { recursive: true })

  try {
    await Promise.all([
      writeFile(
        join(tempDir, '[Content_Types].xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
        'utf8',
      ),
      writeFile(
        join(relsDir, '.rels'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
        'utf8',
      ),
      writeFile(
        join(wordRelsDir, 'document.xml.rels'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
        'utf8',
      ),
      writeFile(join(contentDir, 'document.xml'), documentXml, 'utf8'),
      writeFile(
        join(contentDir, 'styles.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`,
        'utf8',
      ),
      writeFile(
        join(docPropsDir, 'core.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>Paperflow</dc:creator>
  <cp:lastModifiedBy>Paperflow</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`,
        'utf8',
      ),
      writeFile(
        join(docPropsDir, 'app.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Paperflow</Application>
</Properties>`,
        'utf8',
      ),
    ])

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn('zip', ['-qr', outputPath, '.'], { cwd: tempDir, stdio: 'inherit' })
      child.on('exit', (code) => {
        if (code === 0) resolvePromise()
        else rejectPromise(new Error(`zip failed with exit code ${code ?? 'unknown'}`))
      })
      child.on('error', rejectPromise)
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function runInit(argv: string[]): Promise<void> {
  const args = parseArgs(argv)
  const dir = resolveProjectDir(args._[0])
  await createProjectScaffold({
    rootDir: dir,
    title: getOption(args, 'title', '未命名试卷'),
    subject: getOption(args, 'subject', 'unknown'),
    grade: getOption(args, 'grade', 'unknown'),
    template: getOption(args, 'template', 'school-default'),
    outputMode: getOption(args, 'mode', 'student') as never,
    includeSampleQuestions: getBooleanOption(args, 'sample', true),
    overwrite: true,
  })
  log(`Initialized Paperflow project at ${dir}`)
}

async function runRender(argv: string[]): Promise<void> {
  const args = parseArgs(argv)
  const projectDir = resolveProjectDir(args._[0])
  const outputPath = resolve(getOption(args, 'out', join(projectDir, 'out', 'paper.pdf')))
  const format = getOption(args, 'format', outputPath.endsWith('.typ') ? 'typst' : outputPath.endsWith('.docx') ? 'docx' : 'pdf')
  const mode = getOption(args, 'mode', 'student') as OutputMode
  const capabilities = probeCapabilities()
  const project = await readProject(projectDir)
  const templatePreset = getOption(args, 'template', project.paper.frontMatter.paperflow?.template ?? 'school-default')
  const bundle = projectToRenderBundle(project)
  const typstSource = renderToTypst(bundle.paper, bundle.items, {
    mode,
    template: resolveTemplatePreset(templatePreset),
  })

  if (format === 'json') {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          paper: bundle.paper,
          items: bundle.items,
        },
        null,
        2,
      ),
      'utf8',
    )
    log(`Wrote JSON AST to ${outputPath}`)
    return
  }

  if (format === 'qti') {
    await createQtiPackage(outputPath, bundle.paper, bundle.items)
    log(`Rendered QTI package to ${outputPath}`)
    return
  }

  if (format === 'typst') {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, typstSource, 'utf8')
    log(`Wrote Typst source to ${outputPath}`)
    return
  }

  if (format === 'docx') {
    if (shouldUseQuarto(mode) && capabilities.quarto) {
      try {
        await mkdir(dirname(outputPath), { recursive: true })
        await renderWithQuarto(
          projectDir,
          project,
          mode,
          'docx',
          templatePreset,
          outputPath,
        )
        log(`Rendered DOCX via Quarto to ${outputPath}`)
        return
      } catch (error) {
        log(`Quarto DOCX render failed, falling back to built-in DOCX path: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
    const documentXml = renderToDocxXml(bundle.paper, bundle.items, { mode })
    await mkdir(dirname(outputPath), { recursive: true })
    await createDocx(outputPath, documentXml, bundle.paper.title)
    log(`Rendered DOCX to ${outputPath}`)
    return
  }

  if (!capabilities.typst) {
    error('Typst is not available on PATH.')
  }

  if (shouldUseQuarto(mode) && capabilities.quarto) {
    try {
      await mkdir(dirname(outputPath), { recursive: true })
      await renderWithQuarto(
        projectDir,
        project,
        mode,
        'typst',
        templatePreset,
        outputPath,
      )
      log(`Rendered PDF via Quarto to ${outputPath}`)
      return
    } catch (error) {
      log(`Quarto PDF render failed, falling back to Typst CLI: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  await compileTypstToPdf(typstSource, outputPath)
  log(`Rendered PDF to ${outputPath}`)
}

function lintStatusSymbol(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'PASS'
    case 'warn':
      return 'WARN'
    case 'fail':
      return 'FAIL'
  }
}

async function runLint(argv: string[]): Promise<void> {
  const args = parseArgs(argv)
  const projectDir = resolveProjectDir(args._[0])
  try {
    const result = await lintProject(projectDir)
    if (getBooleanOption(args, 'json')) {
      log(JSON.stringify(result, null, 2))
    } else {
      log(`Lint report for ${projectDir}`)
      for (const check of result.checks) {
        log(`[${lintStatusSymbol(check.status)}] ${check.name}: ${check.detail}`)
      }
      log(
        `Summary: ${result.summary.pass} pass, ${result.summary.warn} warn, ${result.summary.fail} fail, publishable=${result.summary.publishable}`,
      )
    }
    if (result.summary.fail > 0) {
      process.exit(1)
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Paperflow lint failed'}\n`)
    process.exit(1)
  }
}

async function runPack(argv: string[]): Promise<void> {
  const args = parseArgs(argv)
  const subcommand = args._[0]
  const target = args._[1]

  if (subcommand === 'build') {
    const packDir = resolveProjectDir(target)
    const manifest = await readPackDirectoryManifest(packDir)
    const outputPath = resolvePackBuildOutput(packDir, manifest, getOption(args, 'out') || undefined)
    await rm(outputPath, { force: true })
    const built = await buildPackArchive(packDir, outputPath)
    log(`Built pack ${built.manifest.pack.id}@${built.manifest.pack.version} -> ${built.outputPath}`)
    return
  }

  if (subcommand === 'install') {
    if (!target) {
      error('Missing pack archive path or pack directory')
    }
    const projectDir = resolveProjectDir(getOption(args, 'project', process.cwd()))
    const lockFile = join(projectDir, 'packs.lock')
    const source = await loadPackInstallSource(target)
    try {
      const nextEntry = await installPackArchive(source, projectDir)
      const current = await readPacksLock(lockFile)
      const next = {
        lock_version: 1 as const,
        packs: current.packs.filter((item) => item.id !== nextEntry.id).concat(nextEntry),
      }
      await writePacksLock(lockFile, next)
      log(`Installed pack ${nextEntry.id}@${nextEntry.version} into ${join(projectDir, nextEntry.install_dir)}`)
    } finally {
      await source.cleanup?.()
    }
    return
  }

  printUsage()
  process.exit(1)
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  switch (command as Command | undefined) {
    case 'init':
      await runInit(rest)
      return
    case 'render':
      await runRender(rest)
      return
    case 'lint':
      await runLint(rest)
      return
    case 'pack':
      await runPack(rest)
      return
    case undefined:
    case '--help':
    case '-h':
      printUsage()
      return
    default:
      error(`Unknown command: ${command}`)
  }
}

void main(process.argv.slice(2)).catch((err: unknown) => {
  error(err instanceof Error ? err.message : 'Paperflow CLI failed')
})
