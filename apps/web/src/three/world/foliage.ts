import * as THREE from 'three'
import type { Inst } from './instancing'
import { patchRuin, rng, type RuinUniform } from './ruinShader'

let leafTex: THREE.CanvasTexture | null = null

// A dense clump of broad tropical leaves with alpha, tinted per instance.
export function leafTexture() {
  if (leafTex) return leafTex
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const r = rng(907)
  ctx.clearRect(0, 0, S, S)
  for (let i = 0; i < 230; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * S * 0.42
    const x = S / 2 + Math.cos(a) * d
    const y = S / 2 + Math.sin(a) * d * 0.9
    const len = 26 + r() * 30
    const wid = len * (0.32 + r() * 0.16)
    const ang = a + (r() - 0.5) * 1.4
    const l = 30 + r() * 38
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.fillStyle = `hsl(${88 + r() * 30}, ${38 + r() * 26}%, ${l}%)`
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.quadraticCurveTo(0, -wid, len / 2, 0)
    ctx.quadraticCurveTo(0, wid, -len / 2, 0)
    ctx.fill()
    ctx.strokeStyle = `hsla(80, 30%, ${l + 18}%, 0.55)`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.lineTo(len / 2, 0)
    ctx.stroke()
    ctx.restore()
  }
  leafTex = new THREE.CanvasTexture(c)
  leafTex.colorSpace = THREE.SRGBColorSpace
  leafTex.anisotropy = 4
  return leafTex
}

// Three crossed quads with normals bent outward, so a clump shades like a soft volume.
export function clusterGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 3; k++) {
    const q = new THREE.PlaneGeometry(1, 1)
    if (k === 1) q.rotateY(Math.PI / 2)
    if (k === 2) q.rotateX(Math.PI / 2)
    parts.push(q)
  }
  const pos: number[] = []
  const uv: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let off = 0
  const v = new THREE.Vector3()
  for (const p of parts) {
    const a = p.attributes.position
    const u = p.attributes.uv
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i)
      pos.push(v.x, v.y, v.z)
      uv.push(u.getX(i), u.getY(i))
      const n = v.clone().multiplyScalar(1.2).add(new THREE.Vector3(0, 0.55, 0)).normalize()
      nor.push(n.x, n.y, n.z)
    }
    const ix = p.index!
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off)
    off += a.count
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

export const windTime = { value: 0 }

// Leaf material: alpha clumps, wind sway, grows wilder with ruin.
export function foliageMaterial(uRuin: RuinUniform, grow = 0.3, appear?: 'instance') {
  const m = patchRuin(
    new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82, color: '#ffffff' }),
    uRuin,
    appear ? { appear, grow: grow || undefined } : { grow, tint: { color: '#4a5a2a', amount: 0.18 } },
  )
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer)
    shader.uniforms.uWind = windTime
    shader.vertexShader = shader.vertexShader
      .replace('uniform float uRuin;', 'uniform float uRuin;\nuniform float uWind;')
      .replace(
        '#include <project_vertex>',
        `vec4 wBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uWind * 1.3 + wBase.x * 0.35 + wBase.z * 0.27) * 0.06 + sin(uWind * 3.1 + wBase.x) * 0.025;
transformed.x += sway * (transformed.y + 0.5);
transformed.z += sway * 0.6 * (transformed.y + 0.5);
#include <project_vertex>`,
      )
  }
  const prevKey = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${prevKey()}|wind`
  return m
}

// Canopy clumps distributed on a lumpy ellipsoid above a trunk.
export function canopyClusters(x: number, z: number, trunkH: number, spread: number, r: () => number, out: Inst[], density = 34) {
  const hue = 0.22 + r() * 0.07
  for (let k = 0; k < density; k++) {
    const a = r() * Math.PI * 2
    const u = r() * 2 - 1
    const rr = spread * (0.55 + r() * 0.5)
    const s = 1.5 + r() * 1.4
    const y = trunkH + spread * 0.55 + u * spread * 0.55
    out.push({
      p: [x + Math.cos(a) * rr * Math.sqrt(1 - u * u), y, z + Math.sin(a) * rr * Math.sqrt(1 - u * u)],
      r: [r() * 0.6, r() * 6.28, r() * 0.6],
      s,
      c: new THREE.Color().setHSL(hue + (r() - 0.5) * 0.05, 0.35 + r() * 0.2, 0.68 + r() * 0.16 + (u > 0 ? 0.08 : -0.1)),
    })
  }
}
