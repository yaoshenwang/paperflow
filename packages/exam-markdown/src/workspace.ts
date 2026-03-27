import { mkdir, readdir, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  PaperFileSchema,
  ProjectScaffoldOptionsSchema,
  QuestionFileSchema,
  type PaperBodyNode,
  type PaperFile,
  type ProjectQuestionFile,
  type ProjectScaffoldOptions,
  type ReadProjectResult,
} from './types.js'
import { readPaperFile, writePaperFile } from './paper-file.js'
import { readQuestionFile, writeQuestionFile } from './question-file.js'

const PAPER_FILE_NAME = 'paper.qmd'
const TEMPLATE_VERSION = '0.1.0'

export async function readProject(rootDir: string): Promise<ReadProjectResult> {
  const normalizedRoot = resolve(rootDir)
  const paperPath = join(normalizedRoot, PAPER_FILE_NAME)
  const paper = await readPaperFile(paperPath)

  const questionPaths = uniqueStrings([
    ...paper.nodes
      .filter(
        (node: PaperBodyNode): node is Extract<PaperBodyNode, { type: 'question' }> =>
          node.type === 'question',
      )
      .map((node) => resolve(normalizedRoot, node.file)),
    ...(await discoverQuestionPaths(normalizedRoot)),
  ])

  const questionFiles: ProjectQuestionFile[] = []
  const questionFilesById: ReadProjectResult['questionFilesById'] = {}

  for (const filePath of questionPaths) {
    const file = await readQuestionFile(filePath)
    const id = file.frontMatter.id
    if (questionFilesById[id]) {
      throw new Error(`Duplicate question id: ${id}`)
    }

    const record = {
      path: relative(normalizedRoot, filePath),
      file,
    }
    questionFiles.push(record)
    questionFilesById[id] = record
  }

  return {
    rootDir: normalizedRoot,
    paperPath,
    paper,
    questionFiles,
    questionFilesById,
  }
}

export async function writeProjectPaper(
  rootDir: string,
  file: PaperFile,
): Promise<string> {
  const paperPath = join(resolve(rootDir), PAPER_FILE_NAME)
  await writePaperFile(paperPath, file)
  return paperPath
}

export async function createProjectScaffold(
  options: ProjectScaffoldOptions,
): Promise<ReadProjectResult> {
  const parsed = ProjectScaffoldOptionsSchema.parse(options)
  const rootDir = resolve(parsed.rootDir)
  const templateDir = join(rootDir, 'templates', parsed.template)

  await ensureProjectRoot(rootDir, parsed.overwrite)
  await mkdir(join(rootDir, 'questions'), { recursive: true })
  await mkdir(join(rootDir, 'assets'), { recursive: true })
  await mkdir(templateDir, { recursive: true })
  await mkdir(join(rootDir, '.paperflow', 'cache'), { recursive: true })
  await mkdir(join(rootDir, '.paperflow', 'preview'), { recursive: true })

  await writeFile(
    join(rootDir, '_quarto.yml'),
    buildProjectQuartoConfig(parsed.template),
    'utf-8',
  )
  await writeFile(join(rootDir, 'packs.lock'), 'packs: []\n', 'utf-8')
  await writeFile(
    join(rootDir, '.paperflow', 'README.md'),
    ['Runtime cache directory for local indices and previews.', ''].join('\n'),
    'utf-8',
  )
  await writeFile(join(rootDir, 'assets', '.gitkeep'), '', 'utf-8')
  await writeFile(join(rootDir, '.paperflow', 'cache', '.gitkeep'), '', 'utf-8')
  await writeFile(join(rootDir, '.paperflow', 'preview', '.gitkeep'), '', 'utf-8')

  await writeFile(
    join(templateDir, '_extension.yml'),
    buildTemplateExtensionManifest(parsed.template),
    'utf-8',
  )
  await writeFile(
    join(templateDir, 'template.typ'),
    buildTemplatePandocTemplate(),
    'utf-8',
  )
  await writeFile(
    join(templateDir, 'variables.yml'),
    buildTemplateVariables(parsed.template),
    'utf-8',
  )
  await writeFile(
    join(templateDir, 'question.lua'),
    buildQuestionShortcode(),
    'utf-8',
  )
  await writeFile(
    join(templateDir, 'typst-show.typ'),
    buildTemplateShowPartial(),
    'utf-8',
  )
  await writeFile(
    join(templateDir, 'typst-template.typ'),
    buildTemplateTypstPartial(),
    'utf-8',
  )

  const paper = buildScaffoldPaper(parsed)
  await writePaperFile(join(rootDir, PAPER_FILE_NAME), paper)

  if (parsed.includeSampleQuestions) {
    for (const sample of buildSampleQuestionFiles(parsed)) {
      await writeQuestionFile(join(rootDir, sample.path), sample.file)
    }
  }

  return readProject(rootDir)
}

