import type { ErrorBody } from './types'

const configuredBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'https://43-201-73-60.sslip.io/api/v1')).replace(/\/$/, '')
const BASE_URL = configuredBase.endsWith('/api/v1') ? configuredBase : `${configuredBase}/api/v1`

/** 카카오 로그인처럼 /api/v1 밖에 있는 서버 주소 (개발 중에는 프록시가 아닌 배포 서버로 바로 간다) */
export const SERVER_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'https://43-201-73-60.sslip.io')
  .replace(/\/$/, '')
  .replace(/\/api\/v1$/, '')

/** 로컬 개발 서버의 프록시가 사진을 넘겨 주는 S3 버킷 (vite.config.ts와 같은 값) */
const DEV_S3_HOST = 'durooduroo-prod-hyukjin.s3.ap-northeast-2.amazonaws.com'

/**
 * 서버가 준 절대 주소를 로컬 개발 중에는 프록시를 거치는 주소로 바꾼다.
 * 백엔드·S3가 localhost 출처를 CORS로 막아서다. 배포 빌드에서는 그대로 돌려준다
 */
export function devProxyUrl(url: string): string {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_BASE_URL) return url
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}`
    if (parsed.origin === SERVER_ORIGIN) return path
    if (parsed.host === DEV_S3_HOST) return `/__s3${path}`
  } catch {
    // 상대 주소면 그대로 쓴다
  }
  return url
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
  /** @deprecated 서버가 카카오 로그인 세션 쿠키로 인증하면서 더 이상 보내지 않는다. 호출부 정리 전까지 남겨 둔다 */
  token?: string
  /** 생성/입장처럼 중복 요청을 막아야 하는 API에 필요 */
  idempotent?: boolean
}

// 쓰기 요청(POST/PUT/PATCH/DELETE)에는 서버가 준 CSRF 토큰을 헤더에 넣어야 한다
let csrfToken: Promise<string> | null = null

function getCsrfToken() {
  csrfToken ??= fetch(`${BASE_URL}/auth/csrf`, { credentials: 'include' })
    .then((res) => res.json() as Promise<{ data: { token: string } }>)
    .then(({ data }) => data.token)
    .catch((e: unknown) => {
      csrfToken = null
      throw e
    })
  return csrfToken
}

/** 로그인·로그아웃 뒤에는 세션이 바뀌어서 CSRF 토큰을 다시 받아야 한다 */
export function resetCsrfToken() {
  csrfToken = null
}

/** 백엔드 응답의 { data } 를 꺼내 반환한다 */
export async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, idempotent } = options
  const headers: Record<string, string> = {}
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (idempotent) headers['Idempotency-Key'] = crypto.randomUUID()
  if (method !== 'GET') headers['X-CSRF-TOKEN'] = await getCsrfToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    // 카카오 로그인 세션 쿠키를 같이 보낸다
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ErrorBody | null
    // CSRF 토큰이 만료됐을 수 있어서, 쓰기 요청이 403이면 토큰을 새로 받아 한 번만 다시 보낸다
    if (res.status === 403 && method !== 'GET' && !retried) {
      resetCsrfToken()
      return request<T>(path, options, true)
    }
    throw new ApiError(res.status, err?.error.code ?? 'UNKNOWN', err?.error.message ?? '요청에 실패했어요')
  }
  if (res.status === 204) return undefined as T
  return ((await res.json()) as { data: T }).data
}
