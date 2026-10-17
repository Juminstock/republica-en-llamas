import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from './context'
import { rng, smooth01 } from './ruinShader'

const COLUMNS: [number, number, number][] = [
  [140, -40, 1.2],
  [-60, -170, 1.6],
  [70, 160, 1.0],
]
const PER_COLUMN = 22

const smokeVertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (900.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`

const smokeFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`

const SmokeColumns = memo(function SmokeColumns() {
  const { tex, uRuin } = useWorld()
  const n = COLUMNS.length * PER_COLUMN
  const { geo, life } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1))
    const r = rng(83)
    return { geo: g, life: Float32Array.from({ length: n }, () => r()) }
  }, [n])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: tex.soft }, uColor: { value: new THREE.Color('#4d4743') }},
        vertexShader: smokeVertex,
        fragmentShader: smokeFragment,
        transparent: true,
        depthWrite: false,
      }),
    [tex],
  )
  useFrame(({ clock }, dt) => {
    const k = smooth01(0.3, 0.7, uRuin.value)
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array as Float32Array
    const size = geo.attributes.aSize.array as Float32Array
    const alpha = geo.attributes.aAlpha.array as Float32Array
    for (let c = 0; c < COLUMNS.length; c++) {
      const [cx, cz, s] = COLUMNS[c]
      for (let j = 0; j < PER_COLUMN; j++) {
        const i = c * PER_COLUMN + j
        life[i] = (life[i] + dt * 0.035) % 1
        const l = life[i]
        pos[i * 3] = cx + l * 40 * s + Math.sin(t * 0.3 + i) * 3
        pos[i * 3 + 1] = 5 + l * 110 * s
        pos[i * 3 + 2] = cz + Math.cos(t * 0.2 + i) * 3
        size[i] = (8 + l * 40) * s
        alpha[i] = k * 0.34 * Math.sin(Math.PI * Math.min(1, l * 1.2))
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
  })
  useEffect(() => () => geo.dispose(), [geo])
  return <points geometry={geo} material={mat} frustumCulled={false} />
})

const Dust = memo(function Dust() {
  const { tex } = useWorld()
  const N = 420
  const { geo, base } = useMemo(() => {
    const r = rng(89)
    const base = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      base[i * 3] = -40 + r() * 80
      base[i * 3 + 1] = 0.3 + r() * 7
      base[i * 3 + 2] = -30 + r() * 62
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
    return { geo: g, base }
  }, [])
  const mat = useMemo(
    () => new THREE.PointsMaterial({ map: tex.soft, color: '#ffe2b0', size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    [tex],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geo.attributes.position.array as Float32Array
    for (let i = 0; i < N; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.21 + i * 1.7) * 1.2
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.33 + i) * 0.5
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.17 + i * 0.9) * 1.2
    }
    geo.attributes.position.needsUpdate = true
  })
  useEffect(() => () => geo.dispose(), [geo])
  return <points geometry={geo} material={mat} />
})

const BIRDS = 9

const Birds = memo(function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0.35, 0, 0, -0.3, -0.9, 0.25, -0.05, 0, 0, 0.35, 0.9, 0.25, -0.05, 0, 0, -0.3], 3),
    )
    g.computeVertexNormals()
    return g
  }, [])
  const params = useMemo(() => {
    const r = rng(101)
    return Array.from({ length: BIRDS }, () => ({ rad: 18 + r() * 25, h: 40 + r() * 18, sp: 0.15 + r() * 0.12, ph: r() * 6.28, flap: 6 + r() * 4 }))
  }, [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    params.forEach((b, i) => {
      const a = t * b.sp + b.ph
      o.position.set(Math.cos(a) * b.rad, b.h + Math.sin(t * 0.5 + i) * 2, -42 + Math.sin(a) * b.rad)
      o.rotation.set(0, -a, 0)
      o.scale.set(1, 1 + Math.sin(t * b.flap) * 2.2, 1)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  })
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, BIRDS]} frustumCulled={false}>
      <meshBasicMaterial color="#1c1a19" side={THREE.DoubleSide} />
    </instancedMesh>
  )
})

export const Atmosphere = memo(function Atmosphere() {
  return (
    <group>
      <SmokeColumns />
      <Dust />
      <Birds />
    </group>
  )
})