async function discoverQuestionPaths(rootDir: string): Promise<string[]> {
  const questionsDir = join(rootDir, 'questions')
  try {
    const entries = await readdir(questionsDir, { withFileTypes: true })
    return entries
      .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry: Dirent) => join(questionsDir, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

function buildScaffoldPaper(options: ProjectScaffoldOptions): PaperFile {
  const showSolutions = options.outputMode === 'teacher' || options.outputMode === 'solution_book'
  const questionRefs = options.includeSampleQuestions
    ? [
        { file: 'questions/q-001.md', score: 5 },
        { file: 'questions/q-002.md', score: 5 },
        { file: 'questions/q-003.md', score: 20 },
      ]
    : []

  return PaperFileSchema.parse({
    frontMatter: {
      title: options.title,
      subject: options.subject,
      grade: options.grade,
      format: {
        typst: {
          'output-file': `${options.outputMode}.pdf`,
        },
      },
      paperflow: {
        mode: options.outputMode,
        template: options.template,
        template_preset: options.template,
        show_score: showSolutions,
        show_answer: showSolutions,
        show_analysis: showSolutions,
      },
    },
    nodes: [
      { type: 'heading', level: 2, title: '一、选择题' },
      ...questionRefs.map((ref) => ({ type: 'question' as const, ...ref })),
    ],
  })
}

function buildSampleQuestionFiles(
  options: ProjectScaffoldOptions,
): Array<ProjectQuestionFile> {
  const subject = options.subject
  const grade = options.grade

  return [
    {
      path: 'questions/q-001.md',
      file: QuestionFileSchema.parse({
        frontMatter: {
          id: 'q-001',
          type: 'single_choice',
          subject,
          grade,
          difficulty: 0.32,
          score_suggest: 5,
          knowledge: ['functions', 'monotonicity'],
          source: { label: '北京某区期中卷', year: 2024, region: '北京' },
          rights: 'school_owned',
          review: 'approved',
          tags: ['期中', '真题'],
          layout: { option_cols: 2 },
        },
        sections: [
          { name: 'stem', content: '已知函数 $f(x)=x^2-2x+1$，则下列结论正确的是：' },
          {
            name: 'options',
            content: [
              '- A. 最小值为 0',
              '- B. 最大值为 0',
              '- C. 图像开口向下',
              '- D. 对称轴为 $x=1$',
            ].join('\n'),
          },
          { name: 'answer', content: 'A、D' },
          { name: 'analysis', content: '$f(x)=(x-1)^2$，开口向上，最小值为 0，对称轴为 $x=1$。' },
        ],
      }),
    },
    {
      path: 'questions/q-002.md',
      file: QuestionFileSchema.parse({
        frontMatter: {
          id: 'q-002',
          type: 'fill_blank',
          subject,
          grade,
          difficulty: 0.46,
          score_suggest: 5,
          knowledge: ['trigonometry'],
          source: { label: '北京某校月考', year: 2023, region: '北京' },
          rights: 'school_owned',
          review: 'approved',
          tags: ['填空', '基础'],
        },
        sections: [
          { name: 'stem', content: '1/2 + 1/2 = □' },
          { name: 'answer', content: '1' },
          { name: 'analysis', content: '1/2 + 1/2 = 1。' },
        ],
      }),
    },
    {
      path: 'questions/q-003.md',
      file: QuestionFileSchema.parse({
        frontMatter: {
          id: 'q-003',
          type: 'computation',
          subject,
          grade,
          difficulty: 0.7,
          score_suggest: 20,
          knowledge: ['quadratic-functions', 'monotonicity'],
          source: { label: '北京某校月考', year: 2024, region: '北京' },
          rights: 'school_owned',
          review: 'approved',
          tags: ['解答题', '函数'],
          layout: { answer_area_size: 'l' },
        },
        sections: [
          {
            name: 'stem',
            content: [
              '已知函数 f(x)=x^2-2x+3。',
              '',
              '（1）求函数 $f(x)$ 的最小值；',
              '（2）判断 f(x) 在 [1,+∞) 上的单调性，并证明。',
            ].join('\n'),
          },
          {
            name: 'answer',
            content: [
              '（1）f(x)=(x-1)^2+2，最小值为 2。',
              '（2）f(x) 在 [1,+∞) 上单调递增。',
            ].join('\n'),
          },
          {
            name: 'analysis',
            content: [
              '配方法可得 f(x)=(x-1)^2+2，顶点为 (1,2)。',
              '对于单调性证明，取 x1 > x2 >= 1，则 f(x1) - f(x2) > 0。',
            ].join('\n'),
          },
        ],
      }),
    },
  ]
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))]
}

