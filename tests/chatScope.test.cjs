const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')

function setup() {
  let resolve, reject
  const pending = new Promise((yes, no) => { resolve = yes; reject = no })
  const storage = new Map()
  const deps = {
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    '../api/client': { ApiError: class extends Error {} },
    '../api/chatQuota': { canAsk: () => true, getChatQuota: async () => ({}), spendMockQuestion() {} },
    '../api/mock': { USE_MOCK: false },
    '../api/recordMap': { askDuru: () => pending },
  }
  const context = { exports: {}, require: name => deps[name], crypto: webcrypto, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/chatStore.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return { store: context.exports, resolve, reject }
}

test('데모 영역 변경 후 도착한 이전 답변은 새 대화에 남기지 않는다', async () => {
  const { store, resolve } = setup()
  const request = store.sendChat('데모 질문')
  store.syncChatScope('demo-room')
  const nextId = store.useChat().conversationId
  resolve({ answer: '이전 영역 답변' })
  await request
  assert.equal(store.useChat().lines.length, 0)
  assert.equal(store.useChat().conversationId, nextId)
  assert.equal(store.useChat().sending, false)
})

test('같은 영역 조회는 대화를 보존하고 OFF 전환은 진행 중 오류도 폐기한다', async () => {
  const { store, reject } = setup()
  store.syncChatScope('demo-room')
  const request = store.sendChat('데모 질문')
  store.syncChatScope('demo-room')
  assert.equal(store.useChat().lines.length, 1)
  store.syncChatScope('REAL')
  reject(new Error('늦은 오류'))
  await request
  assert.equal(store.useChat().lines.length, 0)
})
