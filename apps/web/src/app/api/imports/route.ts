import { rm } from 'node:fs/promises'
import { NextRequest } from 'next/server'
import { installPackArchive, loadPackInstallSource, readPacksLock, writePacksLock } from '@paperflow/cli/pack-artifacts'
import { importProjectZip, importWorkspaceJson, importWorkspaceQti } from '@/lib/workspace/import'
import { cloneProject, readProject } from '@/lib/workspace/project'
import { getDefaultProjectPath, resolveProjectPath } from '@/lib/workspace/paths'
import { snapshotToWorkspace } from '@/lib/workspace/view-model'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectPath?: string
    format?: 'demo' | 'project_folder' | 'project_zip' | 'question_pack_zip' | 'paperflow_json' | 'qti_zip'
    sourcePath?: string
    overwrite?: boolean
  }
  const projectPath = resolveProjectPath(body.projectPath)

  try {
    if ((body.format ?? 'demo') === 'demo') {
      if (body.overwrite) {
        await rm(projectPath, { recursive: true, force: true })
      }
      await cloneProject(getDefaultProjectPath(), projectPath)
    } else if (body.format === 'project_folder') {
      if (!body.sourcePath) {
        return Response.json({ error: 'sourcePath is required' }, { status: 400 })
      }
      if (body.overwrite) {
        await rm(projectPath, { recursive: true, force: true })
      }
      await cloneProject(resolveProjectPath(body.sourcePath), projectPath)
    } else if (body.format === 'question_pack_zip') {
      if (!body.sourcePath) {
        return Response.json({ error: 'sourcePath is required' }, { status: 400 })
      }
      const source = await loadPackInstallSource(resolveProjectPath(body.sourcePath))
      try {
        const entry = await installPackArchive(source, projectPath)
        const lockFile = resolveProjectPath(`${projectPath}/packs.lock`)
        const current = await readPacksLock(lockFile)
        await writePacksLock(lockFile, {
          lock_version: 1,
          packs: current.packs.filter((item) => item.id !== entry.id).concat(entry),
        })
      } finally {
        await source.cleanup?.()
      }
    } else if (body.format === 'project_zip') {
      if (!body.sourcePath) {
        return Response.json({ error: 'sourcePath is required' }, { status: 400 })
      }
      if (body.overwrite) {
        await rm(projectPath, { recursive: true, force: true })
      }
      await importProjectZip(projectPath, resolveProjectPath(body.sourcePath))
    } else if (body.format === 'paperflow_json') {
      if (!body.sourcePath) {
        return Response.json({ error: 'sourcePath is required' }, { status: 400 })
      }
      if (body.overwrite) {
        await rm(projectPath, { recursive: true, force: true })
      }
      await importWorkspaceJson(projectPath, resolveProjectPath(body.sourcePath))
    } else if (body.format === 'qti_zip') {
      if (!body.sourcePath) {
        return Response.json({ error: 'sourcePath is required' }, { status: 400 })
      }
      if (body.overwrite) {
        await rm(projectPath, { recursive: true, force: true })
      }
      await importWorkspaceQti(projectPath, resolveProjectPath(body.sourcePath))
    }

    const snapshot = await readProject(projectPath)
    return Response.json({
      ok: true,
      ...snapshotToWorkspace(snapshot, projectPath),
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
