import type { FlowerCode } from '../api/types'
import Flower, { EmptySlot } from './Flower'

/** 한 줄에 보여줄 자리 수. 넘치면 마지막 자리를 +N으로 바꾼다 */
const MAX_SLOTS = 8

type Slot = { id: string | number; flowerCode: FlowerCode; bloomed: boolean }

/**
 * 오늘 핀 꽃: 방 사람마다 한 자리.
 * 오늘(한국 시간) 이야기·덧붙이기를 남긴 사람은 그 사람 꽃으로 채우고, 아직 아무것도 없으면 점선 동그라미로 둔다.
 * 사람이 MAX_SLOTS를 넘으면 마지막 칸에 +N(못 보여준 사람 수)을 보여준다. 핀 꽃이 앞에 온다.
 * 확인용: 주소 끝에 ?flowersDemo=12 를 붙이면 가짜 사람 12명(절반은 꽃 핌)을 더해서 보여준다.
 */
export function TodayFlowers({
  members,
  flowers,
}: {
  members: { id: string | number; flowerCode: FlowerCode }[]
  flowers: { memberId: string | number }[]
}) {
  const bloomedIds = new Set(flowers.map((f) => String(f.memberId)))
  const slots: Slot[] = members.map((m) => ({ id: m.id, flowerCode: m.flowerCode, bloomed: bloomedIds.has(String(m.id)) }))

  const demo = Number(new URLSearchParams(window.location.search).get('flowersDemo') ?? 0)
  const DEMO_CODES: FlowerCode[] = ['AZALEA', 'FORSYTHIA', 'ROYAL_AZALEA', 'CANOLA', 'LILAC', 'FORGET_ME_NOT', 'TEAL', 'PURPLE']
  for (let i = 0; i < demo; i++) slots.push({ id: `demo-${i}`, flowerCode: DEMO_CODES[i % 8], bloomed: i % 2 === 0 })

  slots.sort((a, b) => Number(b.bloomed) - Number(a.bloomed))
  const overflow = slots.length > MAX_SLOTS
  const shown = overflow ? slots.slice(0, MAX_SLOTS - 1) : slots
  const hidden = slots.length - shown.length

  return (
    <ul className="mt-2 flex flex-wrap items-center gap-[5px]">
      {shown.map((s) => (
        <li key={s.id}>{s.bloomed ? <Flower code={s.flowerCode} /> : <EmptySlot />}</li>
      ))}
      {overflow && (
        <li
          className="flex size-[30px] items-center justify-center rounded-full bg-[#e3dcd1] text-[11px] font-bold text-sub"
          aria-label={`${hidden}명 더`}
        >
          +{hidden}
        </li>
      )}
    </ul>
  )
}
