import { createServer } from 'node:http'
import { compileTypst } from './compiler.js'

const PORT = Number(process.env.PORT) || 3100

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Compile endpoint
  if (req.method === 'POST' && req.url === '/compile') {
    try {
      const contentType = req.headers['content-type'] ?? ''
      let source: string

      if (contentType.includes('application/json')) {
        const body = JSON.parse(await readBody(req))
        source = body.source
      } else {
        // Plain text: body IS the typst source
        source = await readBody(req)
      }

      if (!source) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing "source" field' }))
        return
      }

      const result = await compileTypst(source)

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': result.pdf.length,
      })
      res.end(result.pdf)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Typst compile service listening on http://localhost:${PORT}`)
})
