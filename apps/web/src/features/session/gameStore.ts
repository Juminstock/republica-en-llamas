import { create } from 'zustand'
import { WELCOME_BONUS } from './rules'

export type Screen = 'title' | 'intro' | 'registraduria' | 'game'

export type Choice = { choiceId: string; option: number }

type GameState = {
  screen: Screen
  bunuelos: number
  // Settled onchain at the end of the task, then reset.
  taskEarned: number
  taskSpent: number
  corruption: number
  trust: number
  stamps: string[]
  choices: Choice[]
  flags: Record<string, boolean>
  // How many times the player tried each obstacle; dialogues react to persistence.
  attempts: Record<string, number>
  dialogueId: string | null
  taskComplete: boolean
  toast: string | null
  // Bumped on reset to remount the Phaser game.
  runId: number
  go: (screen: Screen) => void
  openDialogue: (id: string | null) => void
  spend: (amount: number) => boolean
  earn: (amount: number) => void
  addStamp: (stamp: string) => void
  choose: (choiceId: string, option: number) => void
  adjust: (delta: { corruption?: number; trust?: number }) => void
  setFlag: (flag: string) => void
  bump: (key: string) => number
  completeTask: () => void
  showToast: (text: string | null) => void
  reset: () => void
}

const initial = {
  bunuelos: WELCOME_BONUS,
  taskEarned: WELCOME_BONUS,
  taskSpent: 0,
  corruption: 0,
  trust: 0,
  stamps: [] as string[],
  choices: [] as Choice[],
  flags: {} as Record<string, boolean>,
  attempts: {} as Record<string, number>,
  dialogueId: null,
  taskComplete: false,
  toast: null,
}

// Session state for the current task. Settled onchain at each checkpoint (task end).
export const useGame = create<GameState>((set, get) => ({
  // Dev only: ?scene=intro|game jumps straight there.
  screen: (import.meta.env.DEV && (new URLSearchParams(location.search).get('scene') as Screen | null)) || 'title',
  runId: 0,
  ...initial,
  go: (screen) => set({ screen }),
  openDialogue: (dialogueId) => set({ dialogueId }),
  spend: (amount) => {
    if (get().bunuelos < amount) return false
    set({ bunuelos: get().bunuelos - amount, taskSpent: get().taskSpent + amount })
    return true
  },
  earn: (amount) => set({ bunuelos: get().bunuelos + amount, taskEarned: get().taskEarned + amount }),
  addStamp: (stamp) => set({ stamps: get().stamps.includes(stamp) ? get().stamps : [...get().stamps, stamp] }),
  choose: (choiceId, option) => set({ choices: [...get().choices.filter((c) => c.choiceId !== choiceId), { choiceId, option }] }),
  adjust: ({ corruption = 0, trust = 0 }) => set({ corruption: get().corruption + corruption, trust: get().trust + trust }),
  setFlag: (flag) => set({ flags: { ...get().flags, [flag]: true } }),
  bump: (key) => {
    const n = (get().attempts[key] ?? 0) + 1
    set({ attempts: { ...get().attempts, [key]: n } })
    return n
  },
  completeTask: () => set({ taskComplete: true, dialogueId: null }),
  showToast: (toast) => set({ toast }),
  reset: () => set({ ...initial, runId: get().runId + 1 }),
}))