async function ensureProjectRoot(rootDir: string, overwrite: boolean): Promise<void> {
  try {
    const entries = await readdir(rootDir)
    if (entries.length > 0 && !overwrite) {
      throw new Error(`Project directory is not empty: ${rootDir}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    await mkdir(rootDir, { recursive: true })
  }
}

function buildProjectQuartoConfig(template: string): string {
  return [
    'project:',
    '  type: default',
    'metadata-files:',
    `  - templates/${template}/variables.yml`,
    'shortcodes:',
    `  - templates/${template}/question.lua`,
    'execute:',
    '  freeze: auto',
    '',
  ].join('\n')
}

function buildTemplateExtensionManifest(template: string): string {
  return [
    `title: ${template}`,
    'author: Paperflow',
    `version: ${TEMPLATE_VERSION}`,
    'quarto-required: ">=1.5.0"',
    'contributes:',
    '  shortcodes:',
    '    - question.lua',
    '  formats:',
    '    typst:',
    '      template: template.typ',
    '      template-partials:',
    '        - typst-template.typ',
    '        - typst-show.typ',
    '',
  ].join('\n')
}

function buildTemplateVariables(template: string): string {
  return [
    'papersize: a4',
    'format:',
    '  typst:',
    `    template: templates/${template}/template.typ`,
    '    template-partials:',
    `      - templates/${template}/typst-template.typ`,
    `      - templates/${template}/typst-show.typ`,
    '    margin:',
    '      x: 2.2cm',
    '      y: 2.4cm',
    '    fontsize: 11pt',
    '    linestretch: 1.45',
    '',
  ].join('\n')
}

function buildTemplatePandocTemplate(): string {
  return `\$numbering.typ()\$

\$definitions.typ()\$

\$typst-template.typ()\$

\$for(header-includes)\$
\$header-includes\$
\$endfor\$

\$page.typ()\$

\$typst-show.typ()\$

\$for(include-before)\$
\$include-before\$
\$endfor\$

\$body\$

\$notes.typ()\$

\$biblio.typ()\$

\$for(include-after)\$
\$include-after\$
\$endfor\$
`
}

function buildTemplateShowPartial(): string {
  return `#show: doc => paperflow_exam(
$if(title)$
  title: [$title$],
$endif$
$if(subject)$
  subject: [$subject$],
$endif$
$if(grade)$
  grade: [$grade$],
$endif$
$if(papersize)$
  paper: "$papersize$",
$endif$
$if(margin)$
  margin: ($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$),
$endif$
$if(fontsize)$
  fontsize: $fontsize$,
$endif$
$if(linestretch)$
  linestretch: $linestretch$,
$endif$
  pagenumbering: $if(page-numbering)$"$page-numbering$"$else$none$endif$,
  doc,
)
`
}

function buildTemplateTypstPartial(): string {
  return `#let paperflow_exam(
  title: none,
  subject: none,
  grade: none,
  margin: (x: 2.2cm, y: 2.4cm),
  paper: "a4",
  fontsize: 11pt,
  linestretch: 1.45,
  pagenumbering: none,
  doc,
) = {
  let meta-line = if subject != none and grade != none {
    [#subject · #grade]
  } else if subject != none {
    [#subject]
  } else if grade != none {
    [#grade]
  } else {
    none
  }

  set page(
    paper: paper,
    margin: margin,
    numbering: pagenumbering,
  )
  set text(size: fontsize)
  set par(
    justify: false,
    leading: linestretch * 0.7em,
  )
  set heading(numbering: none)

  show heading.where(level: 1): it => block(
    above: 1.2em,
    below: 0.7em,
    fill: luma(245),
    inset: (x: 0.75em, y: 0.45em),
    radius: 6pt,
  )[
    #text(weight: "bold")[#it.body]
  ]

  if title != none {
    align(center)[
      #block(below: 1.5em)[
        #text(weight: "bold", size: 1.55em)[#title]
        #if meta-line != none {
          parbreak()
          text(size: 0.95em, fill: luma(40%))[#meta-line]
        }
      ]
    ]
  }

  doc
}
`
}

function buildQuestionShortcode(): string {
  return `local question_counter = 0

local function stringify(value)
  if value == nil then
    return ""
  end
  return pandoc.utils.stringify(value)
end

local function read_file(path)
  local file = io.open(path, "rb")
  if not file then
    return nil
  end

  local content = file:read("*a")
  file:close()
  return content
end

local function meta_lookup(meta, group, key)
  if meta == nil then
    return nil
  end

  local value = meta[group]
  if value == nil then
    return nil
  end

  return value[key]
end

local function meta_bool(meta, group, key, default)
  local value = meta_lookup(meta, group, key)
  if value == nil then
    return default
  end
  if type(value) == "boolean" then
    return value
  end
  if value.t == "MetaBool" then
    return value.value
  end

  local text = stringify(value):lower()
  if text == "true" or text == "yes" or text == "1" then
    return true
  end
  if text == "false" or text == "no" or text == "0" then
    return false
  end
  return default
end

local function env_string(name)
  local value = os.getenv(name)
  if value == nil then
    return ""
  end
  return tostring(value)
end

local function env_bool(name)
  local value = env_string(name):lower()
  if value == "" then
    return nil
  end
  if value == "true" or value == "yes" or value == "1" then
    return true
  end
  if value == "false" or value == "no" or value == "0" then
    return false
  end
  return nil
end

local function format_score(score)
  if score == nil then
    return nil
  end
  if score == math.floor(score) then
    return tostring(math.floor(score))
  end
  return tostring(score)
end

local function resolve_question_path(path)
  if pandoc.path.is_absolute(path) then
    return pandoc.path.normalize(path)
  end

  local input_dir = pandoc.path.directory(quarto.doc.input_file)
  return pandoc.path.normalize(pandoc.path.join({ input_dir, path }))
end

local function clone_blocks(blocks)
  local output = {}
  for _, block in ipairs(blocks or {}) do
    output[#output + 1] = block
  end
  return output
end

local function find_section_class(div)
  if div.t ~= "Div" then
    return nil
  end

  for _, class in ipairs(div.attr.classes or {}) do
    if class == "stem" or class == "options" or class == "answer" or class == "analysis" then
      return class
    end
  end

  return nil
end

local function parse_question_sections(doc)
  local sections = {}
  local found_named_sections = false

  for _, block in ipairs(doc.blocks) do
    local class = find_section_class(block)
    if class ~= nil then
      sections[class] = clone_blocks(block.content)
      found_named_sections = true
    end
  end

  if not found_named_sections then
    sections.stem = clone_blocks(doc.blocks)
  end

  return sections, doc.meta or {}
end

local function label_inlines(index, score, show_score)
  local inlines = {
    pandoc.Strong({ pandoc.Str(tostring(index) .. ".") }),
  }

  if show_score and score ~= nil then
    inlines[#inlines + 1] = pandoc.Space()
    inlines[#inlines + 1] = pandoc.Emph({ pandoc.Str("（" .. format_score(score) .. " 分）") })
  end

  inlines[#inlines + 1] = pandoc.Space()
  return inlines
end

local function prepend_label(blocks, index, score, show_score)
  local output = clone_blocks(blocks)
  local prefix = label_inlines(index, score, show_score)
  local first = output[1]

  if first ~= nil and (first.t == "Para" or first.t == "Plain") then
    local merged = {}
    for _, inline in ipairs(prefix) do
      merged[#merged + 1] = inline
    end
    for _, inline in ipairs(first.content) do
      merged[#merged + 1] = inline
    end

    if first.t == "Para" then
      output[1] = pandoc.Para(merged)
    else
      output[1] = pandoc.Plain(merged)
    end

    return output
  end

  local labeled = { pandoc.Para(prefix) }
  for _, block in ipairs(output) do
    labeled[#labeled + 1] = block
  end
  return labeled
end

local function append_blocks(target, blocks)
  for _, block in ipairs(blocks or {}) do
    target[#target + 1] = block
  end
end

local function append_labeled_section(target, label, blocks)
  if blocks == nil or #blocks == 0 then
    return
  end

  target[#target + 1] = pandoc.Para({ pandoc.Strong({ pandoc.Str(label) }) })
  append_blocks(target, blocks)
end

local function question_shortcode(args, kwargs, meta, _raw_args, context)
  if context ~= "block" then
    return quarto.shortcode.error_output("question", "question shortcode must be used in block context", context)
  end

  local file = stringify(kwargs["file"] or kwargs["path"] or args[1])
  if file == "" then
    return quarto.shortcode.error_output("question", "missing file argument", context)
  end

  local score_text = stringify(kwargs["score"] or args[2])
  local score = tonumber(score_text)
  local source = read_file(resolve_question_path(file))
  if source == nil then
    return quarto.shortcode.error_output("question", "unable to read question file: " .. file, context)
  end

  local ok, doc = pcall(
    pandoc.read,
    source,
    "markdown+yaml_metadata_block+fenced_divs+raw_attribute+tex_math_dollars"
  )
  if not ok then
    return quarto.shortcode.error_output("question", "unable to parse question file: " .. file, context)
  end

  local sections, question_meta = parse_question_sections(doc)
  local mode = env_string("PAPERFLOW_MODE")
  if mode == "" then
    mode = stringify(meta_lookup(meta, "paperflow", "mode"))
  end

  local show_score = env_bool("PAPERFLOW_SHOW_SCORE")
  if show_score == nil then
    show_score = meta_bool(meta, "paperflow", "show_score", mode == "teacher")
  end

  local show_answer = env_bool("PAPERFLOW_SHOW_ANSWER")
  if show_answer == nil then
    show_answer = meta_bool(meta, "paperflow", "show_answer", mode == "teacher")
  end

  local show_analysis = env_bool("PAPERFLOW_SHOW_ANALYSIS")
  if show_analysis == nil then
    show_analysis = meta_bool(meta, "paperflow", "show_analysis", mode == "teacher")
  end

  question_counter = question_counter + 1

  local blocks = prepend_label(sections.stem or {}, question_counter, score, show_score)
  append_blocks(blocks, sections.options)

  if show_answer then
    append_labeled_section(blocks, "答案", sections.answer)
  end
  if show_analysis then
    append_labeled_section(blocks, "解析", sections.analysis)
  end

  local identifier = stringify(question_meta.id)
  return {
    pandoc.Div(blocks, pandoc.Attr(identifier, { "paperflow-question" }, {
      ["data-question-file"] = file,
    })),
  }
end

return {
  ["question"] = question_shortcode,
}
`
}
