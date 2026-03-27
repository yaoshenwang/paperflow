import { Suspense } from 'react'
import { WorkspaceImportCenter } from '@/components/editor/WorkspaceImportCenter'

export default function ImportsPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceImportCenter />
    </Suspense>
  )
}
