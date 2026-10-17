import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Humanoid, buildRig, lookFor, type CharacterId, type Expression, type Gesture, type HumanoidHandle } from '../three/characters'

type Entry = { id: CharacterId; variant?: number; label: string }

const LINEUP: Entry[] = [
  { id: 'soldier', label: 'Soldado' },
  { id: 'student', variant: 1, label: 'Estudiante 1' },
  { id: 'rector', label: 'Rector' },
  { id: 'vale', label: 'Vale' },
  { id: 'camila', label: 'Camila' },
  { id: 'andres', label: 'Andrés' },
  { id: 'president', label: 'Presidente' },
  { id: 'clerk', label: 'Funcionario' },
  { id: 'student', variant: 4, label: 'Estudiante 2' },
]

const GESTURES: Gesture[] = ['none', 'talk', 'reach', 'stamp', 'wave', 'point', 'cheer', 'decree', 'crossArms', 'sit', 'salute', 'fistRaise', 'podium', 'shrug', 'facepalm', 'typing', 'thinking']
const EXPRESSIONS: Expression[] = ['neutral', 'smile', 'smug', 'angry', 'sad', 'surprised', 'worried', 'determined']
const params = new URLSearchParams(window.location.search)

type Controls = { gesture: Gesture; speed: number; crouch: boolean; talking: boolean; circle: boolean; expression: Expression }

function Rig({ entry, x, controls }: { entry: Entry; x: number; controls: Controls }) {
  const ref = useRef<HumanoidHandle>(null)
  const angle = useRef(0)
  const head = useMemo(() => new THREE.Vector3(), [])
  const { camera } = useThree()
  useEffect(() => {
    const h = ref.current
    if (!h) return
    h.setGesture(controls.gesture)
    h.setCrouch(controls.crouch)
    h.setTalking(controls.talking)
    h.setExpression(controls.expression)
  })
  useFrame((_, dt) => {
    const h = ref.current
    if (!h) return
    ;(window as unknown as { __h: Record<string, HumanoidHandle> }).__h = { ...((window as unknown as { __h?: Record<string, HumanoidHandle> }).__h ?? {}), [entry.label]: h }
    if (controls.circle) {
      const radius = 2.2
      const w = controls.speed / radius
      angle.current += w * dt
      const a = angle.current + x * 0.7
      h.root.position.set(x + Math.cos(a) * radius, 0, Math.sin(a) * radius)
      h.root.rotation.y = -a
      h.setSpeed(controls.speed)
    } else {
      h.root.position.set(x, 0, 0)
      h.root.rotation.y = params.has('turn') ? Number(params.get('turn')) : 0
      h.setSpeed(params.has('treadmill') ? controls.speed : 0)
    }
    h.lookAt(params.has('lookcam') ? head.copy(camera.position) : null)
  })
  return <Humanoid ref={ref} id={entry.id} variant={entry.variant} />
}

const eyeY = () => (lookFor((params.get('only') as CharacterId) ?? 'camila').height ?? 1) * 1.65

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => env.dispose()
  }, [gl, scene])
  return null
}

function CameraPreset() {
  const { camera } = useThree()
  useEffect(() => {
    const cam = params.get('cam') ?? 'front'
    const only = params.get('only')
    const focus = only ? 0 : 0
    const c = camera as THREE.PerspectiveCamera
    if (cam === 'front') c.position.set(0, 1.6, 11)
    if (cam === 'back') c.position.set(0, 1.7, -11)
    if (cam === 'close') {
      const h = eyeY()
      c.position.set(Number(params.get('cx') ?? 0.12), h + 0.01, Number(params.get('cz') ?? 0.62))
      c.fov = 30
    } else if (cam === 'hands') {
      c.position.set(-0.25, 1.15, 0.75)
      c.fov = 30
    } else if (cam === 'upper') {
      c.position.set(Number(params.get('cx') ?? 0.4), 1.45, Number(params.get('cz') ?? 1.9))
      c.fov = 32
    } else if (cam === 'side') {
      c.position.set(focus + 4.2, 1.1, 0)
      c.lookAt(focus, 0.9, 0)
      c.fov = 35
    } else if (cam === 'three') {
      c.position.set(2.8, 1.9, 4.2)
      c.lookAt(0, 0.9, 0)
      c.fov = 35
    } else c.lookAt(0, 1, 0)
    c.updateProjectionMatrix()
  }, [camera])
  return null
}

