import type { ErrorBody } from './types'

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`

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
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotent) headers['Idempotency-Key'] = crypto.randomUUID()

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorBody | null
    throw new ApiError(res.status, err?.error.code ?? 'UNKNOWN', err?.error.message ?? '요청에 실패했어요')
  }
  if (res.status === 204) return undefined as T
  return ((await res.json()) as { data: T }).data
}
