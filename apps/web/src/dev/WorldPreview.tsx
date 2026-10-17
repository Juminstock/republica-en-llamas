import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette, SMAA, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { PlazaBotero, UdeACampus, WorldLighting, UDEA_LANDMARKS, type Mood } from '../three/world'

const params = new URLSearchParams(window.location.search)
const ruin = Number(params.get('ruin') ?? 1)
const mood = (params.get('mood') ?? 'golden') as Mood
const loc = params.get('loc') ?? 'plaza'
const post = params.get('post') !== '0'
const speech = params.get('speech') === '1'

type View = { pos: [number, number, number]; target: [number, number, number] }
const PLAZA_VIEWS: Record<string, View> = {
  high: { pos: [62, 48, 58], target: [-4, 4, -10] },
  camp: { pos: [6, 1.7, 22], target: [0, 9, -40] },
  wide: { pos: [-8, 14, 46], target: [0, 8, -20] },
  eye: { pos: [24, 1.7, 26], target: [-10, 5, -20] },
  museo: { pos: [-10, 2.2, 18], target: [-46, 7, -2] },
  sculpt: { pos: [-6, 2.2, 14], target: [-14, 3, 6] },
  balcony: { pos: [0, 4, -12], target: [0, 10, -31] },
  metro: { pos: [26, 3, 30], target: [50, 8, 18] },
}
const udeaViews: Record<string, View> = Object.fromEntries(Object.entries(UDEA_LANDMARKS.views).map(([k, v]) => [k, { pos: v.pos, target: v.lookAt }]))
const VIEWS = loc === 'udea' ? udeaViews : PLAZA_VIEWS
const view = VIEWS[params.get('view') ?? Object.keys(VIEWS)[0]] ?? Object.values(VIEWS)[0]

// Exposes per-frame render stats (all passes, shadows included) for automated screenshots.
function Stats() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])
  useFrame(() => {
    Object.assign(window, { __info: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, programs: gl.info.programs?.length } })
    gl.info.reset()
  }, 2)
  return null
}

export function WorldPreview() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        gl={{ toneMapping: post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, antialias: !post }}
        camera={{ position: view.pos, fov: 55, near: 0.1, far: 2000 }}
      >
        <Suspense fallback={null}>
          <WorldLighting mood={mood} ruin={ruin} />
          {loc === 'udea' ? <UdeACampus ruin={ruin} speechStage={speech} /> : <PlazaBotero ruin={ruin} />}
        </Suspense>
        <OrbitControls target={view.target} makeDefault />
        <Stats />
        {post && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO aoRadius={2.2} intensity={2.2} distanceFalloff={1.2} halfRes quality="medium" />
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
            <HueSaturation saturation={0.04} />
            <BrightnessContrast contrast={0.08} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.55} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
