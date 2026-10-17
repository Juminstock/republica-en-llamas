import { useStage } from '../../three/stage'
import type { LocationId } from '../../three/world/locations'

const PLACE_CARD: Record<LocationId, string> = {
  plaza: 'PLAZA BOTERO · CENTRO DE MEDELLÍN',
  udea: 'CIUDAD UNIVERSITARIA · UdeA',
}

let traveling = false

// Fade to black, swap the location while the screen is dark, fade back in with a title card.
export function travelTo(to: LocationId) {
  if (traveling || useStage.getState().location === to) return
  traveling = true
  const stage = useStage.getState()
  stage.set({ fade: 1 })
  setTimeout(() => {
    useStage.getState().set({ location: to, placeCard: PLACE_CARD[to] })
    setTimeout(() => {
      useStage.getState().set({ fade: 0 })
      traveling = false
    }, 450)
    setTimeout(() => useStage.getState().set({ placeCard: null }), 3200)
  }, 650)
}

export const travelTarget = (interactionId: string): LocationId | null =>
  interactionId === 'metro-udea' ? 'udea' : interactionId === 'metro-plaza' ? 'plaza' : null
