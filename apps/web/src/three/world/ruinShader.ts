import * as THREE from 'three'

export type RuinUniform = { value: number }

type RuinPatch = {
  // 'instance': per-instance threshold from the aThresh attribute; number: one threshold for the mesh.
  appear?: 'instance' | number
  // Disappear as ruin grows instead of appearing.
  invert?: boolean
  // Lerp the albedo toward a burnt or overgrown color as ruin grows.
  tint?: { color: THREE.ColorRepresentation; amount: number }
  // Uniform growth: the mesh is (1 + grow * ruin) times its size at full ruin.
  grow?: number
}

const FADE = 0.18

function scaleChunk(p: RuinPatch) {
  const grow = p.grow ? `transformed *= 1.0 + uRuin * ${p.grow.toFixed(3)};` : ''
  if (p.appear === undefined) return grow
  const thresh = p.appear === 'instance' ? 'aThresh' : p.appear.toFixed(3)
  const ruin = p.invert ? '(1.0 - uRuin)' : 'uRuin'
  return `transformed *= smoothstep(${thresh}, ${thresh} + ${FADE.toFixed(2)}, ${ruin});${grow}`
}

function vertexHeader(p: RuinPatch) {
  return `uniform float uRuin;\n${p.appear === 'instance' ? 'attribute float aThresh;\n' : ''}`
}

// Patches a built-in material so one shared uniform drives growth, decay and tint on the GPU.
export function patchRuin<T extends THREE.Material>(material: T, uRuin: RuinUniform, p: RuinPatch): T {
  const tint = p.tint ? new THREE.Color(p.tint.color) : null
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRuin = uRuin
    shader.vertexShader = vertexHeader(p) + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${scaleChunk(p)}`)
    if (tint && p.tint) {
      shader.uniforms.uTint = { value: tint }
      shader.fragmentShader = `uniform float uRuin;\nuniform vec3 uTint;\n` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTint, clamp(uRuin, 0.0, 1.0) * ${p.tint.amount.toFixed(3)});`,
      )
    }
  }
  material.customProgramCacheKey = () => `ruin:${p.appear ?? '-'}:${p.invert ? 1 : 0}:${p.grow ?? 0}:${p.tint ? `${tint!.getHexString()}${p.tint.amount}` : '-'}`
  return material
}

// Shadow casters need the same growth so hidden objects do not cast shadows.
export function ruinDepthMaterial(uRuin: RuinUniform, p: RuinPatch) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  return patchRuin(m, uRuin, { appear: p.appear, invert: p.invert, grow: p.grow })
}

// Deterministic pseudo random so the world looks the same on every load.
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function smooth01(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
