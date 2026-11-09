import { prepareKakaoShare, shareKakaoInvitation } from './kakaoShare'

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

export type RoomShareContext = 'invite' | 'collecting' | 'circulating' | 'weaving' | 'completed' | 'plan' | 'photo'

export function roomShareCopy(context: RoomShareContext, roomName: string) {
  const name = roomName || '우리 모임방'
  const copies = {
    invite: { title: '💌 두루두루에 초대됐어요!', text: `${name} 두루마리 같이 채우자! 사진 올리고 한마디 남겨줘`, button: '모임방 참여하기' },
    collecting: { title: '📷 우리 추억을 모으고 있어요', text: `${name}에 함께 찍은 사진과 첫 한마디를 남겨 주세요. 우리 추억을 두루마리로 엮어요!`, button: '사진 남기러 가기' },
    circulating: { title: '🌷 친구들의 사진이 기다려요', text: `${name}에 모인 사진을 둘러보고 기억나는 이야기를 덧붙여 주세요!`, button: '친구 사진 둘러보기' },
    weaving: { title: '🧵 우리 두루마리를 엮고 있어요', text: `${name}의 사진과 이야기가 하나의 두루마리로 엮이고 있어요. 완성되면 함께 읽어요!`, button: '엮는 중 확인하기' },
    completed: { title: '📜 우리 두루마리가 완성됐어요!', text: `${name}에서 함께 남긴 사진과 이야기를 펼쳐 보세요. 우리 추억이 한 권으로 엮였어요.`, button: '두루마리 펼쳐 보기' },
    plan: { title: '✨ 모임방 플랜이 바뀌었어요', text: `${name}의 플랜을 변경했어요. 모임방에서 새 한도를 확인해 주세요!`, button: '바뀐 플랜 확인하기' },
    photo: { title: '📷 함께 남긴 사진을 보내요', text: `${name}의 사진과 이야기를 함께 보세요.`, button: '사진과 이야기 보기' },
  }
  return copies[context]
}

export async function shareRoomContent(context: RoomShareContext, roomName: string, url: string, customMessage?: string) {
  const copy = roomShareCopy(context, roomName)
  const text = customMessage?.trim() || copy.text
  const fallback = async () => {
    if (await shareWithDevice(`${copy.title}\n\n${text}\n`, url)) return
    await copyForShare(`${copy.title}\n\n${text}\n`, url, '공유 문구와 링크를 복사했어요. 카카오톡에 붙여넣어 주세요')
  }
  try {
    const result = shareKakaoInvitation(text, url, copy.title, copy.button)
    if (result === 'opened') return
    if (result === 'loading') {
      try { await prepareKakaoShare(); showToast('카카오톡 공유가 준비됐어요. 버튼을 다시 눌러 주세요') }
      catch { await fallback() }
      return
    }
  } catch { await fallback(); return }
  await fallback()
}
