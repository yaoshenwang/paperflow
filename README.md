# Paperflow

Paperflow is a file-first exam workspace built around Quarto.

A project is a normal folder:

```text
my-exam/
  _quarto.yml
  paper.qmd
  questions/
    q-001.md
  assets/
  templates/
    school-default/
      _extension.yml
      question.lua
      template.typ
  packs.lock
  .paperflow/
```

The source of truth is:
- `paper.qmd` for paper structure and question references
- `questions/*.md` for individual questions
- local template files for layout and shortcode behavior

## Requirements

- Node.js 20+
- `pnpm`
- `quarto`
- `pandoc`

`typst` is optional now. When Quarto is available, PDF and DOCX export go through Quarto/Pandoc first.

## Quick Start

Install dependencies:

```bash
pnpm install
```

Initialize a new project:

```bash
pnpm --filter @paperflow/cli run build
pnpm paperflow init ~/Documents/my-exam --title "高一数学期中测试" --subject 数学 --grade 高一
```

Render exports:

```bash
pnpm paperflow render ~/Documents/my-exam --out ~/Documents/my-exam/out/paper.pdf
pnpm paperflow render ~/Documents/my-exam --format docx --mode teacher --out ~/Documents/my-exam/out/paper-teacher.docx
pnpm paperflow lint ~/Documents/my-exam
```

Run the web app:

```bash
cd apps/web
cp .env.example .env.local
pnpm dev
```

Main routes:
- `/`
- `/new`
- `/editor`
- `/questions/[id]`
- `/export`

## Question Packs

Build a distributable question pack:

```bash
pnpm paperflow pack build /path/to/algebra-pack --out /path/to/dist
```

Install a pack into a project:

```bash
pnpm paperflow pack install /path/to/dist/algebra-pack-0.1.0.paperflow-pack.zip --project ~/Documents/my-exam
```

## Repository Map

```text
apps/
  web/             Next.js file-workspace UI + APIs
  compile-typst/   Typst compile helper

packages/
  cli/             `paperflow` CLI
  exam-markdown/   File-first project reader/writer/lint/quarto helpers
  schema/          Legacy structured schemas used by fallback renderers
  render-typst/    Legacy Typst fallback renderer
  render-docx/     Legacy DOCX fallback renderer
  render-qti/      QTI renderer

examples/
  demo-project/    Quarto-style demo workspace
  sample-papers/   Legacy sample data
```

## Status

Current main path is single-user, local-first, and Quarto-first.

Legacy auth/organization/database code still exists in the repo, but it is no longer the primary workflow.
