import * as THREE from 'three'
import { rng } from './ruinShader'

type Ctx = CanvasRenderingContext2D

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function tex(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = opts.aniso ?? 8
  t.needsUpdate = true
  return t
}

function noise(ctx: Ctx, w: number, h: number, r: () => number, amount: number, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = r() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
  }
}

function blot(ctx: Ctx, x: number, y: number, rad: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, rad, 0, Math.PI * 2)
  ctx.fill()
}

function tiles() {
  const S = 1024
  const [c, ctx] = canvas(S, S)
  const r = rng(11)
  const n = 8
  const t = S / n
  ctx.fillStyle = '#8f877a'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const l = 63 + r() * 10
      ctx.fillStyle = `hsl(${36 + r() * 8}, ${10 + r() * 8}%, ${l}%)`
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6)
      if (r() > 0.6) blot(ctx, i * t + r() * t, j * t + r() * t, 20 + r() * 40, 'rgba(90,80,65,0.12)')
    }
  noise(ctx, S, S, r, 26000, 0.12)
  return tex(c)
}

function ruinOverlay() {
  const S = 1024
  const [c, ctx] = canvas(S, S)
  const r = rng(23)
  for (let i = 0; i < 70; i++) blot(ctx, r() * S, r() * S, 30 + r() * 110, `rgba(${60 + r() * 30},${48 + r() * 20},${30},${0.35 + r() * 0.3})`)
  for (let i = 0; i < 45; i++) blot(ctx, r() * S, r() * S, 14 + r() * 60, `rgba(${55 + r() * 30},${90 + r() * 40},${35},${0.45 + r() * 0.35})`)
  ctx.lineCap = 'round'
  for (let i = 0; i < 60; i++) {
    let x = r() * S
    let y = r() * S
    let a = r() * Math.PI * 2
    ctx.strokeStyle = `rgba(20,16,12,${0.55 + r() * 0.3})`
    ctx.lineWidth = 1 + r() * 2.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 8 + r() * 20
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 1.2
      x += Math.cos(a) * 12
      y += Math.sin(a) * 12
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  return tex(c)
}

function asphalt() {
  const S = 512
  const [c, ctx] = canvas(S, S)
  const r = rng(5)
  ctx.fillStyle = '#4a4845'
  ctx.fillRect(0, 0, S, S)
  noise(ctx, S, S, r, 40000, 0.18)
  for (let i = 0; i < 12; i++) blot(ctx, r() * S, r() * S, 20 + r() * 50, 'rgba(25,22,20,0.25)')
  return tex(c)
}

// One 4 m bay of the Palacio facade, full height: black and white bands with pointed arch windows.
function palacioBay() {
  const W = 256
  const H = 1408
  const [c, ctx] = canvas(W, H)
  const r = rng(31)
  const band = H / 28
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#e9e5da' : '#1d1d20'
    ctx.fillRect(0, i * band, W, band + 1)
  }
  noise(ctx, W, H, r, 9000, 0.1)
  const arch = (cx: number, top: number, w: number, h: number) => {
    ctx.beginPath()
    ctx.moveTo(cx - w / 2, top + h)
    ctx.lineTo(cx - w / 2, top + w * 0.6)
    ctx.quadraticCurveTo(cx - w / 2, top, cx, top - w * 0.25)
    ctx.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + w * 0.6)
    ctx.lineTo(cx + w / 2, top + h)
    ctx.closePath()
  }
  const floors = [
    { top: 130, h: 240, w: 96 },
    { top: 520, h: 260, w: 104 },
    { top: 930, h: 330, w: 120 },
  ]
  for (const f of floors) {
    ctx.fillStyle = '#d8d2c2'
    arch(W / 2, f.top - 10, f.w + 22, f.h + 20)
    ctx.fill()
    const g = ctx.createLinearGradient(0, f.top, 0, f.top + f.h)
    g.addColorStop(0, '#2c3a44')
    g.addColorStop(1, '#151b20')
    ctx.fillStyle = g
    arch(W / 2, f.top, f.w, f.h)
    ctx.fill()
    ctx.strokeStyle = 'rgba(220,214,200,0.8)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(W / 2, f.top - 18)
    ctx.lineTo(W / 2, f.top + f.h)
    ctx.moveTo(W / 2 - f.w / 2, f.top + f.h * 0.45)
    ctx.lineTo(W / 2 + f.w / 2, f.top + f.h * 0.45)
    ctx.stroke()
  }
  ctx.fillStyle = '#cfc8b6'
  ctx.fillRect(0, 0, W, 26)
  ctx.fillRect(0, 455, W, 18)
  ctx.fillRect(0, 865, W, 18)
  return tex(c)
}

