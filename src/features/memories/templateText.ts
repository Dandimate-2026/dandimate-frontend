// AI가 엮은 템플릿 문장만 다듬는다. 인용한 원문은 그대로 보관하고 표시한다.
const PAIRS = ['은/는', '이/가', '을/를', '과/와', '으로/로'] as const
type ParticlePair = (typeof PAIRS)[number]
const BATCHIM_SOUNDS = new Set(['l', 'm', 'n', 'r', '0', '1', '3', '6', '7', '8'])

function particle(word: string, pair: ParticlePair) {
  const last = word.replace(/[\s'"’”」』)\]}]+$/gu, '').slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  const jong = code >= 0 && code <= 11171 ? code % 28 : BATCHIM_SOUNDS.has(last.toLowerCase()) ? 1 : 0
  const [withBatchim, withoutBatchim] = pair.split('/')
  // 길·서울처럼 ㄹ 받침으로 끝나면 '로'를 붙인다.
  return jong && !(pair === '으로/로' && (jong === 8 || /[l178]/i.test(last))) ? withBatchim : withoutBatchim
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const CITIES = ['경주', '안동', '대구', '포항', '영천']

export function formatTemplateText(text: string, names: readonly string[] = []) {
  // 은/는, 은(는), (은)는 등 양쪽 조사가 함께 남은 문구를 한쪽으로 정한다.
  let result = text.replace(/([^\s/()]+?)(은\/는|는\/은|이\/가|가\/이|을\/를|를\/을|과\/와|와\/과|으로\/로|로\/으로|은\(는\)|는\(은\)|이\(가\)|가\(이\)|을\(를\)|를\(을\)|과\(와\)|와\(과\)|\(은\)는|\(는\)은|\(이\)가|\(가\)이|\(을\)를|\(를\)을|\(으\)로)/gu, (_, word: string, marker: string) => {
    const pair = PAIRS.find(item => item.split('/').some(part => marker.includes(part)))
    return pair ? word + particle(word, pair) : word + marker
  })
  // 이름·지역명 바로 뒤의 조사만 고친다. 일반 단어나 원문을 일괄 치환하지 않는다.
  for (const name of new Set([...names, ...CITIES].map(value => value.trim()).filter(Boolean))) {
    const pattern = new RegExp(`(^|[\\s'"“‘(\\[{])(${escapeRegExp(name)})(으로|로|은|는|이|가|을|를|과|와)(?=$|[\\s.,!?…'"”’):;\\]}])`, 'gu')
    result = result.replace(pattern, (_, prefix: string, word: string, suffix: string) => {
      const pair = PAIRS.find(item => item.split('/').includes(suffix))!
      return prefix + word + particle(word, pair)
    })
  }
  return result
}
