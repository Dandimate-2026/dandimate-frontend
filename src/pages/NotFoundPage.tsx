function NotFoundPage({ message = '페이지를 찾을 수 없어요' }: { message?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center bg-bg text-ink justify-center px-5 text-center">
      <p className="text-[17px] font-bold">{message}</p>
      <p className="mt-2 text-[13px] text-sub">링크를 다시 확인해 주세요.</p>
    </main>
  )
}

export default NotFoundPage
