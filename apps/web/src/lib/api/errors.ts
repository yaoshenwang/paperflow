type DatabaseError = NodeJS.ErrnoException & {
  code?: string
  cause?: unknown
  errors?: unknown[]
  severity?: string
}

const DATABASE_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  '57P01',
])

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function isDatabaseUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as DatabaseError
  if (candidate.code && DATABASE_ERROR_CODES.has(candidate.code)) return true
  const message = errorMessage(error)
  if (/connect ECONNREFUSED|connection refused|database .* does not exist|failed to connect|terminating connection/i.test(message)) {
    return true
  }
  if (candidate.cause && isDatabaseUnavailableError(candidate.cause)) return true
  if (Array.isArray(candidate.errors) && candidate.errors.some((entry) => isDatabaseUnavailableError(entry))) {
    return true
  }
  return false
}

export function toApiErrorResponse(error: unknown, unavailableMessage: string, fallbackMessage = 'Unknown server error') {
  if (isDatabaseUnavailableError(error)) {
    return Response.json(
      {
        error: unavailableMessage,
        detail: errorMessage(error),
      },
      { status: 503 },
    )
  }

  return Response.json(
    {
      error: errorMessage(error) || fallbackMessage,
    },
    { status: 500 },
  )
}
