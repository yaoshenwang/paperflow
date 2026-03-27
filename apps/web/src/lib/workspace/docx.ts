import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'

function execFileAsync(file: string, args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    execFile(file, args, { cwd }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve()
    })
  })
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function createDocxBuffer(documentXml: string, title: string) {
  const workingDir = path.join(tmpdir(), `paperflow-docx-${randomUUID()}`)
  const contentDir = path.join(workingDir, 'word')
  const relsDir = path.join(workingDir, '_rels')
  const wordRelsDir = path.join(contentDir, '_rels')
  const docPropsDir = path.join(workingDir, 'docProps')
  const outputPath = path.join(tmpdir(), `paperflow-${randomUUID()}.docx`)
  const now = new Date().toISOString()

  await mkdir(contentDir, { recursive: true })
  await mkdir(relsDir, { recursive: true })
  await mkdir(wordRelsDir, { recursive: true })
  await mkdir(docPropsDir, { recursive: true })

  try {
    await Promise.all([
      writeFile(
        path.join(workingDir, '[Content_Types].xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
      ),
      writeFile(
        path.join(relsDir, '.rels'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
      ),
      writeFile(
        path.join(wordRelsDir, 'document.xml.rels'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
      ),
      writeFile(
        path.join(contentDir, 'document.xml'),
        documentXml,
      ),
      writeFile(
        path.join(contentDir, 'styles.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
</w:styles>`,
      ),
      writeFile(
        path.join(docPropsDir, 'core.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>Paperflow</dc:creator>
  <cp:lastModifiedBy>Paperflow</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`,
      ),
      writeFile(
        path.join(docPropsDir, 'app.xml'),
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Paperflow</Application>
</Properties>`,
      ),
    ])

    await execFileAsync('zip', ['-qr', outputPath, '.'], workingDir)
    return await readFile(outputPath)
  } finally {
    await rm(workingDir, { recursive: true, force: true })
    await rm(outputPath, { force: true })
  }
}
