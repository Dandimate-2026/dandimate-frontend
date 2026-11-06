import type { ErrorBody } from './types'

const configuredBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'https://43-201-73-60.sslip.io/api/v1')).replace(/\/$/, '')
const BASE_URL = configuredBase.endsWith('/api/v1') ? configuredBase : `${configuredBase}/api/v1`

export function resetCsrfToken() { csrfRequest = undefined }
let csrfRequest: Promise<string> | undefined

async function csrfToken() {
  csrfRequest ??= fetch(`${BASE_URL}/auth/csrf`, { credentials: 'include' }).then(async (response) => {
    if (!response.ok) throw new ApiError(response.status, 'CSRF_FETCH_FAILED', '로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.')
    const result = await response.json() as { data: { token: string } }
    if (!result.data?.token) throw new Error('요청 검증 정보를 받지 못했어요.')
    return result.data.token
  }).catch((cause: unknown) => { csrfRequest = undefined; throw cause })
  return csrfRequest
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string
  /** 생성/입장처럼 중복 요청을 막아야 하는 API에 필요 */
  idempotent?: boolean
}

/** 백엔드 응답의 { data } 를 꺼내 반환한다 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, idempotent } = options
  const headers: Record<string, string> = {}
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotent) headers['Idempotency-Key'] = crypto.randomUUID()
  if (method !== 'GET') headers['X-CSRF-TOKEN'] = await csrfToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) resetCsrfToken()
    const err = (await res.json().catch(() => null)) as ErrorBody | null
    throw new ApiError(res.status, err?.error.code ?? 'UNKNOWN', err?.error.message ?? '요청에 실패했어요')
  }
  if (res.status === 204) return undefined as T
  return ((await res.json()) as { data: T }).data
}
