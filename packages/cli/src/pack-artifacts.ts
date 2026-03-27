import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, stat, writeFile, cp, mkdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import YAML from 'yaml'
import { extractZipArchive, listZipEntries, writeZipArchive, type ZipEntry } from './zip.js'

export type PackIdentity = {
  id: string
  name: string
  version: string
  license: string
  author?: string
  subjects?: string[]
  grades?: string[]
}

export type PackArchiveManifest = {
  schema_version: 1
  pack: PackIdentity
  source_manifest: {
    path: string
    format: 'yaml' | 'json'
  }
  contents: {
    file_count: number
    question_count: number
    asset_count: number
    files: Array<{
      path: string
      bytes: number
      sha256: string
    }>
  }
}

export type PackLockEntry = {
  id: string
  name: string
  version: string
  license: string
  install_dir: string
  archive_file: string
  manifest_file: string
  integrity: {
    sha256: string
    bytes: number
  }
  source: {
    type: 'local_dir' | 'local_zip'
    value: string
  }
}

export type PacksLockFile = {
  lock_version: 1
  packs: PackLockEntry[]
}

export type PackBuildResult = {
  manifest: PackArchiveManifest
  outputPath: string
  sha256: string
  bytes: number
}

export type PackInstallSource = {
  manifest: PackArchiveManifest
  archivePath: string
  source: PackLockEntry['source']
  cleanup?: () => Promise<void>
}

const GENERATED_MANIFEST_FILE = 'paperflow-pack.json'

type SourcePackManifest = PackIdentity & {
  manifestPath: string
  manifestFormat: 'yaml' | 'json'
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function normalizePackPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/^\/+/, '')
}

function pickStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item) => typeof item === 'string')
  return items.length > 0 ? items : undefined
}

function normalizeSourceManifest(manifestPath: string, raw: Record<string, unknown>): SourcePackManifest {
  const fallbackName = basename(dirname(manifestPath))

  return {
    id: typeof raw.id === 'string' ? raw.id : fallbackName,
    name: typeof raw.name === 'string' ? raw.name : fallbackName,
    version: typeof raw.version === 'string' ? raw.version : '0.1.0',
    license: typeof raw.license === 'string' ? raw.license : 'CC-BY-4.0',
    author: typeof raw.author === 'string' ? raw.author : undefined,
    subjects: pickStringArray(raw.subjects),
    grades: pickStringArray(raw.grades),
    manifestPath: normalizePackPath(relative(dirname(manifestPath), manifestPath)),
    manifestFormat: manifestPath.endsWith('.json') ? 'json' : 'yaml',
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function collectFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, entryPath)))
      continue
    }

    if (entry.isFile()) {
      files.push(normalizePackPath(relative(rootDir, entryPath)))
    }
  }

  return files
}

export async function readPackDirectoryManifest(packDir: string): Promise<SourcePackManifest> {
  const normalizedDir = resolve(packDir)

  for (const candidate of ['pack.yml', 'pack.yaml', 'pack.json']) {
    const manifestPath = join(normalizedDir, candidate)
    if (!(await pathExists(manifestPath))) continue

    const text = await readFile(manifestPath, 'utf8')
    const raw = (manifestPath.endsWith('.json') ? JSON.parse(text) : YAML.parse(text)) as Record<string, unknown>
    return normalizeSourceManifest(manifestPath, raw)
  }

  throw new Error(`Missing pack manifest in ${normalizedDir}`)
}

function createArchiveManifest(
  sourceManifest: SourcePackManifest,
  files: Array<{ path: string; bytes: number; sha256: string }>,
): PackArchiveManifest {
  return {
    schema_version: 1,
    pack: {
      id: sourceManifest.id,
      name: sourceManifest.name,
      version: sourceManifest.version,
      license: sourceManifest.license,
      author: sourceManifest.author,
      subjects: sourceManifest.subjects,
      grades: sourceManifest.grades,
    },
    source_manifest: {
      path: sourceManifest.manifestPath,
      format: sourceManifest.manifestFormat,
    },
    contents: {
      file_count: files.length,
      question_count: files.filter((file) => file.path.startsWith('questions/') && file.path.endsWith('.md')).length,
      asset_count: files.filter((file) => file.path.startsWith('assets/')).length,
      files,
    },
  }
}

function archiveFileName(pack: PackIdentity): string {
  return `${pack.id}-${pack.version}.paperflow-pack.zip`
}

export function resolvePackBuildOutput(packDir: string, pack: PackIdentity, outArg?: string): string {
  if (!outArg) {
    return resolve(dirname(packDir), 'dist', archiveFileName(pack))
  }

  const resolvedOut = resolve(outArg)
  if (resolvedOut.endsWith('.zip')) {
    return resolvedOut
  }

  return join(resolvedOut, archiveFileName(pack))
}

