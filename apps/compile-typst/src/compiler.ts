import { execFile } from 'node:child_process'
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'

export interface CompileResult {
  pdf: Buffer
}

/**
 * 编译 Typst 源码为 PDF。
 * 写入临时文件 → 调用 typst compile → 读取 PDF → 清理临时文件。
 */
export async function compileTypst(source: string): Promise<CompileResult> {
  const id = randomUUID()
  const dir = join(tmpdir(), `paperflow-${id}`)
  await mkdir(dir, { recursive: true })

  const inputPath = join(dir, 'input.typ')
  const outputPath = join(dir, 'output.pdf')

  try {
    await writeFile(inputPath, source, 'utf-8')

    await new Promise<void>((resolve, reject) => {
      execFile('typst', ['compile', inputPath, outputPath], (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`Typst compilation failed: ${stderr || error.message}`))
        } else {
          resolve()
        }
      })
    })

    const pdf = await readFile(outputPath)
    return { pdf }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