function stripes(bands: number, dark = '#1d1d20', light = '#e9e5da') {
  const [c, ctx] = canvas(64, 512)
  const b = 512 / bands
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? light : dark
    ctx.fillRect(0, i * b, 64, b + 1)
  }
  noise(ctx, 64, 512, rng(3), 2500, 0.1)
  return tex(c)
}

// One 4 m bay of the Museo: brick with an art deco window column.
function brickBay() {
  const W = 256
  const H = 1152
  const [c, ctx] = canvas(W, H)
  const r = rng(41)
  ctx.fillStyle = '#7b4a35'
  ctx.fillRect(0, 0, W, H)
  const bh = 12
  const bw = 34
  for (let y = 0; y < H; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0
    for (let x = -bw; x < W + bw; x += bw) {
      ctx.fillStyle = `hsl(${12 + r() * 10}, ${48 + r() * 14}%, ${36 + r() * 12}%)`
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2)
    }
  }
  noise(ctx, W, H, r, 12000, 0.1)
  ctx.fillStyle = '#d9c3a0'
  ctx.fillRect(0, 0, W, 40)
  ctx.fillRect(0, H - 60, W, 60)
  const rows = [110, 330, 550, 770]
  for (const top of rows) {
    ctx.fillStyle = '#d9c3a0'
    ctx.fillRect(W / 2 - 62, top - 12, 124, 168)
    const g = ctx.createLinearGradient(0, top, 0, top + 144)
    g.addColorStop(0, '#34413f')
    g.addColorStop(1, '#161c1c')
    ctx.fillStyle = g
    ctx.fillRect(W / 2 - 50, top, 100, 144)
    ctx.fillStyle = 'rgba(217,195,160,0.9)'
    ctx.fillRect(W / 2 - 2, top, 4, 144)
    ctx.fillRect(W / 2 - 50, top + 46, 100, 4)
    ctx.fillRect(W / 2 - 50, top + 96, 100, 4)
  }
  return tex(c)
}

// City facade tile (one floor, 4 m) and its emissive window map.
function cityFacade() {
  const W = 128
  const H = 128
  const [c, ctx] = canvas(W, H)
  const [ce, cte] = canvas(W, H)
  const r = rng(51)
  ctx.fillStyle = '#f2efe8'
  ctx.fillRect(0, 0, W, H)
  noise(ctx, W, H, r, 2500, 0.12)
  cte.fillStyle = '#000'
  cte.fillRect(0, 0, W, H)
  for (let i = 0; i < 2; i++) {
    const x = 14 + i * 60
    ctx.fillStyle = '#26303a'
    ctx.fillRect(x, 34, 40, 60)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x, 34, 40, 14)
    if (i === 0) {
      cte.fillStyle = '#ffb35c'
      cte.fillRect(x, 34, 40, 60)
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 110, W, 18)
  return [tex(c), tex(ce)] as const
}

