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
