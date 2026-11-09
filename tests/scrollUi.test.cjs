const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function mount(file, props, overrides = {}, exportName = 'default', globals = {}) {
  const states = []; let cursor = 0
  const jsx = (type, props, key) => ({ type, props: props || {}, key })
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i] },
    useEffect() {},
  }
  const templates = { getTemplate: id => ({ id: id || 'minimal', name: id === 'andong' ? '안동' : '기본', plan: id === 'andong' ? 'LITE' : 'FREE' }), fromServerTemplate: () => 'minimal', canUseTemplate: (id, plan) => id !== 'andong' || plan !== 'FREE', templateStyle: () => ({}), SCROLL_TEMPLATES: [{ id: 'minimal', name: '기본', plan: 'FREE' }, { id: 'andong', name: '안동', plan: 'LITE' }] }
  const dependencies = {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router': { useNavigate: () => () => {}, useLocation: () => ({ state: null }), useSearchParams: () => [new URLSearchParams(), () => {}] },
    '../../api/memories': { rateParagraph: async () => {}, setAhMatda: async () => {} },
    '../../api/rooms': { updateRoom: async () => {} },
    '../../lib/paragraphRatings': { getParagraphRating: () => undefined, rememberParagraphRating() {} },
    '../../lib/flower': { memoryFlowerColor: () => 'pink' },
    '../../lib/siteUrl': { siteUrl: path => path },
    './templates': templates,
    ...overrides,
  }
  const context = { exports: {}, require: name => dependencies[name] || new Proxy({ __esModule: true, default: name }, { get: (object, key) => key in object ? object[key] : key }), window: { location: { pathname: '/rooms/test/weaving', search: '' }, scrollTo() {} }, localStorage: { getItem: () => '1' }, navigator: {}, DOMException, URLSearchParams, ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const component = context.exports[exportName]
  return { render() { cursor = 0; let tree = component(props); while (typeof tree.type === 'function') tree = tree.type(tree.props); return tree } }
}
function all(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(all)] }
function text(node) { return [node?.props?.children].flat(Infinity).map(child => typeof child === 'object' ? text(child) : child ?? '').join('') }
function find(tree, predicate) { const node = all(tree).find(predicate); assert.ok(node, 'Expected control not found'); return node }
const paragraphs = ['p1', 'p2'].map((id, index) => ({ id, version: 1, body: `이야기 ${index + 1}`, photo: { imageUrl: `${id}.jpg`, uploader: { nickname: '친구' } }, sources: [], replies: [], replyCount: 0, ahMatdaCount: 0 }))
const home = role => ({ me: { id: 'me', role }, room: { id: 'room', name: '여행', planType: 'FREE' }, members: [] })
async function rate(app, score) {
  find(app.render(), n => n.type === 'input' && n.props.value === score).props.onChange()
  await new Promise(resolve => setImmediate(resolve))
}

for (const score of [1, 2, 5]) {
  test(`${score}점 평가 후 선택지와 점수가 남고 재엮기는 1~2점에만 제공한다`, async () => {
    const saved = []; const woven = []
    const app = mount('src/features/memories/LiveScrollPage.tsx', { scroll: { paragraphs }, home: home('HOST'), token: 'test', onReweave: p => woven.push(p.id) }, {
      '../../api/memories': { rateParagraph: async (id, token, score) => saved.push([id, score]) },
    })
    await rate(app, score)
    const tree = app.render()
    assert.equal(all(tree).filter(n => n.type === 'input').length, 5)
    assert.equal(find(tree, n => n.type === 'input' && n.props.value === score).props.checked, true)
    assert.deepEqual(saved, [['p1', score], ['p2', score]])
    assert.equal(all(tree).some(n => n.props.className === 'scroll-bottom-reweave'), score <= 2)
    assert.equal(woven.length, 0)
    if (score <= 2) {
      find(tree, n => n.props.className === 'scroll-reweave-chip').props.onClick()
      find(app.render(), n => n.props.className === 'reweave-paragraph-option' && text(n).includes('이야기 2')).props.onClick()
      assert.deepEqual(woven, ['p2'])
    }
    assert.ok(!text(tree).includes('답가 남기기'))
    assert.ok(!text(tree).includes('더 보태고 싶은 이야기가 있나요?'))
  })
}

test('전체 평가를 다시 바꾸면 기존 점수 대신 새 점수를 저장한다', async () => {
  const calls = []
  const app = mount('src/features/memories/LiveScrollPage.tsx', { scroll: { paragraphs }, home: home('HOST'), token: 'test' }, { '../../api/memories': { rateParagraph: async (id, token, score) => calls.push(score) } })
  await rate(app, 2)
  await rate(app, 5)
  assert.equal(find(app.render(), n => n.type === 'input' && n.props.value === 5).props.checked, true)
  assert.deepEqual(calls, [2, 2, 5, 5])
})

test('팀원은 무료 템플릿도 첫 사진 미리보기까지 접근하고 적용 대신 방장에게 요청한다', () => {
  const selected = []
  const app = mount('src/features/memories/TemplatePicker.tsx', { scroll: { paragraphs }, home: home('MEMBER'), value: 'minimal', onSelect: id => selected.push(id) })
  find(app.render(), n => n.props.role === 'tab' && text(n) === '미리보기').props.onClick()
  const tree = app.render()
  assert.equal(find(tree, n => n.type === './ScrollDocument').props.paragraph.id, 'p1')
  assert.ok(find(tree, n => text(n) === '방장에게 이 템플릿 요청하기' && typeof n.props.onClick === 'function'))
  assert.ok(!all(tree).some(n => text(n) === '이 템플릿 선택하기' && n.props.onClick))
  assert.equal(selected.length, 0)
})

