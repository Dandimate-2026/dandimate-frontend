const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync('src/api/recordMap.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {}, require: () => ({}) }
vm.runInNewContext(code, context)
const { cityMarkerPosition } = context.exports

test('해안 도시 평균 좌표 대신 실제 기록 장소에 도시 핀을 둔다', () => {
  const places = [
    { latitude: 36.0568, longitude: 129.378 },
    { latitude: 36.0672, longitude: 129.3845 },
    { latitude: 36.075, longitude: 129.568 },
  ]
  const pin = { latitude: 36.0663, longitude: 129.4435, places }
  assert.equal(cityMarkerPosition(pin), places[1])
  assert.equal(pin.longitude, 129.4435)
})

test('장소 좌표가 없거나 유효하지 않으면 서버 도시 좌표를 유지한다', () => {
  const pin = { latitude: 36.04, longitude: 129.36, places: [{ latitude: NaN, longitude: 129 }, { latitude: 999, longitude: 129 }] }
  assert.equal(cityMarkerPosition(pin), pin)
  const empty = { ...pin, places: [] }
  assert.equal(cityMarkerPosition(empty), empty)
})
