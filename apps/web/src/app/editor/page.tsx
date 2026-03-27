import { Suspense } from 'react'
import { WorkspaceEditor } from '@/components/editor/WorkspaceEditor'

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceEditor />
    </Suspense>
  )
}