export async function buildPackArchive(packDir: string, outputPath: string): Promise<PackBuildResult> {
  const normalizedDir = resolve(packDir)
  const sourceManifest = await readPackDirectoryManifest(normalizedDir)
  const normalizedOutput = resolve(outputPath)
  const files = await collectFiles(normalizedDir)
  const skipped = new Set<string>([GENERATED_MANIFEST_FILE])
  const relativeOutput = normalizePackPath(relative(normalizedDir, normalizedOutput))

  if (!relativeOutput.startsWith('..')) {
    skipped.add(relativeOutput)
  }

  const fileRecords: Array<{ path: string; bytes: number; sha256: string }> = []
  const entries: ZipEntry[] = []

  for (const relativePath of files) {
    if (skipped.has(relativePath)) continue

    const filePath = join(normalizedDir, relativePath)
    const data = await readFile(filePath)
    fileRecords.push({
      path: relativePath,
      bytes: data.length,
      sha256: sha256(data),
    })
    entries.push({ path: relativePath, data })
  }

  const manifest = createArchiveManifest(sourceManifest, fileRecords)
  entries.unshift({
    path: GENERATED_MANIFEST_FILE,
    data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  })

  await writeZipArchive(normalizedOutput, entries)
  const archiveBytes = await readFile(normalizedOutput)

  return {
    manifest,
    outputPath: normalizedOutput,
    sha256: sha256(archiveBytes),
    bytes: archiveBytes.length,
  }
}

async function parseArchiveManifestEntries(archivePath: string): Promise<PackArchiveManifest> {
  const entries = await listZipEntries(archivePath)
  const generated = entries.find((entry) => entry.path === GENERATED_MANIFEST_FILE)
  if (generated) {
    return JSON.parse(generated.data.toString('utf8')) as PackArchiveManifest
  }

  for (const candidate of ['pack.yml', 'pack.yaml', 'pack.json']) {
    const entry = entries.find((item) => item.path === candidate)
    if (!entry) continue
    const raw = (candidate.endsWith('.json')
      ? JSON.parse(entry.data.toString('utf8'))
      : YAML.parse(entry.data.toString('utf8'))) as Record<string, unknown>
    const sourceManifest = normalizeSourceManifest(join('/archive', candidate), raw)
    const files = entries
      .filter((item) => item.path !== GENERATED_MANIFEST_FILE)
      .map((item) => ({
        path: item.path,
        bytes: item.data.length,
        sha256: sha256(item.data),
      }))
      .sort((left, right) => left.path.localeCompare(right.path))
    return createArchiveManifest(sourceManifest, files)
  }

  throw new Error(`Zip archive does not contain ${GENERATED_MANIFEST_FILE} or a pack manifest`)
}

export async function loadPackInstallSource(inputPath: string): Promise<PackInstallSource> {
  const resolvedInput = resolve(inputPath)
  const sourceStat = await stat(resolvedInput)

  if (sourceStat.isDirectory()) {
    const manifest = await readPackDirectoryManifest(resolvedInput)
    const tempDir = await mkdtemp(join(tmpdir(), 'paperflow-pack-'))
    const archivePath = join(tempDir, archiveFileName(manifest))
    const built = await buildPackArchive(resolvedInput, archivePath)
    return {
      manifest: built.manifest,
      archivePath,
      source: {
        type: 'local_dir',
        value: resolvedInput,
      },
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true })
      },
    }
  }

  if (sourceStat.isFile()) {
    const manifest = await parseArchiveManifestEntries(resolvedInput)
    return {
      manifest,
      archivePath: resolvedInput,
      source: {
        type: 'local_zip',
        value: resolvedInput,
      },
    }
  }

  throw new Error(`Unsupported pack source: ${resolvedInput}`)
}

export async function readPacksLock(lockFilePath: string): Promise<PacksLockFile> {
  try {
    const raw = await readFile(lockFilePath, 'utf8')
    const parsed = YAML.parse(raw) as unknown

    if (Array.isArray(parsed)) {
      return {
        lock_version: 1,
        packs: parsed as PackLockEntry[],
      }
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as { lock_version?: number; packs?: PackLockEntry[] }
      return {
        lock_version: record.lock_version === 1 ? 1 : 1,
        packs: Array.isArray(record.packs) ? [...record.packs].sort((left, right) => left.id.localeCompare(right.id)) : [],
      }
    }
  } catch {
    return { lock_version: 1, packs: [] }
  }

  return { lock_version: 1, packs: [] }
}

export async function writePacksLock(lockFilePath: string, lock: PacksLockFile): Promise<void> {
  const normalized: PacksLockFile = {
    lock_version: 1,
    packs: [...lock.packs].sort((left, right) => left.id.localeCompare(right.id)),
  }

  await mkdir(dirname(lockFilePath), { recursive: true })
  await writeFile(lockFilePath, YAML.stringify(normalized), 'utf8')
}

export async function installPackArchive(
  source: PackInstallSource,
  projectDir: string,
): Promise<PackLockEntry> {
  const rootDir = resolve(projectDir)
  const pack = source.manifest.pack
  const installDir = join(rootDir, 'packs', pack.id)
  const archiveFile = join(rootDir, 'packs', archiveFileName(pack))
  const manifestFile = join(installDir, GENERATED_MANIFEST_FILE)
  const archiveBytes = await readFile(source.archivePath)
  const integrity = {
    sha256: sha256(archiveBytes),
    bytes: archiveBytes.length,
  }

  await rm(installDir, { recursive: true, force: true })
  await mkdir(dirname(archiveFile), { recursive: true })
  await cp(source.archivePath, archiveFile)
  await extractZipArchive(archiveFile, installDir)

  if (!(await pathExists(manifestFile))) {
    await writeFile(manifestFile, `${JSON.stringify(source.manifest, null, 2)}\n`, 'utf8')
  }

  return {
    id: pack.id,
    name: pack.name,
    version: pack.version,
    license: pack.license,
    install_dir: normalizePackPath(relative(rootDir, installDir)),
    archive_file: normalizePackPath(relative(rootDir, archiveFile)),
    manifest_file: normalizePackPath(relative(rootDir, manifestFile)),
    integrity,
    source: source.source,
  }
}
