import { useEffect, useState } from 'react'
import { getCirculation } from '../api/memories'
import type { CirculationCard } from '../api/types'

type Who = { id: string | number; nickname: string }

const same = (a: Who, b: Who) => String(a.id) === String(b.id) || a.nickname === b.nickname

/**
 * 참여한 사진: 내가 올린 사진 + 내가 이야기(첫 한마디·덧붙이기)를 남긴 사진. 같은 사진은 한 번만 센다.
 * 패스는 참여가 아니다. 백엔드가 멤버별 참여 사진 수를 주기 전까지 둘러보기 데이터로 센다.
 */
export function participatedCards(cards: CirculationCard[], person: Who) {
  return cards.filter(
    (card) =>
      same(card.photo.uploader, person) ||
      [card.firstEntry, ...card.otherEntries].some((e) => e && same(e.member, person)),
  )
}

/** 참여율(0~1) = 참여한 사진 수 ÷ 방 전체 사진 수. 사진이 없으면 0 */
export function participationRate(cards: CirculationCard[], person: Who) {
  return cards.length === 0 ? 0 : participatedCards(cards, person).length / cards.length
}

/** 홈에서 한 번 불러와 핀 꽃·참여현황이 같이 쓴다. version이 바뀌면(홈 갱신) 다시 불러온다 */
export function useRoomCards(roomId: string, token: string | undefined, version: unknown) {
  const [cards, setCards] = useState<CirculationCard[] | null>(null)
  useEffect(() => {
    if (token === undefined) return
    let alive = true
    getCirculation(roomId, token)
      .then((list) => alive && setCards(list))
      .catch(() => alive && setCards([]))
    return () => { alive = false }
  }, [roomId, token, version])
  return cards
}
