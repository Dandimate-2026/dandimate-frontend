/**
 * 휴대폰 기기 공유 시트로 글과 링크를 보낸다 (카톡을 고르면 복사·붙여넣기와 똑같이 링크가 눌린다).
 * (그림 카드 대신 이 방식만 쓴다: 카드는 카카오 콘솔 도메인 등록 없이는 링크가 빠진다)
 * 터치 기기가 아니거나 공유 시트가 없으면 false. 사용자가 공유를 취소해도 true(다른 방법으로 다시 열지 않는다)
 */
export async function shareWithDevice(text: string, url: string) {
  const touch = window.matchMedia?.('(pointer: coarse)').matches
  if (!touch || !navigator.share) return false
  try {
    // url을 따로 넘기면 일부 앱이 글을 버리므로 글 끝에 링크를 붙여 한 덩어리로 보낸다
    await navigator.share({ text: `${text}
${url}` })
  } catch {
    // 취소
  }
  return true
}
