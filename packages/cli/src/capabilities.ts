import { spawnSync } from 'node:child_process'

export type CapabilityProbe = {
  typst: boolean
  quarto: boolean
  pandoc: boolean
}

export function probeCapabilities(): CapabilityProbe {
  return {
    typst: hasCommand('typst'),
    quarto: hasCommand('quarto'),
    pandoc: hasCommand('pandoc') || hasCommand('quarto', ['pandoc', '--version']),
  }
}

function hasCommand(command: string, args: string[] = ['--version']): boolean {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'ignore',
  })
  return result.status === 0
}
