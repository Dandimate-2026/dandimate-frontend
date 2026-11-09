const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function loadModule(file, globals, dependencies = {}) {
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', '__env')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const context = { exports: {}, require: (name) => dependencies[name], URL, setTimeout, clearTimeout, ...globals }
  vm.runInNewContext(code, context)
  return context.exports
}

function sdkEnvironment(key = 'javascript-key', ready = true) {
  const sent = []
  const scripts = []
  const sdk = { init() {}, isInitialized: () => true, Share: { sendDefault: (message) => sent.push(message) } }
  const window = ready ? { Kakao: sdk } : {}
  const module = loadModule('src/lib/kakaoShare.ts', {
    __env: { VITE_KAKAO_JS_KEY: key }, window,
    document: { createElement: () => ({ remove() {} }), head: { appendChild: (script) => scripts.push(script) } },
  }, { './siteUrl': { siteUrl: path => `https://example.com${path}` } })
  return { module, window, sdk, sent, scripts }
}

test('로고 없이 확정 문구·전체 초대 URL과 모바일/PC 버튼 목적지를 보존한다', () => {
  const { module, sent } = sdkEnvironment()
  const url = 'https://example.com/invite/room-token?from=chat'
  const message = '‘경주 여행’에서 사진과 이야기로\n우리만의 두루마리를 채워요.'
  assert.equal(module.shareKakaoInvitation(message, url), 'opened')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].objectType, 'text')
  assert.equal(sent[0].text, `💌 두루두루에 초대됐어요!\n\n${message}\n\n${url}`)
  assert.equal(sent[0].content, undefined)
  assert.equal(sent[0].link.mobileWebUrl, url)
  assert.equal(sent[0].link.webUrl, url)
  assert.equal(sent[0].buttons[0].title, '추억 남기러 가기')
  assert.equal(sent[0].buttons[0].link.mobileWebUrl, url)
  assert.equal(sent[0].buttons[0].link.webUrl, url)
})

test('키가 없으면 SDK를 로드하거나 공유하지 않는다', async () => {
  const { module, scripts, sent } = sdkEnvironment('')
  await module.prepareKakaoShare()
  assert.equal(module.shareKakaoInvitation('초대', 'https://example.com/invite/token'), 'unavailable')
  assert.equal(scripts.length, 0)
  assert.equal(sent.length, 0)
})

test('긴 문구를 줄여도 본문의 전체 URL을 유지하고 지나치게 긴 URL은 복사로 넘긴다', () => {
  const { module, sent } = sdkEnvironment()
  const url = `https://example.com/invite/${'a'.repeat(80)}`
  module.shareKakaoInvitation('초대'.repeat(200), url)
  assert.ok(sent[0].text.length <= 200)
  assert.ok(sent[0].text.endsWith(url))
  assert.equal(sent[0].link.mobileWebUrl, url)
  assert.equal(sent[0].link.webUrl, url)
  assert.throws(() => module.shareKakaoInvitation('초대', `https://example.com/${'a'.repeat(200)}`))
})

test('SDK 로드는 중복하지 않고 준비 후 새 클릭에서만 공유한다', async () => {
  const { module, scripts, window, sdk, sent } = sdkEnvironment('key', false)
  const pending = module.prepareKakaoShare()
  assert.equal(module.prepareKakaoShare(), pending)
  assert.equal(module.shareKakaoInvitation('초대', 'https://example.com/invite/token'), 'loading')
  assert.equal(scripts.length, 1)
  assert.ok(scripts[0].integrity.startsWith('sha384-'))
  window.Kakao = sdk
  scripts[0].onload()
  await pending
  assert.equal(sent.length, 0)
  assert.equal(module.shareKakaoInvitation('초대', 'https://example.com/invite/token'), 'opened')
})

test('SDK 다운로드 실패 후 다시 준비할 수 있다', async () => {
  const { module, scripts, window, sdk } = sdkEnvironment('key', false)
  const failed = module.prepareKakaoShare()
  scripts[0].onerror()
  await assert.rejects(failed)
  const retry = module.prepareKakaoShare()
  assert.equal(scripts.length, 2)
  window.Kakao = sdk
  scripts[1].onload()
  await retry
})

test('초대 토큰이 비어 있으면 복사와 공유를 모두 막는다', async () => {
  let attempts = 0
  const notices = []
  const attempt = () => { attempts++ }
  const { useInviteShare } = loadModule('src/hooks/useInviteShare.ts', {}, {
    react: { useState: () => [false, () => {}], useEffect: () => {} },
    '../lib/share': { showToast: (text) => notices.push(text), copyForShare: attempt, shareWithDevice: attempt },
    '../lib/kakaoShare': { shareKakaoInvitation: attempt },
    '../lib/session': { inviteUrl: (token) => `https://example.com/invite/${token}` },
  })
  const invite = useInviteShare('')
  await invite.share()
  await invite.copy()
  assert.equal(attempts, 0)
  assert.equal(notices.length, 2)
})
