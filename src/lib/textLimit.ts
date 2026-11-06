/** 붙여넣기·한글 조합·받아쓰기처럼 maxLength를 넘겨 들어오는 글도 제한 글자 수에서 잘라 낸다 */
export function clampText(value: string, max: number) {
  const chars = Array.from(value)
  return chars.length > max ? chars.slice(0, max).join('') : value
}
