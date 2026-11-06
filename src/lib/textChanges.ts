export interface TextChange {
  text: string
  changed: boolean
}

function append(parts: TextChange[], text: string, changed: boolean) {
  if (!text) return
  const previous = parts.at(-1)
  if (previous?.changed === changed) previous.text += text
  else parts.push({ text, changed })
}

/** 새 본문에 남아 있는 추가·수정 부분만 표시한다. 삭제된 문장은 이전 버전에서 확인한다. */
export function highlightTextChanges(previous: string, current: string): TextChange[] {
  if (previous === current) return [{ text: current, changed: false }]
  const before = previous.match(/\s+|[\p{L}\p{N}\p{M}_]+|[^\s]/gu) ?? []
  const after = current.match(/\s+|[\p{L}\p{N}\p{M}_]+|[^\s]/gu) ?? []

  // 긴 원문도 화면을 멈추게 하지 않도록 비교 크기를 제한한다.
  if (before.length * after.length > 250_000) {
    const oldLetters = Array.from(previous)
    const letters = Array.from(current)
    let start = 0
    let end = 0
    while (start < Math.min(oldLetters.length, letters.length) && oldLetters[start] === letters[start]) start++
    while (end < Math.min(oldLetters.length, letters.length) - start && oldLetters.at(-1 - end) === letters.at(-1 - end)) end++
    return [
      { text: letters.slice(0, start).join(''), changed: false },
      { text: letters.slice(start, letters.length - end).join(''), changed: true },
      { text: end ? letters.slice(-end).join('') : '', changed: false },
    ].filter((part) => part.text)
  }

  const width = after.length + 1
  const lengths = new Uint32Array((before.length + 1) * width)
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * width + j] = before[i] === after[j]
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }
  const parts: TextChange[] = []
  let i = 0
  let j = 0
  while (j < after.length) {
    if (i < before.length && before[i] === after[j]) {
      append(parts, after[j++], false)
      i++
    } else if (i < before.length && lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) i++
    else append(parts, after[j++], true)
  }
  return parts
}
