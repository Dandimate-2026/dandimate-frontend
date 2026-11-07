// 기본 미니멀 템플릿 그림 (종이 질감 + 봉). 지역·특별 템플릿은 assets/templates의 그림을 쓴다.
const flower = (x: number, y: number, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="#cc5783"><circle cx="-7" cy="-5" r="7"/><circle cx="5" cy="-8" r="7"/><circle cx="10" cy="3" r="7"/><circle cx="0" cy="10" r="7"/><circle cx="-10" cy="5" r="7"/><circle r="3" fill="#ead083"/></g>`

const scenes = {
  minimal: '<rect x="128" y="44" width="104" height="152" fill="#fffdf7"/><rect x="104" y="30" width="152" height="18" rx="9" fill="#302b26"/><rect x="92" y="27" width="20" height="24" rx="9" fill="#79523b"/><rect x="248" y="27" width="20" height="24" rx="9" fill="#79523b"/><rect x="104" y="192" width="152" height="18" rx="9" fill="#302b26"/><rect x="92" y="189" width="20" height="24" rx="9" fill="#79523b"/><rect x="248" y="189" width="20" height="24" rx="9" fill="#79523b"/>' + flower(180, 120, 1.6),
}
const backgrounds = { minimal: '#eee8dd' }

export function templateArt(id: keyof typeof scenes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240"><defs><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".17"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#paper)"><path fill="${backgrounds[id]}" d="M0 0H360V240H0Z"/>${scenes[id]}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
