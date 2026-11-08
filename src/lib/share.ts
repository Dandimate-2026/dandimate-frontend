/**
 * 기기 공유 시트(휴대폰·Windows·macOS 공통)로 글과 링크를 보낸다.
 * 카톡을 고르면 복사·붙여넣기와 똑같이 링크가 눌린다.
 * 카카오 SDK를 사용할 수 없는 환경의 대체 공유 경로.
 * 공유 시트가 없거나 열리지 않으면 false → 호출하는 쪽에서 복사로 대신한다. 사용자가 취소한 경우는 true
 */
export async function shareWithDevice(text: string, url: string) {
  if (!navigator.share) return false
  try {
    // url을 따로 넘기면 일부 앱이 글을 버리므로 글 끝에 링크를 붙여 한 덩어리로 보낸다
    await navigator.share({ text: `${text}\n${url}` })
    return true
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError'
  }
}

/** 화면 아래에 잠깐 떴다 사라지는 안내 (어느 화면에서 불러도 된다) */
export function showToast(message: string) {
  const el = document.createElement('div')
  el.textContent = message
  el.setAttribute('role', 'status')
  el.style.cssText =
    'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:9999;max-width:340px;padding:10px 16px;border-radius:999px;background:rgba(42,38,35,.92);color:#fff;font-size:13px;text-align:center;pointer-events:none'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2400)
}

/**
 * 공유 시트를 못 여는 곳(카톡 안 브라우저 등)에서는 글+링크를 복사하고, 복사했다고 꼭 알려 준다.
 * 아무 반응이 없으면 버튼이 고장 난 것처럼 보이기 때문
 */
export async function copyForShare(text: string, url: string, message = '링크를 복사했어요. 단톡방에 붙여넣어 주세요') {
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    showToast(message)
  } catch {
    showToast('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요')
  }
}