function ivy() {
  const S = 256
  const [c, ctx] = canvas(S, S)
  const r = rng(61)
  for (let i = 0; i < 420; i++) {
    const x = S / 2 + (r() - 0.5) * S * 0.9 * Math.sqrt(r())
    const y = S * 0.08 + r() * S * 0.88
    const edge = Math.abs(x - S / 2) / (S / 2)
    if (r() < edge * 0.9) continue
    ctx.fillStyle = `hsl(${85 + r() * 40}, ${35 + r() * 25}%, ${16 + r() * 22}%)`
    ctx.beginPath()
    ctx.ellipse(x, y, 4 + r() * 7, 3 + r() * 5, r() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  return tex(c, { repeat: false })
}

export function textTexture(lines: string[], opts: { w?: number; h?: number; bg: string; fg: string; font?: string; stroke?: string; rough?: boolean }) {
  const W = opts.w ?? 512
  const H = opts.h ?? 160
  const [c, ctx] = canvas(W, H)
  const r = rng(lines.join('').length * 7)
  ctx.fillStyle = opts.bg
  ctx.fillRect(0, 0, W, H)
  if (opts.rough) {
    noise(ctx, W, H, r, W * H * 0.02, 0.12)
    for (let i = 0; i < 6; i++) blot(ctx, r() * W, r() * H, 20 + r() * 40, 'rgba(0,0,0,0.12)')
  }
  ctx.fillStyle = opts.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const size = Math.floor((H / lines.length) * 0.62)
  ctx.font = opts.font ?? `900 ${size}px Impact, "Arial Black", sans-serif`
  lines.forEach((line, i) => {
    let fs = size
    while (ctx.measureText(line).width > W * 0.9 && fs > 10) {
      fs -= 2
      ctx.font = `900 ${fs}px Impact, "Arial Black", sans-serif`
    }
    const y = (H / lines.length) * (i + 0.5)
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke
      ctx.lineWidth = 6
      ctx.strokeText(line, W / 2, y)
    }
    ctx.fillText(line, W / 2 + (opts.rough ? (r() - 0.5) * 6 : 0), y)
  })
  return tex(c, { repeat: false })
}

function flagColombia() {
  const [c, ctx] = canvas(256, 170)
  ctx.fillStyle = '#fcd116'
  ctx.fillRect(0, 0, 256, 85)
  ctx.fillStyle = '#003893'
  ctx.fillRect(0, 85, 256, 43)
  ctx.fillStyle = '#ce1126'
  ctx.fillRect(0, 128, 256, 42)
  return tex(c, { repeat: false })
}

// Alpha noise for tattering: higher alphaTest eats more of the cloth.
function tatter() {
  const S = 128
  const [c, ctx] = canvas(S, S)
  const r = rng(71)
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const edge = x / S
      const v = 1 - edge * 0.55 - r() * 0.45
      const i = (y * S + x) * 4
      const b = Math.max(0, Math.min(255, v * 255))
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  return tex(c, { srgb: false, repeat: false })
}

function soft() {
  const [c, ctx] = canvas(64, 64)
  blot(ctx, 32, 32, 32, 'rgba(255,255,255,1)')
  return tex(c, { repeat: false })
}

export function createWorldTextures() {
  const [facade, facadeEmissive] = cityFacade()
  const t = {
    tiles: tiles(),
    ruin: ruinOverlay(),
    asphalt: asphalt(),
    palacio: palacioBay(),
    palacioSide: palacioBay(),
    domeStripes: stripes(14),
    towerStripes: stripes(28),
    brick: brickBay(),
    brickSide: brickBay(),
    facade,
    facadeEmissive,
    ivy: ivy(),
    flag: flagColombia(),
    tatter: tatter(),
    soft: soft(),
    signBiblioteca: textTexture(['BIBLIOTECA'], { bg: '#f1e6c8', fg: '#1d2b53', rough: true }),
    signBienestar: textTexture(['BIENESTAR'], { bg: '#e8f0d8', fg: '#2b5a2b', rough: true }),
    signTesoreria: textTexture(['TESORERÍA'], { bg: '#f6d9a8', fg: '#7a1e12', rough: true }),
    bannerParo: textTexture(['¡PARO INDEFINIDO!'], { w: 1024, h: 200, bg: '#c81f2e', fg: '#fff6e8', rough: true }),
    bannerExilio: textTexture(['UNIVERSIDAD', 'EN EL EXILIO'], { w: 512, h: 220, bg: '#efe6d2', fg: '#1b1b1b', rough: true }),
    museoBanner1: textTexture(['MUSEO', 'DE', 'ANTIOQUIA'], { w: 160, h: 512, bg: '#1f3b57', fg: '#f4efe1' }),
    museoBanner2: textTexture(['VOLUMEN', 'Y', 'FORMA'], { w: 160, h: 512, bg: '#b8432f', fg: '#f4efe1' }),
  }
  return {
    ...t,
    dispose: () => Object.values(t).forEach((x) => x.dispose()),
  }
}

export type WorldTextures = ReturnType<typeof createWorldTextures>
