/**
 * 端到端验证脚本：
 * 1. 读取 demo-paper.json
 * 2. 用 render-typst 生成三种模式的 Typst 源码
 * 3. 调用 typst compile 生成 PDF
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToTypst } from '../../packages/render-typst/dist/index.js'
import type { PaperProject, QuestionItem, OutputMode } from '../../packages/schema/dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function compileTypstFile(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('typst', ['compile', inputPath, outputPath], (error, _stdout, stderr) => {
      if (error) reject(new Error(`Typst compile failed: ${stderr || error.message}`))
      else resolve()
    })
  })
}

async function main() {
  // 读取示例数据
  const raw = await readFile(join(__dirname, 'demo-paper.json'), 'utf-8')
  const { paper, items } = JSON.parse(raw) as { paper: PaperProject; items: QuestionItem[] }

  const outDir = join(__dirname, 'output')
  await mkdir(outDir, { recursive: true })

  const modes: OutputMode[] = ['student', 'teacher', 'answer_sheet']

  for (const mode of modes) {
    console.log(`\n=== Rendering: ${mode} ===`)

    // AST → Typst 源码
    const typstSource = renderToTypst(paper, items, { mode })
    const typFile = join(outDir, `${mode}.typ`)
    const pdfFile = join(outDir, `${mode}.pdf`)

    await writeFile(typFile, typstSource, 'utf-8')
    console.log(`  Typst source written: ${typFile}`)

    // Typst → PDF
    await compileTypstFile(typFile, pdfFile)
    console.log(`  PDF generated: ${pdfFile}`)
  }

  console.log('\n✅ All 3 modes rendered successfully!')
}

main().catch((err) => {
  console.error('❌ E2E render failed:', err)
  process.exit(1)
})
