const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, globals = {}, dependencies = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '__env')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const context = { exports: {}, require: name => dependencies[name], __env: {}, URL, ...globals }
  vm.runInNewContext(code, context)
  return context.exports
}
const flush = () => new Promise(resolve => setImmediate(resolve))

function liveEnvironment({ rejectToken = false, mock = false } = {}) {
  const effects = [], intervals = new Map(), sources = [], documentListeners = new Map()
  let changes = 0, issued = 0, nextId = 0
  const document = { visibilityState: 'visible', addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) }
  class EventSource {
    constructor(url, options) { this.url = url; this.options = options; this.listeners = new Map(); this.closed = false; sources.push(this) }
    addEventListener(name, callback) { this.listeners.set(name, callback) }
    emit(name) { this.listeners.get(name)?.() }
    close() { this.closed = true }
  }
  const react = { useRef: current => ({ current }), useEffect: effect => effects.push(effect) }
  const dependencies = {
    react, '../api/client': { devProxyUrl: url => url }, '../api/mock': { USE_MOCK: mock },
    '../api/notifications': { issueEventToken: () => { issued++; return rejectToken ? Promise.reject(Error('offline')) : Promise.resolve({ eventsUrl: '/api/v1/rooms/test/events?streamToken=one-use' }) } },
  }
  const { useRoomLiveUpdates } = load('src/hooks/useRoomLiveUpdates.ts', {
    document, EventSource,
    setInterval: (callback, ms) => { const id = ++nextId; intervals.set(id, { callback, ms }); return id },
    clearInterval: id => intervals.delete(id),
  }, dependencies)
  useRoomLiveUpdates('test', '', () => changes++)
  const cleanups = effects.map(effect => effect())
  return { sources, intervals, document, documentListeners, changes: () => changes, issued: () => issued, cleanup: () => cleanups.forEach(fn => fn?.()) }
}

test('쿠키 인증 SSE에 연결하고 notification.created 수신 시 갱신한다', async () => {
  const env = liveEnvironment(); await flush()
  assert.equal(env.sources[0].options.withCredentials, true)
  env.sources[0].emit('notification.created')
  assert.equal(env.changes(), 1)
  assert.equal(env.intervals.size, 0)
  env.cleanup()
})

for (const event of ['member.joined', 'member.left', 'member.updated', 'room.updated', 'photo.published', 'entry.created', 'askback.updated']) {
  test(`${event} 수신 시 화면 갱신`, async () => {
    const env = liveEnvironment(); await flush()
    env.sources[0].emit(event)
    assert.equal(env.changes(), 1)
    env.cleanup()
  })
}

for (const event of ['photo.deleted', 'entry.updated', 'entry.deleted', 'scroll.template.updated']) {
  test(`서버 명세의 ${event} 수신 시 화면 갱신`, async () => {
    const env = liveEnvironment(); await flush()
    env.sources[0].emit(event)
    assert.equal(env.changes(), 1, `이벤트 구독 누락: ${event}`)
  })
}

test('SSE 오류 시 2초 조회로 전환하고 숨김 중에는 조회하지 않는다', async () => {
  const env = liveEnvironment(); await flush()
  env.sources[0].onerror()
  assert.equal(env.sources[0].closed, true)
  const timer = [...env.intervals.values()][0]
  assert.equal(timer.ms, 2000)
  timer.callback(); assert.equal(env.changes(), 1)
  env.document.visibilityState = 'hidden'
  timer.callback(); assert.equal(env.changes(), 1)
  env.document.visibilityState = 'visible'
  env.documentListeners.get('visibilitychange')()
  assert.equal(env.changes(), 2)
  env.cleanup(); assert.equal(env.intervals.size, 0)
})

test('이벤트 토큰 발급 실패 시에도 조회로 전환한다', async () => {
  const env = liveEnvironment({ rejectToken: true }); await flush()
  assert.equal(env.sources.length, 0)
  assert.equal(env.intervals.size, 1)
  env.cleanup()
})

