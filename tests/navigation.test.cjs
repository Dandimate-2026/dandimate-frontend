const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup(pathname, idx, state) {
  const calls = []
  const deps = {
    react: { useCallback: callback => callback },
    'react-router': {
      useNavigate: () => (...args) => calls.push(args),
      useLocation: () => ({ pathname, state }),
      resolvePath: to => typeof to === 'string' ? { pathname: to, search: '', hash: '' } : to,
    },
  }
  const context = { exports: {}, require: name => deps[name], window: { history: { state: { idx } } } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useAppNavigate.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return { navigate: context.exports.useAppNavigate(), calls }
}

test('목록으로 돌아가기는 이전 위치로 이동하며 방문 기록을 추가하지 않는다', () => {
  const { navigate, calls } = setup('/rooms/a', 4, { returnTargets: { '/': 3 } })
  navigate('/')
  assert.equal(calls[0][0], -1)
})
test('설정에서 돌아가면 원래 방으로 복귀하고 목록 위치도 유지된다', () => {
  const { navigate, calls } = setup('/rooms/a/settings', 5, { returnTargets: { '/': 3, '/rooms/a': 4 } })
  navigate('/rooms/a')
  assert.equal(calls[0][0], -1)
})
test('이전 위치가 없거나 유효하지 않으면 상위 화면으로 교체한다', () => {
  for (const index of [undefined, -1, 99]) {
    const { navigate, calls } = setup('/rooms/a', 4, { returnTargets: { '/': index } })
    navigate('/')
    assert.equal(calls[0][0], '/')
    assert.equal(calls[0][1].replace, true)
  }
})
test('새 하위 화면 이동에는 부모 위치와 추가 탐색 상태를 전달한다', () => {
  const { navigate, calls } = setup('/rooms/a', 4, { returnTargets: { '/': 3 } })
  navigate('/rooms/a/settings', { state: { reviewerDemo: true } })
  assert.equal(calls[0][1].state.returnTargets['/rooms/a'], 4)
  assert.equal(calls[0][1].state.returnTargets['/'], 3)
  assert.equal(calls[0][1].state.reviewerDemo, true)
})
test('명시적 replace와 숫자 기반 뒤로가기는 그대로 유지한다', () => {
  const { navigate, calls } = setup('/rooms/a', 4, { returnTargets: { '/': 3 } })
  navigate('/', { replace: true })
  assert.equal(calls[0][0], '/')
  assert.equal(calls[0][1].replace, true)
  navigate(-1)
  assert.equal(calls[1][0], -1)
})
