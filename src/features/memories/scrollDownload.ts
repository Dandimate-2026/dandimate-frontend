import { devProxyUrl } from '../../api/client'

export type DownloadFormat = 'image' | 'cards' | 'pdf'
export interface DownloadFile { blob: Blob; name: string }
export interface DownloadResult extends DownloadFile { files?: DownloadFile[] }

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 300_000)
}

/** 준비가 끝난 파일을 사용자가 누른 이벤트 안에서 바로 전달한다. */
export async function saveDownload(file: DownloadFile) {
  const nativeFile = new File([file.blob], file.name, { type: file.blob.type })
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios && navigator.canShare?.({ files: [nativeFile] })) {
    await navigator.share({ files: [nativeFile] })
    return 'shared' as const
  }
  downloadBlob(file.blob, file.name)
  return 'downloaded' as const
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = window.setTimeout(() => {
      image.onload = image.onerror = null
      image.src = ''
      reject(new Error('사진을 불러오는 시간이 길어지고 있어요. 다시 시도해 주세요.'))
    }, 20_000)
    image.onload = () => {
      window.clearTimeout(timer)
      if (image.naturalWidth) resolve(image)
      else reject(new Error('사진을 읽지 못했어요.'))
    }
    image.onerror = () => { window.clearTimeout(timer); reject(new Error('사진을 읽지 못했어요. 다시 시도해 주세요.')) }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob?.size
    ? resolve(blob) : reject(new Error('이미지를 만들지 못했어요. 사진별 저장을 이용해 주세요.')), 'image/png'))
}

/** WebKit의 SVG 내 이미지 누락을 피하도록 사진은 캔버스에 직접 그린다. */
async function capture(node: HTMLElement, images: Map<string, Promise<HTMLImageElement>>, fontEmbedCSS: string, square = false) {
  const clone = node.cloneNode(true) as HTMLElement
  node.parentElement!.append(clone)
  const canvases: HTMLCanvasElement[] = []
  try {
    const pictures = await Promise.all([...clone.querySelectorAll('img')].map(async (img) => {
      const url = img.currentSrc || img.src
      if (!images.has(url)) images.set(url, (async () => {
        const response = await fetch(devProxyUrl(url), { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw new Error('사진 원본을 가져오지 못했어요. 모든 사진을 불러온 뒤 다시 시도해 주세요.')
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        try { return await loadImage(objectUrl) }
        finally { URL.revokeObjectURL(objectUrl) }
      })())
      const image = await images.get(url)!
      // 크기만 유지하고, 실제 사진은 아래에서 native drawImage로 넣는다.
      const box = img.getBoundingClientRect()
      img.style.width = `${box.width}px`
      img.style.height = `${box.height}px`
      img.style.opacity = '0'
      img.removeAttribute('srcset')
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
      return { img, image }
    }))
    const width = clone.offsetWidth
    const height = clone.scrollHeight
    if (!width || !height) throw new Error('저장할 두루마리의 크기를 확인하지 못했어요.')
    // 긴 이미지와 정사각 카드 모두 변 길이와 총 픽셀 수를 제한한다.
    const side = square ? Math.max(width, height) : 0
    const pixelRatio = Math.min(2, 16_000 / Math.max(width, height), Math.sqrt(4_000_000 / (side ? side * side : width * height)))
    const { toCanvas } = await import('html-to-image')
    const backgroundColor = getComputedStyle(clone).backgroundColor
    const canvas = await toCanvas(clone, { width, height, pixelRatio, backgroundColor, fontEmbedCSS, skipAutoScale: true })
    canvases.push(canvas)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 이미지를 만들지 못했어요.')
    const bounds = clone.getBoundingClientRect()
    context.save()
    context.scale(canvas.width / width, canvas.height / height)
    for (const { img, image } of pictures) {
      const box = img.getBoundingClientRect()
      const x = box.left - bounds.left, y = box.top - bounds.top
      const style = getComputedStyle(img)
      const parentStyle = img.parentElement ? getComputedStyle(img.parentElement) : style
      const radius = parseFloat(style.borderRadius) || parseFloat(parentStyle.borderRadius) || 0
      context.save()
      context.beginPath()
      context.roundRect(x, y, box.width, box.height, radius)
      context.clip()
      if (style.objectFit === 'cover') {
        const ratio = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight)
        const sw = box.width / ratio, sh = box.height / ratio
        context.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, box.width, box.height)
      } else context.drawImage(image, x, y, box.width, box.height)
      context.restore()
    }
    context.restore()
    if (!square) return await canvasBlob(canvas)
    const card = document.createElement('canvas')
    canvases.push(card)
    card.width = card.height = Math.max(canvas.width, canvas.height)
    const cardContext = card.getContext('2d')
    if (!cardContext) throw new Error('카드 이미지를 만들지 못했어요.')
    cardContext.fillStyle = backgroundColor
    cardContext.fillRect(0, 0, card.width, card.height)
    cardContext.drawImage(canvas, (card.width - canvas.width) / 2, (card.height - canvas.height) / 2)
    return await canvasBlob(card)
  } finally {
    clone.remove()
    // 카드·PDF를 연속 생성할 때 모바일에 이전 캔버스 메모리가 쌓이지 않게 한다.
    for (const canvas of canvases) canvas.width = canvas.height = 0
  }
}

/** 생성만 수행한다. 다운로드/공유는 준비 완료 후 별도의 사용자 클릭으로 실행한다. */
export async function exportScroll(node: HTMLElement, cards: HTMLElement[], format: DownloadFormat, roomName: string): Promise<DownloadResult> {
  if (!node || !cards.length) throw new Error('저장할 사진이 없어요.')
  await document.fonts.ready
  const { getFontEmbedCSS } = await import('html-to-image')
  const fontEmbedCSS = await getFontEmbedCSS(node, { preferredFontFormat: 'woff2' })
  const images = new Map<string, Promise<HTMLImageElement>>()
  const name = (Array.from(roomName.replace(/[<>:"/\\|?*]/g, '')).filter((letter) => letter.charCodeAt(0) >= 32).join('').trim() || '두루마리').slice(0, 60)
  if (format === 'image') return { blob: await capture(node, images, fontEmbedCSS), name: `${name}-두루마리.png` }
  if (format === 'cards') {
    const { zipSync } = await import('fflate')
    const archiveFiles: Record<string, Uint8Array> = {}
    const files: DownloadFile[] = []
    for (const [index, card] of cards.entries()) {
      const file = { blob: await capture(card, images, fontEmbedCSS, true), name: `${name}-${String(index + 1).padStart(2, '0')}.png` }
      files.push(file)
      archiveFiles[file.name] = new Uint8Array(await file.blob.arrayBuffer())
    }
    const archive = zipSync(archiveFiles, { level: 0 })
    return { blob: new Blob([new Uint8Array(archive)], { type: 'application/zip' }), name: `${name}-사진별카드.zip`, files }
  }
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (const [index, card] of cards.entries()) {
    if (index) pdf.addPage()
    const blob = await capture(card, images, fontEmbedCSS)
    const url = URL.createObjectURL(blob)
    try {
      const image = await loadImage(url)
      const scale = Math.min(190 / image.naturalWidth, 277 / image.naturalHeight)
      pdf.addImage(new Uint8Array(await blob.arrayBuffer()), 'PNG', 10, 10, image.naturalWidth * scale, image.naturalHeight * scale)
    } finally { URL.revokeObjectURL(url) }
  }
  return { blob: pdf.output('blob'), name: `${name}-두루마리.pdf` }
}
