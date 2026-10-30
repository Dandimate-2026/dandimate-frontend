/** '2026-10-17' → '2026.10.17' */
export function formatDate(isoDate: string) {
  return isoDate.replaceAll('-', '.')
}
