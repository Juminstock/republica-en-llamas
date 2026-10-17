import { memo } from 'react'
import { Lamps, type LampSpot } from '../Lamps'
import { Metro } from '../Metro'
import { StreetProps, type Poster, type Spot } from '../Props'
import { Haze, LightShafts } from '../Volumetrics'
import { FacadeDetails } from './FacadeDetails'
import { PLAZA } from '../layout'

const Q = Math.PI / 2

export const PLAZA_LAMPS: LampSpot[] = [
  { x: -38.5, z: -22, rotY: Q }, { x: 38.5, z: 20, rotY: -Q }, { x: -22, z: 29.5, rotY: Math.PI }, { x: 22, z: -27.5, rotY: 0 },
  { x: -38.5, z: 18, rotY: Q }, { x: 38.5, z: -14, rotY: -Q },
  { x: -38.5, z: -2, rotY: Q }, { x: 38.5, z: 3, rotY: -Q }, { x: 2, z: 29.5, rotY: Math.PI }, { x: 24, z: 29.5, rotY: Math.PI },
  { x: -18, z: -27.5, rotY: 0 }, { x: -4, z: 29.5, rotY: Math.PI },
]

export const PLAZA_BENCHES: Spot[] = [
  { x: -15, z: -26, rotY: 0 }, { x: 15.5, z: -26.5, rotY: 0 },
  { x: -39.6, z: 3, rotY: Q }, { x: 39.4, z: -6, rotY: -Q },
  { x: -24, z: 28, rotY: Math.PI }, { x: 18, z: 28.4, rotY: Math.PI }, { x: -12, z: 28.4, rotY: Math.PI },
]
export const PLAZA_BINS: Spot[] = [
  { x: -13.2, z: -26.3, rotY: 0 }, { x: 39.4, z: -8, rotY: 0 }, { x: -39.6, z: 5, rotY: 0 }, { x: 20, z: 28.6, rotY: 0 },
]
export const PLAZA_KIOSKS: Spot[] = [{ x: 35.5, z: 13.5, rotY: -Q }]

const MUSEO_FACE = -42.95
const PALACIO_FACE = -31.95
const war = 0.3

export const PLAZA_POSTERS: Poster[] = [
  { at: [MUSEO_FACE, 1.7, -20], rotY: Q, lines: ['SE BUSCA', 'PASANTE', 'SIN SUELDO'], bg: '#efe2bf', fg: '#7a1e12', from: war },
  { at: [MUSEO_FACE, 1.6, -18.8], rotY: Q, lines: ['DECRETO', '004', 'TODOS AL', 'FRENTE'], bg: '#c81f2e', fg: '#fff6e8', from: war },
  { at: [MUSEO_FACE, 1.7, 22], rotY: Q, lines: ['BUÑUELOS', '3 x 2', 'SE ACEPTA', 'TRUEQUE'], bg: '#f3b23a', fg: '#2b1606', from: war },
  { at: [MUSEO_FACE, 1.65, 23.2], rotY: Q, lines: ['¿Y MI CITA?', 'PRÓXIMA:', 'MARZO 2050'], bg: '#e8f0d8', fg: '#2b5a2b', from: war },
  { at: [-18, 1.7, PALACIO_FACE], rotY: 0, lines: ['LA U', 'NO SE', 'VENDE'], bg: '#1d1d20', fg: '#f2b705', from: war },
  { at: [-16.9, 1.6, PALACIO_FACE], rotY: 0, lines: ['TOQUE', 'DE QUEDA', '6:00 P.M.'], bg: '#efe6d2', fg: '#1b1b1b', from: war },
  { at: [17.5, 1.7, PALACIO_FACE], rotY: 0, lines: ['PAZ Y', 'SALVO', 'EXPRÉS', '¡PREGUNTE!'], bg: '#2c5f8a', fg: '#ffffff', from: war },
  { at: [36.42, 1.6, 13.0], rotY: Q, lines: ['GACETA', 'OFICIAL', 'TODO', 'BIEN'], bg: '#efe6d2', fg: '#1b1b1b' },
  { at: [36.42, 1.6, 14.1], rotY: Q, lines: ['SE ALQUILA', 'BALCÓN', 'PARA', 'DISCURSOS'], bg: '#f6d9a8', fg: '#7a1e12' },
]

// Metro line A runs north–south just east of the plaza; Parque Berrío station is next door.
export const METRO_X = 52
export const STAIRS_FOOT: [number, number] = [44.6, 24]

const HAZE_BOUNDS = { minX: PLAZA.minX - 10, maxX: PLAZA.maxX + 10, minZ: PLAZA.minZ - 6, maxZ: PLAZA.maxZ + 8 }
const SHAFT_BOUNDS = { minX: PLAZA.minX + 4, maxX: PLAZA.maxX - 4, minZ: PLAZA.minZ + 2, maxZ: PLAZA.maxZ - 2 }

export const PlazaDressing = memo(function PlazaDressing() {
  return (
    <group>
      <FacadeDetails />
      <Lamps spots={PLAZA_LAMPS} realLights={6} />
      <StreetProps benches={PLAZA_BENCHES} bins={PLAZA_BINS} kiosks={PLAZA_KIOSKS} posters={PLAZA_POSTERS} />
      <Metro from={[METRO_X, -150]} to={[METRO_X, 150]} station={174} stationName="Parque Berrío" stairs={{ at: STAIRS_FOOT, rotY: -Q }} />
      <Haze bounds={HAZE_BOUNDS} />
      <LightShafts bounds={SHAFT_BOUNDS} />
    </group>
  )
})
