import { Suspense, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA, BrightnessContrast, HueSaturation, Noise, N8AO } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { PlazaBotero, UdeACampus, WorldLighting, PLAZA_LAYOUT, UDEA_LAYOUT, UDEA_LANDMARKS } from './world'
import { useStage, ruinRef } from './stage'
import { TitleScene } from './cinematics/TitleScene'
import { Warmup } from './cinematics/Warmup'
import { IntroDirector } from './cinematics/IntroDirector'
import { PlayerRig } from './player/PlayerRig'
import { Markers } from './player/Markers'
import { requestMouseLook } from './player/controls'
import { PLAZA_NPCS, udeaNpcs } from './player/npcs'
import { useGame } from '../features/session/gameStore'

const isMobile = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches

// One persistent 3D canvas behind every screen: title, intro cinematic and gameplay share the worlds.
export function GameCanvas({ onIntroDone }: { onIntroDone: () => void }) {
  const mode = useStage((s) => s.mode)
  const ruin = useStage((s) => s.ruin)
  const mood = useStage((s) => s.mood)
  const location = useStage((s) => s.location)
  const runId = useGame((s) => s.runId)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (useStage.getState().mode === 'play') requestMouseLook(e.currentTarget)
  }, [])

  const udeaCast = useMemo(() => {
    const lib = UDEA_LAYOUT.interactions.find((i) => i.id === 'biblioteca')
    const lw = UDEA_LANDMARKS.libraryWindow
    const facing = lib ? Math.atan2(lib.at[0] - lw[0], lib.at[2] - lw[2]) : 0
    return udeaNpcs(UDEA_LANDMARKS, facing)
  }, [])
  const layout = location === 'udea' ? UDEA_LAYOUT : PLAZA_LAYOUT
  const ruinSource = mode === 'intro' ? ruinRef : undefined

  return (
    <div className="absolute inset-0" onPointerDown={onPointerDown}>
      <Canvas
        shadows="percentage"
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        camera={{ fov: 50, near: 0.1, far: 2000, position: [40, 20, 40] }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, stencil: false }}
      >
        <Suspense fallback={null}>
          <WorldLighting mood={mood} ruin={ruin} />
          {/* Both locations stay mounted so cuts between them are instant. */}
          <group visible={location === 'plaza'}>
            <PlazaBotero ruin={ruin} ruinRef={ruinSource} />
          </group>
          <group visible={location === 'udea'}>
            <UdeACampus ruin={ruin} ruinRef={ruinSource} speechStage={mode === 'intro'} />
          </group>
          {mode === 'title' && (
            <>
              <TitleScene />
              <Warmup />
            </>
          )}
          {mode === 'intro' && <IntroDirector onDone={onIntroDone} />}
          {mode === 'play' && (
            <>
              <PlayerRig key={`${runId}-${location}`} layout={layout} npcs={location === 'udea' ? udeaCast : PLAZA_NPCS} />
              <Markers interactions={layout.interactions} />
            </>
          )}
        </Suspense>
        <EffectComposer multisampling={0} enableNormalPass={false}>
          {isMobile ? <></> : <N8AO aoRadius={2.2} intensity={2.2} distanceFalloff={1.2} halfRes quality="medium" />}
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.25} />
          <HueSaturation saturation={mood === 'day' ? 0.05 : -0.06} />
          <BrightnessContrast contrast={0.1} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.035} />
          <Vignette offset={0.28} darkness={mode === 'play' ? 0.55 : 0.75} />
          <SMAA />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
