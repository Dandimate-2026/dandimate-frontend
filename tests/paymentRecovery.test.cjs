const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code } }
const code = ts.transpileModule(fs.readFileSync('src/lib/paymentRecovery.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {}, require: name => name.endsWith('/client') ? { ApiError } : {}, setTimeout }
vm.runInNewContext(code, context)
const { recoverPayment } = context.exports
const input = { orderId: 'order-1', paymentKey: 'test-payment-key', amount: 1000, allowConfirm: true }
const order = status => ({ orderId: input.orderId, status, amount: 1000 })

test('이미 완료된 주문은 승인 API를 다시 호출하지 않는다', async () => {
  let confirmed = 0
  const result = await recoverPayment(input, { getOrder: async () => order('DONE'), confirm: async () => { confirmed++ }, wait: async () => {} })
  assert.equal(result.status, 'DONE'); assert.equal(confirmed, 0)
})
test('승인 대기 주문만 한 번 승인한다', async () => {
  let confirmed = 0
  const result = await recoverPayment(input, { getOrder: async () => order('READY'), confirm: async body => { confirmed++; assert.equal(body.amount, 1000); return order('DONE') }, wait: async () => {} })
  assert.equal(result.status, 'DONE'); assert.equal(confirmed, 1)
})
test('처리 중 주문은 승인하지 않고 조회로 완료를 확인한다', async () => {
  let queries = 0, confirmed = 0
  const result = await recoverPayment(input, { getOrder: async () => order(++queries === 1 ? 'PROCESSING' : 'DONE'), confirm: async () => { confirmed++ }, wait: async () => {} })
  assert.equal(result.status, 'DONE'); assert.equal(queries, 2); assert.equal(confirmed, 0)
})
test('승인 응답이 끊겨도 서버 주문이 완료됐다면 성공으로 복구한다', async () => {
  let queries = 0, confirmed = 0
  const result = await recoverPayment(input, { getOrder: async () => order(++queries === 1 ? 'READY' : 'DONE'), confirm: async () => { confirmed++; throw Error('network') }, wait: async () => {} })
  assert.equal(result.status, 'DONE'); assert.equal(confirmed, 1)
})
test('금액 불일치는 승인 전에 차단한다', async () => {
  let confirmed = 0
  await assert.rejects(recoverPayment({ ...input, amount: 500 }, { getOrder: async () => order('READY'), confirm: async () => { confirmed++ }, wait: async () => {} }), error => error.code === 'PAYMENT_AMOUNT_MISMATCH')
  assert.equal(confirmed, 0)
})
test('실패 복귀 또는 승인 정보 누락 시 임의로 승인하지 않는다', async () => {
  let confirmed = 0
  for (const recovery of [{ ...input, allowConfirm: false }, { orderId: input.orderId, allowConfirm: true }]) {
    const result = await recoverPayment(recovery, { getOrder: async () => order('READY'), confirm: async () => { confirmed++ }, wait: async () => {} })
    assert.equal(result.status, 'READY')
  }
  assert.equal(confirmed, 0)
})
test('조회 후에도 확정되지 않은 결제는 실패나 성공으로 단정하지 않는다', async () => {
  await assert.rejects(recoverPayment(input, { getOrder: async () => order('PROCESSING'), confirm: async () => { throw Error('must not confirm') }, wait: async () => {} }), error => error.code === 'PAYMENT_UNCERTAIN')
})
