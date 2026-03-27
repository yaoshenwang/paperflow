import { Suspense } from 'react'
import { WorkspaceExportPanel } from '@/components/editor/WorkspaceExportPanel'

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceExportPanel />
    </Suspense>
  )
}
