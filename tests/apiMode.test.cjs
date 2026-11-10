const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

// Old local settings must not bypass server authentication, data, or orders.
const legacySettings = { DEV: true, VITE_USE_MOCK: 'true', VITE_PAYMENT_DEMO: 'true' }

function load(file, dependencies, globals = {}, env = legacySettings) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '__env')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const context = { exports: {}, require: name => dependencies[name], __env: env, URLSearchParams, ...globals }
  vm.runInNewContext(code, context)
  return context.exports
}

test('이전 로컬 데모 설정과 로그인 표시가 있어도 서버 세션으로 인증한다', async () => {
  class ApiError extends Error { constructor(status) { super(); this.status = status } }
  const calls = [], redirects = [], saved = []
  let csrfResets = 0
  const auth = load('src/lib/auth.ts', {
    '../api/client': {
      ApiError, SERVER_ORIGIN: 'https://server.example.com', resetCsrfToken: () => csrfResets++,
      request: async (route, options) => { calls.push([route, options?.method]); if (route === '/users/me' && !options) throw new ApiError(401) },
    },
  }, {
    localStorage: { getItem: () => 'previous-demo-login' },
    sessionStorage: { setItem: (key, value) => saved.push([key, value]) },
    window: { location: { assign: url => redirects.push(url) } },
  })
  assert.equal(await auth.getMe(), null)
  auth.loginWithKakao('/rooms/test')
  assert.deepEqual(redirects, ['https://server.example.com/oauth2/authorization/kakao'])
  assert.deepEqual(saved, [['duruduru:login-redirect', '/rooms/test']])
  await auth.logout()
  await auth.deleteAccount()
  assert.deepEqual(calls, [['/users/me', undefined], ['/auth/logout', 'POST'], ['/users/me', 'DELETE']])
  assert.equal(csrfResets, 2)
})

test('과거 예시 방 ID도 서버에서 조회하고 실패를 예시 데이터로 대체하지 않는다', async () => {
  const calls = []
  const unavailable = new Error('not found')
  const client = { request: async (route, options) => { calls.push([route, options]); throw unavailable } }
  const rooms = load('src/api/rooms.ts', { './client': client })
  const memories = load('src/api/memories.ts', { './client': client })
  await assert.rejects(rooms.getRoomHome('demo', ''), error => error === unavailable)
  await assert.rejects(memories.getScroll('scroll-review', ''), error => error === unavailable)
  assert.deepEqual(calls.map(([route]) => route), ['/rooms/demo', '/rooms/scroll-review/scroll'])
  assert.ok(calls.every(([, options]) => options.token === ''))
})

test('방 생성은 서버 동의 버전과 실제 생성 응답을 사용한다', async () => {
  const calls = []
  const response = { room: { id: 'server-room' }, member: { id: 'server-member' } }
  const rooms = load('src/api/rooms.ts', {
    './client': { request: async (route, options) => { calls.push([route, options]); return route === '/consents/current' ? { version: 'current-terms' } : response } },
  })
  const result = await rooms.createRoom({ name: '내 모임', meetingDate: '2026-11-10', hostNickname: '나', capacity: 2, planType: 'FREE', deadlineAt: '2026-11-12T00:00:00Z' })
  assert.equal(result, response)
  assert.deepEqual(calls.map(([route]) => route), ['/consents/current', '/rooms'])
  assert.equal(calls[1][1].body.consent.version, 'current-terms')
  assert.equal(calls[1][1].body.deadlineAt, '2026-11-12T00:00:00Z')
  assert.equal(calls[1][1].method, 'POST')
  assert.equal(calls[1][1].idempotent, true)
})

test('결제 활성화는 토스 키로 판단하고 플랜 변경 주문은 서버로 보낸다', async () => {
  const calls = []
  const dependencies = {
    '@tosspayments/tosspayments-sdk': {}, '../routes/paths': {},
    './client': { request: async (route, options) => { calls.push([route, options]); return { orderId: 'server-order', status: 'READY' } } },
    './rooms': {},
  }
  assert.equal(load('src/api/payments.ts', dependencies).TOSS_ENABLED, false)
  const payments = load('src/api/payments.ts', dependencies, {}, { ...legacySettings, VITE_TOSS_CLIENT_KEY: 'test_ck_configured' })
  assert.equal(payments.TOSS_ENABLED, true)
  const order = await payments.createPlanOrder('real-room', 'PRO')
  assert.equal(order.orderId, 'server-order')
  assert.equal(order.status, 'READY')
  assert.equal(calls[0][0], '/rooms/real-room/plan-orders')
  assert.equal(calls[0][1].body.planType, 'PRO')
  assert.equal(calls[0][1].idempotent, true)
})