test('방장은 전체 템플릿 미리보기에서 적용할 수 있다', () => {
  const selected = []
  const app = mount('src/features/memories/TemplatePicker.tsx', { scroll: { paragraphs }, home: home('HOST'), value: 'minimal', onSelect: id => selected.push(id) })
  find(app.render(), n => n.props.role === 'tab' && text(n) === '미리보기').props.onClick()
  const tree = app.render()
  assert.equal(find(tree, n => n.type === './ScrollDocument').props.paragraph, undefined)
  find(tree, n => text(n) === '이 템플릿 선택하기' && typeof n.props.onClick === 'function').props.onClick()
  assert.deepEqual(selected, ['minimal'])
})

test('플랜에서 돌아오면 고른 템플릿과 미리보기 탭을 복원한다', () => {
  const params = new URLSearchParams('templates=1&template=andong&templateTab=preview')
  const app = mount('src/features/memories/TemplatePicker.tsx', { scroll: { paragraphs }, home: home('HOST'), value: 'minimal' }, {
    'react-router': { useNavigate: () => () => {}, useLocation: () => ({ state: null }), useSearchParams: () => [params, () => {}] },
  })
  const tree = app.render()
  assert.equal(find(tree, n => n.props.role === 'tab' && text(n) === '미리보기').props['aria-selected'], true)
  assert.equal(find(tree, n => n.type === './ScrollDocument').props.template, 'andong')
})

test('이미 템플릿을 적용했던 방도 복귀 주소로 선택 화면을 다시 열고 다른 주소 정보는 보존한다', () => {
  const params = new URLSearchParams('templates=1&template=andong&templateTab=preview&job=job-1&reply=photo-1')
  let updated
  const app = mount('src/features/memories/LiveScrollPage.tsx', { scroll: { paragraphs }, home: home('HOST'), token: 'test' }, {
    'react-router': { useNavigate: () => () => {}, useLocation: () => ({ state: null }), useSearchParams: () => [params, update => { updated = update(params) }] },
    '../../lib/planReturn': { clearPlanReturn() {} },
  }, 'default', { localStorage: { getItem: () => '1', setItem() {} } })
  const tree = app.render()
  assert.equal(tree.type, './TemplatePicker')
  tree.props.onClose()
  assert.equal(updated.toString(), 'job=job-1&reply=photo-1')
})

test('평가 저장이 일부 실패하면 성공한 문단을 중복 저장하지 않고 실패한 문단만 재시도한다', async () => {
  const calls = []; let fail = true
  const app = mount('src/features/memories/LiveScrollPage.tsx', { scroll: { paragraphs }, home: home('HOST'), token: 'test' }, {
    '../../api/memories': { rateParagraph: async id => { calls.push(id); if (id === 'p2' && fail) throw new Error('network') } },
  })
  await rate(app, 2)
  assert.equal(find(app.render(), n => n.type === 'input' && n.props.value === 2).props.checked, true)
  fail = false
  find(app.render(), n => text(n) === '평가 저장 다시 시도' && n.props.onClick).props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, ['p1', 'p2', 'p2'])
  assert.ok(!all(app.render()).some(n => text(n) === '평가 저장 다시 시도' && n.props.onClick))
})

for (const textOnly of [false, true]) {
  test(`내 덧붙임 ${textOnly ? '글로 보기에는 재생 UI가 없고' : '음성 보기에는 공통 재생 버튼이 있으며'} 별도 오디오 플레이어를 만들지 않는다`, () => {
    const app = mount('src/features/memories/components.tsx', { story: { author: '나', kind: '말로 남김', text: '내 이야기', audioUrl: 'voice.webm' }, mine: true, textOnly }, {}, 'StoryCard')
    const tree = app.render()
    assert.equal(all(tree).some(n => n.props.className === 'memory-play'), !textOnly)
    assert.ok(!all(tree).some(n => n.type === 'audio'))
  })
}

test('음성 재생 준비 중 연속 클릭해도 오디오를 중복 생성하지 않고 실패 후 다시 시도할 수 있다', async () => {
  const players = []
  let rejectPlay
  class Audio {
    constructor() { players.push(this) }
    play() { return new Promise((resolve, reject) => { rejectPlay = reject }) }
    pause() {}
  }
  const app = mount('src/features/memories/components.tsx', { story: { author: '나', kind: '말로 남김', text: '내 이야기', audioUrl: 'voice.webm' }, mine: true }, {}, 'StoryCard', { Audio })
  const play = () => find(app.render(), n => n.props.className === 'memory-play').props.onClick()
  play(); play()
  assert.equal(players.length, 1)
  rejectPlay(new Error('network'))
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(text(app.render()).includes('음성을 재생하지 못했어요'))
  play()
  assert.equal(players.length, 2)
  assert.ok(!text(app.render()).includes('음성을 재생하지 못했어요'))
  rejectPlay(new Error('network'))
  await new Promise(resolve => setImmediate(resolve))
})
