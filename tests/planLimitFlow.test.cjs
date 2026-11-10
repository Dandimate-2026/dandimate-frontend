const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup(role = 'HOST', planType = 'FREE') {
  const navigation = [], requests = []
  const dependencies = {
    react: { useEffect() {}, useState: initial => [initial, () => {}] },
    'react-router': { useNavigate: () => (...args) => navigation.push(args), useLocation: () => ({ pathname: '/rooms/room-1/photos/new', search: '?from=room' }) },
    '../api/rooms': { requestPlanUpgrade: (...args) => { requests.push(args); return Promise.resolve() } },
    '../routes/paths': { paths: { roomPlan: id => `/rooms/${id}/plan` } },
    './useRoomLiveUpdates': { useRoomLiveUpdates() {} },
  }
  const context = { exports: {}, require: name => dependencies[name], navigator: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useRoomQuota.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  const result = context.exports.usePlanLimitAction('room-1', { me: { role }, room: { planType } }, 'PHOTO')
  return { ...result, navigation, requests }
}

for (const target of ['lite', 'pro']) {
  test(`방장이 ${target}를 고르면 선택된 플랜 안내 화면에서 가격·혜택을 확인한다`, () => {
    const app = setup()
    app.onSelectPlan(target)
    assert.equal(app.navigation.length, 1)
    const [path, options] = app.navigation[0]
    assert.equal(path, '/rooms/room-1/plan')
    assert.equal(options.state.selectedPlan, target)
    assert.equal(options.state.fromLimit, true)
    assert.equal(options.state.returnPath, '/rooms/room-1/photos/new?from=room')
    assert.equal(app.requests.length, 0)
  })
}

test('현재·하위 플랜은 선택하지 않고 상위 플랜만 안내 화면으로 보낸다', () => {
  const app = setup('HOST', 'LITE')
  app.onSelectPlan('free')
  app.onSelectPlan('lite')
  assert.equal(app.navigation.length, 0)
  app.onSelectPlan('pro')
  assert.equal(app.navigation[0][1].state.selectedPlan, 'pro')
})

test('일반 멤버의 기존 방장 알림 동작은 유지한다', async () => {
  const app = setup('MEMBER')
  assert.equal(app.onSelectPlan, undefined)
  assert.equal(app.action.label, '방장에게 알리기')
  app.action.onClick()
  await Promise.resolve()
  assert.equal(app.requests.length, 1)
  assert.deepEqual(app.requests[0], ['room-1', 'PHOTO'])
  assert.equal(app.navigation.length, 0)
})

test('PRO 방에는 상위 플랜 선택이나 추가 결제를 제안하지 않는다', () => {
  const app = setup('HOST', 'PRO')
  assert.equal(app.onSelectPlan, undefined)
  assert.equal(app.action.label, '확인')
  app.action.onClick()
  assert.equal(app.navigation.length, 0)
  assert.equal(app.requests.length, 0)
})
