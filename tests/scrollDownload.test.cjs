const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup({ ios = false, failedPhoto, cancel = false } = {}) {
  const calls = { photos: [], fetched: [], canvases: [], sizes: [], downloads: [], shares: [], pdf: [], removed: 0 }
  const style = { backgroundColor: '#fffdf9', borderRadius: '12px', objectFit: 'cover' }
  const makeCanvas = () => {
    const canvas = { width: 360, height: 800, getContext: () => context, toBlob: callback => callback(new Blob(['PNG'], { type: 'image/png' })) }
    const context = { save() {}, restore() {}, scale() {}, beginPath() {}, roundRect() {}, clip() {}, fillRect() {}, drawImage(image) { if (image.src) calls.photos.push(image.src) } }
    calls.canvases.push(canvas)
    return canvas
  }
  const makeNode = urls => ({
    offsetWidth: 360, scrollHeight: 800,
    parentElement: { append() {} },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    cloneNode() {
      const clone = makeNode(urls)
      clone.querySelectorAll = () => urls.map((src, index) => ({ src, style: {}, removeAttribute() {}, parentElement: {}, getBoundingClientRect: () => ({ left: 0, top: index * 230, width: 300, height: 220 }) }))
      return clone
    },
    remove() { calls.removed++ },
  })
  class MockImage {
    naturalWidth = 600; naturalHeight = 400
    set src(value) { this._src = value; queueMicrotask(() => this.onload()) }
    get src() { return this._src }
  }
  class MockPDF {
    addPage() {}
    addImage(bytes, type) { calls.pdf.push(type) }
    output() { return new Blob(['PDF'], { type: 'application/pdf' }) }
  }
  const navigator = { userAgent: ios ? 'iPhone' : 'Chrome', platform: ios ? 'iPhone' : 'Win32', maxTouchPoints: ios ? 1 : 0,
    canShare: () => true, share: async data => { calls.shares.push(data); if (cancel) throw new DOMException('cancelled', 'AbortError') } }
  const dependencies = {
    '../../api/client': { devProxyUrl: url => url },
    'html-to-image': { getFontEmbedCSS: async () => '', toCanvas: async (node, options) => { const canvas = makeCanvas(); canvas.width = Math.floor(options.width * options.pixelRatio); canvas.height = Math.floor(options.height * options.pixelRatio); calls.sizes.push({ width: canvas.width, height: canvas.height }); return canvas } },
    fflate: { zipSync: files => { assert.equal(Object.keys(files).length, 3); return new Uint8Array([80, 75]) } },
    jspdf: { jsPDF: MockPDF },
  }
  const context = { exports: {}, require: name => dependencies[name], Blob, File, Uint8Array, DOMException, AbortSignal, queueMicrotask,
    URL: { createObjectURL: blob => `blob:${blob.tag || 'file'}`, revokeObjectURL() {} },
    Image: MockImage, navigator,
    fetch: async url => { calls.fetched.push(url); return { ok: url !== failedPhoto, blob: async () => ({ tag: url }) } },
    getComputedStyle: () => style,
    window: { setTimeout() {}, clearTimeout() {} },
    document: { fonts: { ready: Promise.resolve() }, body: { append() {} }, createElement: tag => tag === 'canvas' ? makeCanvas() : { click() { calls.downloads.push(this.download) }, remove() {} } },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/memories/scrollDownload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return { ...context.exports, calls, node: makeNode(['first.jpg', 'middle.jpg', 'last.jpg']), cards: ['first.jpg', 'middle.jpg', 'last.jpg'].map(url => makeNode([url])) }
}

for (const format of ['image', 'cards', 'pdf']) {
  test(`${format}: 첫 사진부터 마지막 사진까지 각각 직접 합성하고 생성만으로 다운로드하지 않는다`, async () => {
    const app = setup()
    const result = await app.exportScroll(app.node, app.cards, format, '우리 여행')
    assert.deepEqual(app.calls.photos, ['blob:first.jpg', 'blob:middle.jpg', 'blob:last.jpg'])
    assert.equal(app.calls.downloads.length, 0)
    assert.equal(result.blob.type, { image: 'image/png', cards: 'application/zip', pdf: 'application/pdf' }[format])
    if (format === 'cards') { assert.equal(result.files.length, 3); assert.ok(result.files.every(file => file.blob.type === 'image/png' && file.name.endsWith('.png'))) }
    if (format === 'pdf') assert.equal(app.calls.pdf.length, 3)
    assert.equal(app.calls.removed, format === 'image' ? 1 : 3)
    assert.ok(app.calls.canvases.every(canvas => canvas.width === 0 && canvas.height === 0), '사용한 캔버스 메모리를 모두 반환한다')
  })
}

test('사진을 가져오지 못하면 빈 파일을 성공으로 반환하지 않는다', async () => {
  const app = setup({ failedPhoto: 'middle.jpg' })
  await assert.rejects(app.exportScroll(app.node, app.cards, 'image', '여행'), /사진 원본/)
  assert.equal(app.calls.downloads.length, 0)
  assert.equal(app.calls.removed, 1)
})

test('매우 긴 이미지도 제한한 캔버스 면적과 변 길이를 지킨다', async () => {
  const app = setup()
  const original = app.node.cloneNode
  app.node.cloneNode = () => { const clone = original(); clone.scrollHeight = 100_000; return clone }
  await app.exportScroll(app.node, app.cards, 'image', '여행')
  const canvas = app.calls.sizes[0]
  assert.ok(canvas.width * canvas.height <= 4_000_000)
  assert.ok(canvas.height <= 16_000)
})

test('iOS 저장 클릭은 파일 MIME과 파일명을 유지해 즉시 공유창으로 전달한다', async () => {
  const app = setup({ ios: true })
  const file = { name: '여행.png', blob: new Blob(['image'], { type: 'image/png' }) }
  const promise = app.saveDownload(file)
  assert.equal(app.calls.shares.length, 1)
  assert.equal(await promise, 'shared')
  assert.equal(app.calls.shares[0].files[0].name, '여행.png')
  assert.equal(app.calls.shares[0].files[0].type, 'image/png')
  assert.equal(app.calls.downloads.length, 0)
})

test('iOS 공유 취소는 다른 다운로드를 자동 실행하지 않는다', async () => {
  const app = setup({ ios: true, cancel: true })
  await assert.rejects(app.saveDownload({ name: '여행.png', blob: new Blob(['image'], { type: 'image/png' }) }), { name: 'AbortError' })
  assert.equal(app.calls.downloads.length, 0)
})

test('Android와 PC는 준비된 PNG를 원래 확장자로 다운로드한다', async () => {
  const app = setup()
  assert.equal(await app.saveDownload({ name: '여행.png', blob: new Blob(['image'], { type: 'image/png' }) }), 'downloaded')
  assert.deepEqual(app.calls.downloads, ['여행.png'])
  assert.equal(app.calls.shares.length, 0)
})
