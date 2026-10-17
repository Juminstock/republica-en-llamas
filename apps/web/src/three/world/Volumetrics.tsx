import { memo, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from './ruinShader'
import { sunState } from './Lighting'

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }
`

const hazeVertex = /* glsl */ `
attribute vec4 aCard;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aCard.w;
  vec3 c = aCard.xyz;
  c.x += sin(uTime * 0.05 + aCard.w * 30.0) * 3.0;
  c.z += cos(uTime * 0.04 + aCard.w * 17.0) * 3.0;
  float size = 10.0 + aCard.w * 14.0;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 p = c + right * position.x * size + up * position.y * size * 0.45;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
}`

const hazeFragment = /* glsl */ `
uniform float uAmount;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying float vSeed;
${NOISE}
void main() {
  vec2 q = vUv - 0.5;
  float r = length(q * vec2(1.0, 1.6));
  float shape = smoothstep(0.5, 0.05, r);
  float n = fbm(vUv * 3.0 + vec2(uTime * 0.02, vSeed * 9.0));
  float a = shape * (0.35 + 0.65 * n) * smoothstep(0.0, 0.3, vUv.y) * uAmount * 0.22;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

// Low-lying haze cards: soft volume look for night fog and dusty sunsets.
export const Haze = memo(function Haze({ bounds, count = 46, seed = 3 }: { bounds: Bounds; count?: number; seed?: number }) {
  const scene = useThree((s) => s.scene)
  const { geo, mat } = useMemo(() => {
    const r = rng(seed * 71)
    const g = new THREE.InstancedBufferGeometry()
    const base = new THREE.PlaneGeometry(1, 1)
    g.index = base.index
    g.setAttribute('position', base.attributes.position)
    g.setAttribute('uv', base.attributes.uv)
    const cards = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      cards[i * 4] = bounds.minX + r() * (bounds.maxX - bounds.minX)
      cards[i * 4 + 1] = 1.6 + r() * 2.2
      cards[i * 4 + 2] = bounds.minZ + r() * (bounds.maxZ - bounds.minZ)
      cards[i * 4 + 3] = r()
    }
    g.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 4))
    g.instanceCount = count
    const m = new THREE.ShaderMaterial({
      uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color() } },
      vertexShader: hazeVertex,
      fragmentShader: hazeFragment,
      transparent: true,
      depthWrite: false,
    })
    return { geo: g, mat: m }
  }, [bounds, count, seed])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uAmount.value = sunState.haze
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) mat.uniforms.uColor.value.copy(fog.color).multiplyScalar(1.35)
  })

  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />
})

const shaftVertex = /* glsl */ `
attribute vec4 aShaft;
uniform vec3 uSunDir;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aShaft.w;
  vec3 base = aShaft.xyz;
  vec3 axis = normalize(uSunDir);
  float len = 26.0 + aShaft.w * 18.0;
  float width = 1.6 + fract(aShaft.w * 13.7) * 3.2;
  vec3 along = base + axis * (uv.y * len);
  vec3 toCam = normalize(cameraPosition - along);
  vec3 side = normalize(cross(axis, toCam));
  vec3 p = along + side * (uv.x - 0.5) * width;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`

const shaftFragment = /* glsl */ `
uniform float uAmount;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying float vSeed;
${NOISE}
void main() {
  float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
  float along = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
  float dust = 0.55 + 0.45 * fbm(vec2(vUv.x * 4.0 + vSeed * 7.0, vUv.y * 2.0 - uTime * 0.05));
  float a = across * along * dust * uAmount * (0.6 + 0.4 * sin(uTime * 0.3 + vSeed * 20.0)) * 0.2;
  gl_FragColor = vec4(uColor * a, a);
}`

// God-ray cards aligned with the live sun direction, falling between buildings onto the ground.
export const LightShafts = memo(function LightShafts({ bounds, count = 16, seed = 5 }: { bounds: Bounds; count?: number; seed?: number }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(seed * 113)
    const g = new THREE.InstancedBufferGeometry()
    const base = new THREE.PlaneGeometry(1, 1, 1, 8)
    base.translate(0.5, 0.5, 0)
    g.index = base.index
    g.setAttribute('position', base.attributes.position)
    g.setAttribute('uv', base.attributes.uv)
    const shafts = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      shafts[i * 4] = bounds.minX + r() * (bounds.maxX - bounds.minX)
      shafts[i * 4 + 1] = -0.5
      shafts[i * 4 + 2] = bounds.minZ + r() * (bounds.maxZ - bounds.minZ)
      shafts[i * 4 + 3] = r()
    }
    g.setAttribute('aShaft', new THREE.InstancedBufferAttribute(shafts, 4))
    g.instanceCount = count
    const m = new THREE.ShaderMaterial({
      uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } },
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    return { geo: g, mat: m }
  }, [bounds, count, seed])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uAmount.value = sunState.shafts
    mat.uniforms.uSunDir.value.copy(sunState.dir)
    mat.uniforms.uColor.value.copy(sunState.color)
  })

  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />
})