test('화면 종료 후 지연된 연결과 타이머가 남지 않는다', async () => {
  const env = liveEnvironment(); env.cleanup(); await flush()
  assert.equal(env.sources.length, 0)
  assert.equal(env.intervals.size, 0)
  assert.equal(env.documentListeners.size, 0)
})

test('알림 목록을 연 상태에서도 실시간 구독을 시작한다', async () => {
  const effects = []; let subscriptions = 0, queries = 0
  const react = { useState: initial => [initial, () => {}], useEffect: effect => effects.push(effect), useRef: current => ({ current }), useCallback: callback => callback }
  const dependencies = {
    react, 'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    'react-router': { useNavigate: () => () => {}, useParams: () => ({ roomId: 'test' }) },
    '../hooks/useAppNavigate': { useAppNavigate: () => () => {} },
    '../api/notifications': { getNotifications: async () => { queries++; return [] } },
    '../lib/session': { getRoomSession: () => ({ memberAccessToken: '' }) },
    '../hooks/useRoomLiveUpdates': { useRoomLiveUpdates: () => subscriptions++ },
    '../lib/date': {}, '../routes/paths': {}, '../pages/NotFoundPage': {}, './NotFoundPage': {},
  }
  const page = load('src/pages/RoomNotificationsPage.tsx', { document: { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' } }, dependencies)
  page.default(); effects.forEach(effect => effect()); await flush()
  assert.equal(queries, 1)
  assert.equal(subscriptions, 1, '알림 화면이 진입 시 1회 조회만 하고 SSE 구독은 하지 않음')
})

test('푸시 수신 시 시스템 알림을 만들고 클릭 시 목적지로 이동한다', async () => {
  const listeners = new Map(), shown = [], opened = []
  const self = {
    location: { origin: 'https://example.com' },
    addEventListener: (name, handler) => listeners.set(name, handler),
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  }
  vm.runInNewContext(fs.readFileSync('public/push-sw.js', 'utf8'), { self, URL })
  let pending
  listeners.get('push')({ data: { json: () => ({ title: '완성', body: '열어 보세요', url: '/rooms/test' }) }, waitUntil: promise => pending = promise })
  await pending; assert.equal(shown[0].title, '완성')
  listeners.get('notificationclick')({ notification: { close() {}, data: shown[0].options.data }, waitUntil: promise => pending = promise })
  await pending; assert.equal(opened[0], 'https://example.com/rooms/test')
})

test('서버 구독 등록에 실패하면 푸시가 켜졌다고 판단하지 않는다', async () => {
  const subscription = { toJSON: () => ({ endpoint: 'https://push.example.com/device' }) }
  const registration = { pushManager: { getSubscription: async () => subscription } }
  const Notification = { permission: 'granted', requestPermission: async () => 'granted' }
  const push = load('src/lib/push.ts', {
    navigator: { userAgent: 'Chrome', platform: 'Win32', serviceWorker: { ready: Promise.resolve(registration), getRegistration: async () => registration } },
    window: { PushManager: {}, Notification, matchMedia: () => ({ matches: false }) }, Notification,
  }, { '../api/client': { request: async () => { throw Error('server unavailable') } }, '../api/mock': { USE_MOCK: false } })
  await assert.rejects(push.enablePush())
  assert.equal(await push.isPushEnabled(), false, '브라우저 구독만 검사하여 서버 등록 실패를 감지하지 못함')
})

test('SSE 장애 뒤 새 일회용 토큰으로 재연결하고 조회 타이머를 정리한다', async () => {
  const env = liveEnvironment(); await flush()
  env.sources[0].onerror()
  const timer = [...env.intervals.values()][0]
  for (let tick = 0; tick < 5; tick++) timer.callback()
  await flush()
  assert.equal(env.issued(), 2)
  assert.equal(env.sources.length, 2)
  env.sources[1].onopen()
  assert.equal(env.intervals.size, 0)
  env.cleanup()
  assert.equal(env.sources[1].closed, true)
})
