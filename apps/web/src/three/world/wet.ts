import * as THREE from 'three'
import { rng } from './ruinShader'

// 0 dry .. 1 soaked. Lighting drives it from the mood; ground materials read it on the GPU.
export const wetness = { value: 0 }

let puddleTex: THREE.CanvasTexture | null = null

// Soft puddle mask: white = standing water. Sampled in world space so it never stretches.
export function puddleMask() {
  if (puddleTex) return puddleTex
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, S, S)
  const r = rng(404)
  for (let i = 0; i < 26; i++) {
    const x = r() * S
    const y = r() * S
    const rad = 14 + r() * 60
    for (let k = 0; k < 5; k++) {
      const g = ctx.createRadialGradient(x + (r() - 0.5) * rad, y + (r() - 0.5) * rad, 0, x, y, rad * (0.6 + r() * 0.6))
      g.addColorStop(0, 'rgba(255,255,255,0.9)')
      g.addColorStop(0.65, 'rgba(255,255,255,0.55)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, rad, rad * (0.4 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  puddleTex = new THREE.CanvasTexture(c)
  puddleTex.wrapS = puddleTex.wrapT = THREE.RepeatWrapping
  return puddleTex
}

// Makes a standard material darker and glossier when wet, with mirror-like puddles.
export function patchWet<T extends THREE.MeshStandardMaterial>(material: T, scale = 1 / 22) {
  const previous = material.onBeforeCompile.bind(material)
  const mask = puddleMask()
  const prevKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    shader.uniforms.uWet = wetness
    shader.uniforms.uPuddle = { value: mask }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWet;\nuniform sampler2D uPuddle;\nvarying vec3 vWetPos;\nfloat wetPuddle;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
wetPuddle = smoothstep(0.25, 0.75, texture2D(uPuddle, vWetPos.xz * ${scale.toFixed(4)}).r) * uWet;
diffuseColor.rgb *= mix(1.0, 0.6, uWet) * mix(1.0, 0.8, wetPuddle);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWet);
roughnessFactor = mix(roughnessFactor, 0.1, wetPuddle);`,
      )
  }
  material.customProgramCacheKey = () => `${prevKey()}|wet`
  return material
}
