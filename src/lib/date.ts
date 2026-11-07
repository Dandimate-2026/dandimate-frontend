/** '2026-10-17' → '2026.10.17' */
export function formatDate(isoDate: string) {
  return isoDate.replaceAll('-', '.')
}

/** '2026-10-31' → '2026. 10. 31' */
export function formatDateSpaced(isoDate: string) {
  return isoDate.replaceAll('-', '. ')
}

/** 기기 시간대 기준 오늘 날짜 ('2026-10-31') */
export function todayIsoDate() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** ISO 시각 → 'MM월 DD일 HH:mm' (기기 시간대) */
export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** ISO 시각 → datetime-local 입력값 ('2026-10-31T21:00') */
export function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 얼마 전인지 ('방금', '5분 전', '3시간 전', '2일 전') */
export function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/** 두루마리를 엮을 수 있는 가장 늦은 시각: 방을 만든 때(모르면 지금)로부터 1년. 방은 1년 뒤 지워진다 */
export function latestDeadline(createdAt?: string) {
  const d = createdAt ? new Date(createdAt) : new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d
}
