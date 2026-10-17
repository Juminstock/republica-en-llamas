import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from './context'
import { lightLevel } from './Lighting'
import { wetness } from './wet'
import { rng } from './ruinShader'

export type LampSpot = { x: number; z: number; rotY: number }

const POLE_H = 6.2
const ARM = 1.4
const SODIUM = new THREE.Color('#ffb25a')
const tmpO = new THREE.Object3D()

const coneVertex = /* glsl */ `
attribute float aSeed;
varying float vH;
varying float vSeed;
varying vec3 vN;
varying vec3 vView;
void main() {
  vH = position.y;
  vSeed = aSeed;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const coneFragment = /* glsl */ `
uniform float uOn;
uniform float uTime;
uniform float uRuin;
uniform vec3 uColor;
varying float vH;
varying float vSeed;
varying vec3 vN;
varying vec3 vView;
void main() {
  // vH runs from -0.5 (ground) to 0.5 (lamp head) in the unit cone.
  float k = clamp(vH + 0.5, 0.0, 1.0);
  float edge = pow(1.0 - abs(dot(vN, vView)), 1.4);
  float body = (1.0 - edge) * 0.65 + 0.35;
  float flick = 1.0;
  if (vSeed > 1.0 - uRuin * 0.45) flick = step(0.35, fract(sin(floor(uTime * 9.0 + vSeed * 40.0)) * 43758.5)) * 0.9;
  if (vSeed < uRuin * 0.3) flick = 0.0;
  float a = pow(k, 1.6) * body * 0.22 * uOn * flick;
  gl_FragColor = vec4(uColor * a, a);
}`

// Sodium street lamps: poles, glowing heads, volumetric-looking light cones, ground pools and a few real lights.
export const Lamps = memo(function Lamps({ spots, realLights = 6, seed = 1 }: { spots: LampSpot[]; realLights?: number; seed?: number }) {
  const { tex, uRuin } = useWorld()
  const pole = useRef<THREE.InstancedMesh>(null)
  const arm = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.InstancedMesh>(null)
  const cone = useRef<THREE.InstancedMesh>(null)
  const pool = useRef<THREE.InstancedMesh>(null)
  const streak = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<(THREE.PointLight | null)[]>([])

  const seeds = useMemo(() => {
    const r = rng(seed * 977)
    return spots.map(() => r())
  }, [spots, seed])

  const mats = useMemo(() => {
    const metal = new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: 0.75, roughness: 0.45 })
    const headMat = new THREE.MeshStandardMaterial({ color: '#2b2e33', emissive: SODIUM, emissiveIntensity: 0, roughness: 0.4 })
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { uOn: { value: 0 }, uTime: { value: 0 }, uRuin: uRuin, uColor: { value: SODIUM.clone() } },
      vertexShader: coneVertex,
      fragmentShader: coneFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const poolMat = new THREE.MeshBasicMaterial({ map: tex.soft, color: new THREE.Color('#a8622a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 })
    const streakMat = new THREE.MeshBasicMaterial({ map: tex.soft, color: SODIUM, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -7 })
    return { metal, headMat, coneMat, poolMat, streakMat }
  }, [tex, uRuin])

  const geo = useMemo(() => {
    const coneG = new THREE.ConeGeometry(2.6, POLE_H - 0.3, 24, 1, true)
    coneG.scale(1, 1 / (POLE_H - 0.3), 1)
    return {
      pole: new THREE.CylinderGeometry(0.07, 0.11, POLE_H, 8).translate(0, POLE_H / 2, 0),
      arm: new THREE.BoxGeometry(0.08, 0.08, ARM).translate(0, 0, ARM / 2),
      head: new THREE.BoxGeometry(0.34, 0.12, 0.6),
      cone: coneG,
      plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  useEffect(() => {
    const o = new THREE.Object3D()
    const seedAttr = new Float32Array(spots.length)
    spots.forEach((s, i) => {
      const hx = s.x + Math.sin(s.rotY) * ARM
      const hz = s.z + Math.cos(s.rotY) * ARM
      o.rotation.set(0, s.rotY, 0)
      o.scale.set(1, 1, 1)
      o.position.set(s.x, 0, s.z)
      o.updateMatrix()
      pole.current!.setMatrixAt(i, o.matrix)
      o.position.set(s.x, POLE_H - 0.05, s.z)
      o.updateMatrix()
      arm.current!.setMatrixAt(i, o.matrix)
      o.position.set(hx, POLE_H - 0.1, hz)
      o.updateMatrix()
      head.current!.setMatrixAt(i, o.matrix)
      o.position.set(hx, (POLE_H - 0.3) / 2, hz)
      o.scale.set(1, POLE_H - 0.3, 1)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      cone.current!.setMatrixAt(i, o.matrix)
      o.position.set(hx, 0.03, hz)
      o.scale.set(7, 1, 7)
      o.updateMatrix()
      pool.current!.setMatrixAt(i, o.matrix)
      o.position.set(hx, 0.035, hz + 2.5)
      o.scale.set(1.1, 1, 6.5)
      o.updateMatrix()
      streak.current!.setMatrixAt(i, o.matrix)
      seedAttr[i] = seeds[i]
    })
    ;[pole, arm, head, cone, pool, streak].forEach((m) => (m.current!.instanceMatrix.needsUpdate = true))
    cone.current!.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1))
  }, [spots, seeds])

  useFrame(({ clock, camera }) => {
    const on = THREE.MathUtils.smoothstep(lightLevel.night, 0.45, 0.85)
    const ruin = uRuin.value
    const t = clock.elapsedTime
    mats.coneMat.uniforms.uOn.value = on
    mats.coneMat.uniforms.uTime.value = t
    mats.headMat.emissiveIntensity = on * 4
    mats.poolMat.opacity = on * 0.16
    mats.streakMat.opacity = on * 0.14 * wetness.value
    // Reflection streaks point at the camera like real wet-asphalt highlights.
    if (streak.current && on > 0.01 && wetness.value > 0.05) {
      const o = tmpO
      spots.forEach((s, i) => {
        const hx = s.x + Math.sin(s.rotY) * ARM
        const hz = s.z + Math.cos(s.rotY) * ARM
        const dx = camera.position.x - hx
        const dz = camera.position.z - hz
        const len = Math.hypot(dx, dz) || 1
        o.position.set(hx + (dx / len) * 3, 0.035, hz + (dz / len) * 3)
        o.rotation.set(0, Math.atan2(dx, dz), 0)
        o.scale.set(0.9, 1, 7)
        o.updateMatrix()
        streak.current!.setMatrixAt(i, o.matrix)
      })
      streak.current.instanceMatrix.needsUpdate = true
    }
    lights.current.forEach((l, i) => {
      if (!l) return
      const broken = seeds[i] < ruin * 0.3
      const flicker = seeds[i] > 1 - ruin * 0.45 ? (Math.sin(t * 23 + i * 7) > -0.2 ? 1 : 0.15) : 1
      l.intensity = broken ? 0 : on * 18 * flicker
    })
  })

  const lit = spots.slice(0, realLights)

  return (
    <group>
      <instancedMesh ref={pole} args={[geo.pole, mats.metal, spots.length]} castShadow />
      <instancedMesh ref={arm} args={[geo.arm, mats.metal, spots.length]} />
      <instancedMesh ref={head} args={[geo.head, mats.headMat, spots.length]} />
      <instancedMesh ref={cone} args={[geo.cone, mats.coneMat, spots.length]} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={pool} args={[geo.plane, mats.poolMat, spots.length]} renderOrder={4} />
      <instancedMesh ref={streak} args={[geo.plane, mats.streakMat, spots.length]} renderOrder={4} frustumCulled={false} />
      {lit.map((s, i) => (
        <pointLight
          key={i}
          ref={(el) => (lights.current[i] = el)}
          position={[s.x + Math.sin(s.rotY) * ARM, POLE_H - 0.5, s.z + Math.cos(s.rotY) * ARM]}
          color={SODIUM}
          intensity={0}
          distance={20}
          decay={1.6}
        />
      ))}
    </group>
  )
})
