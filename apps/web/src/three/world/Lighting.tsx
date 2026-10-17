import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useEnvironment } from '@react-three/drei'
import * as THREE from 'three'
import { HDRI } from './pbr'
import { wetness } from './wet'

export type Mood = 'day' | 'golden' | 'dusk' | 'night'

type Preset = {
  top: string
  horizon: string
  bottom: string
  sun: string
  sunIntensity: number
  sunDir: [number, number, number]
  hemiSky: string
  hemiGround: string
  hemi: number
  fog: string
  fogDensity: number
  clouds: number
}

export const MOODS: Record<Mood, Preset> = {
  day: {
    top: '#2a6fc4', horizon: '#c4e2f6', bottom: '#d9d2c4', sun: '#fff1d8', sunIntensity: 3.2, sunDir: [0.42, 0.8, 0.44],
    hemiSky: '#b9d6f0', hemiGround: '#6f5f4c', hemi: 0.55, fog: '#bcd4e4', fogDensity: 0.0016, clouds: 0.55,
  },
  golden: {
    top: '#3f5f93', horizon: '#ffb26a', bottom: '#9a7a5c', sun: '#ffa552', sunIntensity: 4.6, sunDir: [-0.5, 0.33, 0.8],
    hemiSky: '#f0b783', hemiGround: '#4d382a', hemi: 0.42, fog: '#d79a66', fogDensity: 0.003, clouds: 0.45,
  },
  dusk: {
    top: '#1f2149', horizon: '#f06a3c', bottom: '#4a3442', sun: '#ff6a32', sunIntensity: 2.2, sunDir: [-0.86, 0.11, 0.48],
    hemiSky: '#8a6a98', hemiGround: '#2e2224', hemi: 0.34, fog: '#6e4044', fogDensity: 0.0042, clouds: 0.5,
  },
  night: {
    top: '#03050c', horizon: '#141b30', bottom: '#07080d', sun: '#7f9bff', sunIntensity: 0.28, sunDir: [0.3, 0.62, 0.48],
    hemiSky: '#1c2843', hemiGround: '#08080c', hemi: 0.1, fog: '#0b0f1c', fogDensity: 0.0065, clouds: 0.15,
  },
}

const HAZE = new THREE.Color('#8a7464')
const NIGHTNESS: Record<Mood, number> = { day: 0, golden: 0.2, dusk: 0.65, night: 1 }