export function CharactersPreview() {
  const [controls, setControls] = useState<Controls>({
    gesture: (params.get('gesture') as Gesture) ?? 'none',
    speed: Number(params.get('speed') ?? 1.4),
    crouch: params.get('crouch') === '1',
    talking: params.get('talk') === '1',
    circle: params.get('circle') === '1',
    expression: (params.get('expr') as Expression) ?? 'neutral',
  })
  const only = params.get('only')
  const entries = only ? LINEUP.filter((e) => e.id === only).slice(0, 1) : LINEUP
  const stats = useMemo(
    () =>
      LINEUP.map((e) => {
        const t0 = performance.now()
        const rig = buildRig(lookFor(e.id, e.variant), true, e.id === 'student' || e.id === 'soldier' ? 'crowd' : 'hero')
        return { label: e.label, meshCount: rig.meshCount, triangles: rig.triangles, ms: Math.round(performance.now() - t0) }
      }),
    [],
  )
  useEffect(() => {
    Object.assign(window, { __stats: stats })
  }, [stats])

  const cam = params.get('cam')
  const target: [number, number, number] = cam === 'close' ? [0, eyeY() - 0.015, 0] : cam === 'hands' ? [-0.25, 1.05, 0.1] : cam === 'upper' ? [0, 1.35, 0] : [0, 1, 0]
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, near: 0.05, far: 200 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={['#262934']} />
        <Env />
        <fog attach="fog" args={['#262934', 18, 40]} />
        <hemisphereLight args={['#cfe0ff', '#4a3a2c', 0.55]} />
        <directionalLight position={[6, 9, 7]} intensity={2.4} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <directionalLight position={[-6, 4, -6]} intensity={1.1} color="#9fb8ff" />
        <directionalLight position={[0, 3, -8]} intensity={0.8} color="#ffd2a8" />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[30, 64]} />
          <meshStandardMaterial color="#5d5a55" roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.005, 0]} opacity={0.5} scale={20} blur={2.2} far={3} />
        {entries.map((e, i) => (
          <Rig key={e.label} entry={e} x={only ? 0 : (i - (entries.length - 1) / 2) * 1.05} controls={controls} />
        ))}
        {Array.from({ length: Number(params.get('crowd') ?? 0) }, (_, i) => (
          <Rig key={`crowd-${i}`} entry={{ id: i % 4 === 3 ? 'soldier' : 'student', variant: i + 10, label: `crowd-${i}` }} x={((i % 5) - 2) * 1.6} controls={{ ...controls, circle: true }} />
        ))}
        <CameraPreset />
        <OrbitControls target={target} enableDamping />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 10, background: '#000a', color: '#eee', padding: 10, borderRadius: 8, fontSize: 12, display: params.has('clean') ? 'none' : 'block' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360 }}>
          {GESTURES.map((gst) => (
            <button key={gst} onClick={() => setControls({ ...controls, gesture: gst })} style={{ background: controls.gesture === gst ? '#f2b705' : '#333', color: controls.gesture === gst ? '#000' : '#eee', border: 0, padding: '3px 6px', borderRadius: 4 }}>
              {gst}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360, marginTop: 6 }}>
          {EXPRESSIONS.map((ex) => (
            <button key={ex} onClick={() => setControls({ ...controls, expression: ex })} style={{ background: controls.expression === ex ? '#7fd1ff' : '#333', color: controls.expression === ex ? '#000' : '#eee', border: 0, padding: '3px 6px', borderRadius: 4 }}>
              {ex}
            </button>
          ))}
        </div>
        <label style={{ display: 'block', marginTop: 6 }}>
          velocidad {controls.speed.toFixed(1)} m/s
          <input type="range" min={0} max={5} step={0.1} value={controls.speed} onChange={(e) => setControls({ ...controls, speed: Number(e.target.value) })} />
        </label>
        <label><input type="checkbox" checked={controls.crouch} onChange={(e) => setControls({ ...controls, crouch: e.target.checked })} /> agachado</label>{' '}
        <label><input type="checkbox" checked={controls.talking} onChange={(e) => setControls({ ...controls, talking: e.target.checked })} /> hablando</label>{' '}
        <label><input type="checkbox" checked={controls.circle} onChange={(e) => setControls({ ...controls, circle: e.target.checked })} /> caminar en círculo</label>
        <table style={{ marginTop: 6 }}>
          <tbody>
            {stats.map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td style={{ paddingLeft: 8 }}>{s.meshCount} mallas</td>
                <td style={{ paddingLeft: 8 }}>{s.triangles} tri</td>
                <td style={{ paddingLeft: 8 }}>{s.ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
