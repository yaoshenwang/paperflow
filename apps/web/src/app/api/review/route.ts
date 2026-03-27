import { NextRequest } from 'next/server'
import { lintProject } from '@/lib/workspace/lint'
import { resolveProjectPath } from '@/lib/workspace/paths'
import { collectReviewArtifacts } from '@/lib/workspace/render'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { projectPath?: string; workspace?: { projectPath?: string } }
  const projectPath = resolveProjectPath(body.projectPath ?? body.workspace?.projectPath)
  const report = await lintProject(projectPath)
  const artifacts = await collectReviewArtifacts(projectPath)
  const failedArtifacts = artifacts.filter((artifact) => !artifact.ready)
  const artifactCheck = {
    id: 'export_artifacts',
    name: '导出产物矩阵',
    status: failedArtifacts.length === 0 ? 'pass' : 'fail',
    detail: failedArtifacts.length === 0
      ? '正式导出所需产物均可成功生成'
      : `以下产物生成失败：${failedArtifacts.map((artifact) => artifact.label).join('、')}`,
  } as const
  const checks = [...report.checks, artifactCheck]
  const summary = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    publishable: checks.every((check) => check.status !== 'fail'),
  }

  return Response.json({ ...report, checks, summary, artifacts })
}
