import * as THREE from 'three'

// Material classes used by vertex-colored skinned meshes; shared by every character.
export const MAT_SKIN = 0
export const MAT_CLOTH = 1
export const MAT_LEATHER = 2

let shared: THREE.Material[] | null = null

export function bodyMaterials(): THREE.Material[] {
  if (shared) return shared
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0,
    sheen: 0.45,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ff9b7d'),
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    specularIntensity: 0.55,
  })
  const cloth = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#6d6d6d'),
    specularIntensity: 0.25,
  })
  const leather = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.36,
    metalness: 0.05,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
  })
  shared = [skin, cloth, leather]
  return shared
}

const hairCache = new Map<string, THREE.Material>()
export function hairMaterial(color: string): THREE.Material {
  let m = hairCache.get(color)
  if (!m) {
    const c = new THREE.Color(color)
    const hsl = { h: 0, s: 0, l: 0 }
    c.getHSL(hsl)
    m = new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.48,
      metalness: 0,
      sheen: 0.7,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.min(0.6, hsl.l + 0.12 + hsl.l * 0.5)),
      specularIntensity: 0.7,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
    })
    hairCache.set(color, m)
  }
  return m
}

const plainCache = new Map<string, THREE.Material>()
export function plain(color: string, roughness = 0.7, metalness = 0): THREE.Material {
  const key = `${color}|${roughness}|${metalness}`
  let m = plainCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    plainCache.set(key, m)
  }
  return m
}

const eyeCache = new Map<string, THREE.Material>()
// Eyeball with iris and pupil painted around the front pole of a sphere.
export function eyeMaterial(iris: string): THREE.Material {
  let m = eyeCache.get(iris)
  if (m) return m
  const W = 128, H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const ic = new THREE.Color(iris)
  const sclera = new THREE.Color('#efe9e1')
  const vein = new THREE.Color('#e4b3a8')
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      let col: THREE.Color
      const streak = 0.75 + 0.25 * Math.sin(u * Math.PI * 2 * 23 + Math.sin(u * 40) * 2) * Math.sin(v * 140)
      if (v < 0.055) col = new THREE.Color('#050404')
      else if (v < 0.15) {
        const t = (v - 0.055) / 0.095
        col = ic.clone().multiplyScalar(streak * (0.75 + 0.5 * (1 - Math.abs(t - 0.45) * 1.6)))
        if (t > 0.82) col.lerp(new THREE.Color('#1a120c'), (t - 0.82) / 0.18)
        if (t < 0.18) col.lerp(new THREE.Color('#2a1b10'), 1 - t / 0.18)
      } else {
        col = sclera.clone()
        if (v > 0.3) col.lerp(vein, Math.min(0.35, (v - 0.3) * 0.8) * (0.6 + 0.4 * Math.sin(u * 60)))
        if (v < 0.19) col.lerp(new THREE.Color('#bdb4aa'), (0.19 - v) / 0.04 * 0.5)
      }
      col.convertLinearToSRGB()
      const i = (y * W + x) * 4
      img.data[i] = Math.min(255, col.r * 255)
      img.data[i + 1] = Math.min(255, col.g * 255)
      img.data[i + 2] = Math.min(255, col.b * 255)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 0.8 })
  eyeCache.set(iris, m)
  return m
}
