// 덧붙이기·답가를 쓰다가 저장하지 않고 나가도 이 기기에 남겨 두었다가, 다시 열면 이어서 쓰게 한다
const key = (draftKey: string) => `duruduru:entry-draft:${draftKey}`

export function readDraft(draftKey: string | undefined): string {
  if (!draftKey) return ''
  try {
    return localStorage.getItem(key(draftKey)) ?? ''
  } catch {
    return ''
  }
}

export function writeDraft(draftKey: string | undefined, text: string) {
  if (!draftKey) return
  try {
    if (text.trim()) localStorage.setItem(key(draftKey), text)
    else localStorage.removeItem(key(draftKey))
  } catch {
    // 저장하지 못해도 지금 쓰는 글은 그대로 있다
  }
}
