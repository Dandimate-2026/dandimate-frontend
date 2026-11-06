import { devProxyUrl } from '../../api/client'

export type DownloadFormat = 'image' | 'cards' | 'pdf'
export interface DownloadResult { blob: Blob; name: string }

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function capture(node: HTMLElement, square = false) {
  await document.fonts.ready
  const images = [...node.querySelectorAll('img')]
  await Promise.all(images.map(async (img) => {
    try { await img.decode() } catch { throw new Error('사진을 불러오지 못했어요. 사진이 표시된 뒤 다시 저장해 주세요.') }
    if (!img.naturalWidth) throw new Error('사진을 불러오지 못했어요.')
    // 외부 사진이 CORS로 누락된 채 성공 처리되는 것을 막는다.
    if (!img.src.startsWith('data:')) {
      // 화면의 <img>가 CORS 헤더 없이 먼저 캐시해 둔 사진을 fetch가 그대로 재사용하면 CORS 오류가 난다 → 캐시를 쓰지 않는다.
      // 로컬 개발에서는 S3가 localhost를 허용하지 않아서 개발 서버 프록시(/__s3)로 받는다
      const response = await fetch(devProxyUrl(img.src), { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error('사진 원본을 가져오지 못했어요.')
      const imageBlob = await response.blob()
      img.src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('사진을 이미지에 담지 못했어요.'))
        reader.readAsDataURL(imageBlob)
      })
      await img.decode()
    }
  }))
  const { toBlob } = await import('html-to-image')
  const height = node.scrollHeight
  const width = node.offsetWidth
  // 모바일 캔버스의 면적 한도 내에서 긴 두루마리 전체를 보존한다.
  const pixelRatio = Math.min(3, 16_000 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)))
  const blob = await toBlob(node, { pixelRatio, backgroundColor: getComputedStyle(node).backgroundColor, preferredFontFormat: 'woff2' })
  if (!blob?.size) throw new Error('이미지를 만들지 못했어요. 다시 시도해 주세요.')
  if (!square) return blob
  const image = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.max(image.width, image.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 이미지를 만들지 못했어요.')
    context.fillStyle = getComputedStyle(node).backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, (canvas.width - image.width) / 2, (canvas.height - image.height) / 2)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('카드 이미지를 만들지 못했어요.')), 'image/png'))
  } finally { image.close() }
}

export async function exportScroll(node: HTMLElement, cards: HTMLElement[], format: DownloadFormat, roomName: string): Promise<DownloadResult> {
  const name = (Array.from(roomName.replace(/[<>:"/\\|?*]/g, '')).filter((letter) => letter.charCodeAt(0) >= 32).join('').trim() || '두루마리').slice(0, 60)
  if (format === 'image') {
    const result = { blob: await capture(node), name: `${name}-두루마리.png` }
    downloadBlob(result.blob, result.name)
    return result
  }
  if (format === 'cards') {
    const { zipSync } = await import('fflate')
    const files: Record<string, Uint8Array> = {}
    for (const [index, card] of cards.entries()) {
      files[`${name}-${String(index + 1).padStart(2, '0')}.png`] = new Uint8Array(await (await capture(card, true)).arrayBuffer())
    }
    const archive = zipSync(files, { level: 0 })
    const result = { blob: new Blob([new Uint8Array(archive)], { type: 'application/zip' }), name: `${name}-사진별카드.zip` }
    downloadBlob(result.blob, result.name)
    return result
  }
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (const [index, card] of cards.entries()) {
    if (index) pdf.addPage()
    const blob = await capture(card)
    const image = await createImageBitmap(blob)
    try {
      const scale = Math.min(190 / image.width, 277 / image.height)
      pdf.addImage(new Uint8Array(await blob.arrayBuffer()), 'PNG', 10, 10, image.width * scale, image.height * scale)
    } finally { image.close() }
  }
  const result = { blob: pdf.output('blob'), name: `${name}-두루마리.pdf` }
  downloadBlob(result.blob, result.name)
  return result
}
