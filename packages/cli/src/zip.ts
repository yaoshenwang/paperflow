import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const ZIP_VERSION = 20
const ZIP_UTF8_FLAG = 1 << 11
const ZIP_STORE_METHOD = 0
const ZIP_DEFLATE_METHOD = 8
const DOS_DATE = 0x0021
const DOS_TIME = 0x0000

export type ZipEntry = {
  path: string
  data: Buffer
}

type ParsedCentralDirectoryEntry = {
  path: string
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  generalPurposeBitFlag: number
  localHeaderOffset: number
}

let crcTable: Uint32Array | undefined

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable

  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  crcTable = table
  return table
}

function crc32(buffer: Uint8Array): number {
  const table = getCrcTable()
  let value = 0xffffffff

  for (const byte of buffer) {
    value = table[(value ^ byte) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function writeString(target: Buffer, offset: number, value: string): number {
  const bytes = Buffer.from(value, 'utf8')
  bytes.copy(target, offset)
  return bytes.length
}

function normalizeArchivePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/^\/+/, '')
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset
    }
  }

  throw new Error('Invalid zip archive: missing end of central directory record')
}

function parseCentralDirectory(buffer: Buffer): ParsedCentralDirectoryEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)

  const entries: ParsedCentralDirectoryEntry[] = []
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid zip archive: malformed central directory')
    }

    const generalPurposeBitFlag = buffer.readUInt16LE(offset + 8)
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraFieldLength = buffer.readUInt16LE(offset + 30)
    const fileCommentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const pathBytes = buffer.subarray(offset + 46, offset + 46 + fileNameLength)
    const path = normalizeArchivePath(pathBytes.toString('utf8'))

    entries.push({
      path,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      generalPurposeBitFlag,
      localHeaderOffset,
    })

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return entries
}

function extractEntryData(buffer: Buffer, entry: ParsedCentralDirectoryEntry): Buffer {
  if ((entry.generalPurposeBitFlag & 0x0008) !== 0) {
    throw new Error(`Unsupported zip entry with data descriptor: ${entry.path}`)
  }

  if (buffer.readUInt32LE(entry.localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid zip archive: malformed local file header for ${entry.path}`)
  }

  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26)
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28)
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize)

  if (entry.compressionMethod === ZIP_STORE_METHOD) {
    return Buffer.from(compressed)
  }

  if (entry.compressionMethod === ZIP_DEFLATE_METHOD) {
    return inflateRawSync(compressed)
  }

  throw new Error(`Unsupported zip compression method ${entry.compressionMethod} for ${entry.path}`)
}

function isUnsafeExtractPath(path: string): boolean {
  return (
    path.length === 0 ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((segment) => segment === '..')
  )
}

export function createZipArchive(entries: ZipEntry[]): Buffer {
  const normalizedEntries = [...entries]
    .map((entry) => ({
      path: normalizeArchivePath(entry.path),
      data: entry.data,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of normalizedEntries) {
    const pathBytes = Buffer.from(entry.path, 'utf8')
    const localHeader = Buffer.alloc(30 + pathBytes.length)
    const checksum = crc32(entry.data)

    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(ZIP_VERSION, 4)
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6)
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8)
    localHeader.writeUInt16LE(DOS_TIME, 10)
    localHeader.writeUInt16LE(DOS_DATE, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(entry.data.length, 18)
    localHeader.writeUInt32LE(entry.data.length, 22)
    localHeader.writeUInt16LE(pathBytes.length, 26)
    localHeader.writeUInt16LE(0, 28)
    pathBytes.copy(localHeader, 30)

    localParts.push(localHeader, entry.data)

    const centralHeader = Buffer.alloc(46 + pathBytes.length)
    centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_SIGNATURE, 0)
    centralHeader.writeUInt16LE(ZIP_VERSION, 4)
    centralHeader.writeUInt16LE(ZIP_VERSION, 6)
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8)
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10)
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(entry.data.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(pathBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    pathBytes.copy(centralHeader, 46)

    centralParts.push(centralHeader)
    offset += localHeader.length + entry.data.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(normalizedEntries.length, 8)
  end.writeUInt16LE(normalizedEntries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

export async function writeZipArchive(filePath: string, entries: ZipEntry[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, createZipArchive(entries))
}

export async function listZipEntries(filePath: string): Promise<ZipEntry[]> {
  const buffer = await readFile(filePath)
  return parseCentralDirectory(buffer).map((entry) => ({
    path: entry.path,
    data: extractEntryData(buffer, entry),
  }))
}

export async function extractZipArchive(filePath: string, outputDir: string): Promise<void> {
  const buffer = await readFile(filePath)
  const root = resolve(outputDir)
  const entries = parseCentralDirectory(buffer)

  for (const entry of entries) {
    if (entry.path.endsWith('/')) continue
    if (isUnsafeExtractPath(entry.path)) {
      throw new Error(`Unsafe zip entry path: ${entry.path}`)
    }

    const outputPath = resolve(root, entry.path)
    if (!outputPath.startsWith(root)) {
      throw new Error(`Unsafe zip entry path: ${entry.path}`)
    }

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, extractEntryData(buffer, entry))
  }
}

export function encodeUtf8(value: string): Buffer {
  const bytes = Buffer.alloc(Buffer.byteLength(value, 'utf8'))
  writeString(bytes, 0, value)
  return bytes
}
