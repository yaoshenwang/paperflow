import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.join(projectDir, '..', '..')

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    root: workspaceRoot,
  },
}

export default nextConfig
