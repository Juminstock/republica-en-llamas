import { create } from 'zustand'
import type { LocationId } from './world/locations'

export type StageMode = 'title' | 'intro' | 'play'
export type Mood = 'day' | 'golden' | 'dusk' | 'night'

export type Subtitle = { speaker?: string; text: string; style?: 'dialogue' | 'caption' | 'title' | 'decree' }

type StageState = {
  mode: StageMode
  location: LocationId
  // Big location title shown on arrival.
  placeCard: string | null
  ruin: number
  mood: Mood
  subtitle: Subtitle | null
  letterbox: boolean
  // 0..1 black overlay used for cuts and fades.
  fade: number
  setMode: (mode: StageMode) => void
  set: (patch: Partial<Omit<StageState, 'set' | 'setMode'>>) => void
}

// Shared state between the 3D scene (cinematics, world) and the React overlays.
export const useStage = create<StageState>((set) => ({
  mode: 'title',
  location: 'plaza',
  placeCard: null,
  ruin: 1,
  mood: 'dusk',
  subtitle: null,
  letterbox: false,
  fade: 0,
  setMode: (mode) => set({ mode }),
  set: (patch) => set(patch),
}))

// Continuous ruin value for cinematics: written every frame, read by the world shader without re-rendering.
export const ruinRef = { current: 1 }
