# Paperflow

Paperflow is an open-source, AI-native paper composition workspace.

It treats:
- question items as source material
- a paper as a structured workspace
- Typst as the layout engine
- AI as an auditable assistant, not the source of truth

The current repository already includes:
- a running Next.js Studio at `apps/web`
- core schema packages in `packages/schema`
- Typst / DOCX XML / QTI renderers
- demo sample data in `examples/sample-papers/demo-paper.json`
- a lightweight import flow for demo data and JSON bundles

## Quick Start

Requirements:
- `pnpm`
- PostgreSQL
- `typst` CLI available in `PATH`

Install dependencies:

```bash
pnpm install
```

Start the web app:

```bash
cd apps/web
cp .env.example .env.local
pnpm dev
```

Open:
- `http://localhost:3000/`
- `http://localhost:3000/studio`
- `http://localhost:3000/review`

## First Demo

1. Open `/studio`.
2. In the left panel, click `导入示例数据`.
3. Switch template presets and preview mode.
4. Export student paper PDF, teacher paper PDF, answer sheet PDF, QTI XML, or JSON AST.

You can also paste a JSON bundle with the same shape as:
- `examples/sample-papers/demo-paper.json`

## Repository Map

```text
apps/
  web/             Next.js Studio + APIs
  compile-typst/   Typst compile service

packages/
  schema/          Canonical paper/question/source schemas
  render-typst/    AST -> Typst
  render-docx/     AST -> DOCX XML
  render-qti/      AST -> QTI XML

examples/
  sample-papers/   Demo paper, output samples, end-to-end render script

docs/
  PRD.md
  ARCHITECTURE.md
```

## Current Product Focus

For the open-source early stage, the most important things are:
- demoability
- importability
- stable paper rendering
- structured export

This repository is intentionally prioritizing:
- schema
- Studio workflow
- Typst templates
- import/export tooling

over heavier enterprise workflows such as deep org management or full moderation systems.