// Read by world materials that react to the time of day (lit windows, street lamps).
export const lightLevel = { night: 0.2 }
// Live sun, read by light shafts and haze.
export const sunState = { dir: new THREE.Vector3(-0.7, 0.3, 0.6).normalize(), color: new THREE.Color('#ffb062'), shafts: 0.5, haze: 0.3 }
const SHAFTS: Record<Mood, number> = { day: 0.12, golden: 0.75, dusk: 0.55, night: 0 }
const HAZE_LEVEL: Record<Mood, number> = { day: 0.1, golden: 0.26, dusk: 0.36, night: 0.85 }
const WET: Record<Mood, number> = { day: 0, golden: 0, dusk: 0.15, night: 1 }
const ENV_INTENSITY: Record<Mood, number> = { day: 0.85, golden: 0.7, dusk: 0.45, night: 0.2 }

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
  gl_Position = p.xyww;
}`

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSun;
uniform float uClouds;
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
  col = mix(col, uBottom, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSun * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
    float n = fbm(uv);
    float m = smoothstep(0.62 - uClouds * 0.25, 0.92, n) * smoothstep(0.0, 0.2, h);
    vec3 cloud = mix(uHorizon * 0.9 + 0.1, uSun, 0.35 * pow(sd, 3.0)) * (0.75 + 0.35 * n);
    col = mix(col, cloud, m * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

type Live = {
  top: THREE.Color
  horizon: THREE.Color
  bottom: THREE.Color
  sun: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  fog: THREE.Color
  dir: THREE.Vector3
  sunIntensity: number
  hemi: number
  fogDensity: number
  clouds: number
}

function liveFrom(p: Preset): Live {
  return {
    top: new THREE.Color(p.top),
    horizon: new THREE.Color(p.horizon),
    bottom: new THREE.Color(p.bottom),
    sun: new THREE.Color(p.sun),
    hemiSky: new THREE.Color(p.hemiSky),
    hemiGround: new THREE.Color(p.hemiGround),
    fog: new THREE.Color(p.fog),
    dir: new THREE.Vector3(...p.sunDir).normalize(),
    sunIntensity: p.sunIntensity,
    hemi: p.hemi,
    fogDensity: p.fogDensity,
    clouds: p.clouds,
  }
}

export const WorldLighting = memo(function WorldLighting({ mood = 'golden', ruin = 1 }: { mood?: Mood; ruin?: number }) {
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const live = useRef<Live>(liveFrom(MOODS[mood]))
  const targets = useMemo(() => Object.fromEntries(Object.entries(MOODS).map(([k, p]) => [k, liveFrom(p)])) as Record<Mood, Live>, [])
  const ruinRef = useRef(ruin)
  ruinRef.current = ruin
  const tmp = useMemo(() => new THREE.Color(), [])

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uSun: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uClouds: { value: 0.5 },
          uTime: { value: 0 },
        },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )

  useEffect(() => {
    const fog = new THREE.FogExp2(live.current.fog.getHex(), live.current.fogDensity)
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene])

  const shadowSize = size.width < 800 ? 1024 : 2048

  useFrame(({ clock, camera }, dt) => {
    const L = live.current
    const T = targets[mood]
    const k = 1 - Math.exp(-dt * 1.4)
    const ruinNow = ruinRef.current
    L.top.lerp(T.top, k)
    L.horizon.lerp(tmp.copy(T.horizon).lerp(HAZE, ruinNow * 0.22), k)
    L.bottom.lerp(T.bottom, k)
    L.sun.lerp(T.sun, k)
    L.hemiSky.lerp(T.hemiSky, k)
    L.hemiGround.lerp(T.hemiGround, k)
    L.fog.lerp(tmp.copy(T.fog).lerp(HAZE, ruinNow * 0.18), k)
    L.dir.lerp(T.dir, k).normalize()
    L.sunIntensity += (T.sunIntensity * (1 - ruinNow * 0.12) - L.sunIntensity) * k
    L.hemi += (T.hemi - L.hemi) * k
    L.fogDensity += (T.fogDensity + ruinNow * 0.0011 - L.fogDensity) * k
    L.clouds += (T.clouds - L.clouds) * k
    lightLevel.night += (NIGHTNESS[mood] - lightLevel.night) * k
    sunState.dir.copy(L.dir)
    sunState.color.copy(L.sun)
    sunState.shafts += (SHAFTS[mood] * (1 + ruinNow * 0.3) - sunState.shafts) * k
    sunState.haze += (HAZE_LEVEL[mood] + ruinNow * 0.1 - sunState.haze) * k
    wetness.value += (WET[mood] - wetness.value) * k
    scene.environmentIntensity += (ENV_INTENSITY[mood] - scene.environmentIntensity) * k

    const u = skyMat.uniforms
    u.uTop.value.copy(L.top)
    u.uHorizon.value.copy(L.horizon)
    u.uBottom.value.copy(L.bottom)
    u.uSun.value.copy(L.sun)
    u.uSunDir.value.copy(L.dir)
    u.uClouds.value = L.clouds
    u.uTime.value = clock.elapsedTime

    if (sun.current) {
      sun.current.color.copy(L.sun)
      sun.current.intensity = L.sunIntensity
      sun.current.position.copy(L.dir).multiplyScalar(140)
    }
    if (hemi.current) {
      hemi.current.color.copy(L.hemiSky)
      hemi.current.groundColor.copy(L.hemiGround)
      hemi.current.intensity = L.hemi
    }
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) {
      fog.color.copy(L.fog)
      fog.density = L.fogDensity
    }
    skySphere.current?.position.copy(camera.position)
  })

  const skySphere = useRef<THREE.Mesh>(null)
  const p = MOODS[mood]

  return (
    <>
      <mesh ref={skySphere} material={skyMat} frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[900, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <Suspense
        fallback={
          <Environment key={mood} frames={1} resolution={64}>
            <mesh scale={100}>
              <sphereGeometry args={[1, 32, 16]} />
              <meshBasicMaterial color={p.horizon} side={THREE.BackSide} />
            </mesh>
            <Lightformer form="circle" intensity={3} color={p.sun} position={new THREE.Vector3(...p.sunDir).normalize().multiplyScalar(30)} scale={14} />
            <Lightformer form="rect" intensity={1.2} color={p.top} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
          </Environment>
        }
      >
        <HdriEnvironment mood={mood} />
      </Suspense>
    </>
  )
})

// All four HDRIs load once (in their own Suspense, so the world never blanks) and swap with the mood.
function HdriEnvironment({ mood }: { mood: Mood }) {
  const scene = useThree((s) => s.scene)
  const envs: Record<Mood, THREE.Texture> = {
    day: useEnvironment({ files: HDRI.day }),
    golden: useEnvironment({ files: HDRI.golden }),
    dusk: useEnvironment({ files: HDRI.dusk }),
    night: useEnvironment({ files: HDRI.night }),
  }
  useEffect(() => {
    const prev = scene.environment
    scene.environment = envs[mood]
    // The HDRIs are not aligned to our sun; turn them so their bright side roughly matches.
    scene.environmentRotation.set(0, mood === 'golden' ? 2.2 : mood === 'dusk' ? 2.6 : 0, 0)
    return () => {
      if (scene.environment === envs[mood]) scene.environment = prev
    }
  }, [mood, scene, envs.day, envs.golden, envs.dusk, envs.night])
  return null
}
