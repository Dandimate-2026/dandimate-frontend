const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync('src/features/memories/templateText.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(code, context)
const { formatTemplateText } = context.exports

test('받침에 맞춰 양쪽 조사를 하나로 표시한다', () => {
  assert.equal(formatTemplateText('서연은/는 민지이/가 지수을/를 기다렸다.'), '서연은 민지가 지수를 기다렸다.')
  assert.equal(formatTemplateText('민지은(는) 서연이(가) 지수(을)를 만났다.'), '민지는 서연이 지수를 만났다.')
  assert.equal(formatTemplateText('안동(으)로 서울(으)로 대구(으)로 갔다.'), '안동으로 서울로 대구로 갔다.')
  assert.equal(formatTemplateText('서연과/와 민지과/와 함께.'), '서연과 민지와 함께.')
})

test('이름과 지역명에 잘못 붙은 조사를 고친다', () => {
  assert.equal(formatTemplateText('서연는 민지이 안동로 갔다.', ['서연', '민지']), '서연은 민지가 안동으로 갔다.')
  assert.equal(formatTemplateText('대구으로 포항로 영천로 경주으로 갔다.'), '대구로 포항으로 영천으로 경주로 갔다.')
  assert.equal(formatTemplateText('민지을 불렀다. 서연를 기다렸다.', ['민지', '서연']), '민지를 불렀다. 서연을 기다렸다.')
})

test('올바른 문장과 이름이 포함된 다른 단어는 유지한다', () => {
  const text = '민지는 서연이랑 안동으로 갔다. 안동로켓을 보며 나는 웃었다.'
  assert.equal(formatTemplateText(text, ['민지', '서연', '나']), text)
  assert.equal(formatTemplateText('“민지”은/는 웃었다.'), '“민지”는 웃었다.')
  assert.equal(formatTemplateText(''), '')
})
