import Button from './Button'

type PaymentStateProps =
  | { kind: 'processing' }
  | { kind: 'failed' | 'pending'; reason: string; orderId?: string; onRetry: () => void; onReturn: () => void }

/** 주문 요청과 토스 결제 결과에서 같은 상태 화면을 사용한다. */
function PaymentState(props: PaymentStateProps) {
  if (props.kind === 'processing') {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-bg px-[22px] pb-16 text-center text-ink" role="status" aria-live="polite">
        <div className="size-[52px] animate-spin rounded-full border-[5px] border-line border-t-point border-r-point border-b-point motion-reduce:animate-none" aria-hidden="true" />
        <h1 className="mt-[18px] text-[24px] leading-[30px] font-bold">결제를 확인하고 있어요</h1>
        <p className="mt-2 text-[13px] leading-[18px] text-sub">창을 닫거나 뒤로 가지 말아 주세요<br />보통 5초 안에 끝나요</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg px-[22px] pb-10 text-ink">
      <div className="flex flex-1 flex-col items-center justify-center pt-[100px] text-center">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#f7e4ec] text-[38px] leading-none text-point" aria-hidden="true">!</span>
        <h1 className="mt-4 text-[24px] leading-[30px] font-bold tracking-[-0.5px]">{props.kind === 'pending' ? '결제 결과를 확인 중이에요' : '결제가 완료되지 않았어요'}</h1>
        <p className="mt-2 text-[13px] leading-[18px] text-sub">{props.kind === 'pending'
          ? <>결제가 진행되었을 수 있어요<br />다시 결제하지 말고 결과를 확인해 주세요</>
          : <>돈은 빠져나가지 않았어요<br />다른 결제 수단으로 다시 시도해 보세요</>}</p>
        <dl className="mt-4 w-full rounded-[20px] border border-line bg-surface px-6 py-[14px] text-[12px] leading-[18px]">
          <div className="flex justify-between gap-4"><dt className="shrink-0 text-sub">사유</dt><dd className="text-right break-keep">{props.reason}</dd></div>
          <div className="mt-2 flex justify-between gap-4"><dt className="shrink-0 text-sub">주문 번호</dt><dd className="min-w-0 text-right break-all">{props.orderId || '—'}</dd></div>
        </dl>
      </div>
      <footer className="mx-[6px] flex flex-col gap-[10px] pt-8">
        <Button variant="outline" onClick={props.onReturn} className="h-[52px] w-full rounded-full border-0">방으로 돌아가기</Button>
        <Button onClick={props.onRetry} className="w-full">{props.kind === 'pending' ? '결제 결과 다시 확인' : '다시 결제하기'}</Button>
      </footer>
    </main>
  )
}

export default PaymentState
