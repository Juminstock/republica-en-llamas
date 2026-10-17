import type { CharacterId, Expression, Gesture } from '../characters/types'
import type { Mood, Subtitle } from '../stage'
import type { Vec3 } from '../world/layout'
import type { LocationId } from '../world/locations'
import { CAMPFIRE_SEATS } from '../world/Camp'
import { UDEA_LANDMARKS } from '../world/udea/layout'

export type Shot = { start: number; end: number; from: [Vec3, Vec3]; to: [Vec3, Vec3]; shake?: number; fov?: number }
export type Line = Subtitle & { at: number; dur: number; actor?: string; gesture?: Gesture; expression?: Expression }
export type Group = 'udea' | 'balcony' | 'camp'
export type Cue = { at: number; run: 'jets' | 'blast' | 'show' | 'standUp'; at3?: Vec3; size?: number; groups?: Group[] }
export type Actor = { key: string; id: CharacterId; at: Vec3; rotY: number; gesture: Gesture; expression?: Expression; variant?: number; group: Group }

const FIRE: Vec3 = [8, 0, 12]
const face = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2])

// Sit on the world's logs, nudged back so the hips rest on the log rather than inside it.
const seat = (i: number): Vec3 => {
  const s = CAMPFIRE_SEATS[i]
  return [s.at[0] - Math.sin(s.rotY) * 0.12, 0, s.at[2] - Math.cos(s.rotY) * 0.12]
}
export const SEATS = { camila: seat(0), vale: seat(1), andres: seat(2) }

// ─── UdeA speech staging ───
const POD = UDEA_LANDMARKS.podium
const PRES: Vec3 = [POD[0], POD[1], POD[2] - 0.55]
const CROWD = UDEA_LANDMARKS.crowdArea
const V = UDEA_LANDMARKS.views
const udeaCrowd: Actor[] = Array.from({ length: 18 }, (_, i) => {
  const row = Math.floor(i / 6)
  const at: Vec3 = [CROWD[0] - 7.5 + (i % 6) * 3 + (row % 2) * 1.4, 0, CROWD[2] - 2 + row * 2.6]
  return { key: `udea-${i}`, id: 'student', at, rotY: face(at, PRES), gesture: i % 5 === 0 ? 'crossArms' : 'none', expression: i % 3 === 0 ? 'angry' : 'worried', variant: i % 6, group: 'udea' }
})

export const ACTORS: Actor[] = [
  { key: 'president', id: 'president', at: PRES, rotY: 0, gesture: 'podium', expression: 'smug', group: 'udea' },
  { key: 'guard-l', id: 'soldier', at: [POD[0] - 3, POD[1], POD[2] - 1.2], rotY: 0, gesture: 'crossArms', expression: 'neutral', group: 'udea' },
  { key: 'guard-r', id: 'soldier', at: [POD[0] + 3, POD[1], POD[2] - 1.2], rotY: 0, gesture: 'crossArms', expression: 'neutral', group: 'udea' },
  ...udeaCrowd,
  { key: 'president-balcony', id: 'president', at: [0, 9.5, -31.6], rotY: 0, gesture: 'salute', expression: 'determined', group: 'balcony' },
  { key: 'camila', id: 'camila', at: SEATS.camila, rotY: face(SEATS.camila, FIRE), gesture: 'sit', group: 'camp' },
  { key: 'vale', id: 'vale', at: SEATS.vale, rotY: face(SEATS.vale, FIRE), gesture: 'sit', group: 'camp' },
  { key: 'andres', id: 'andres', at: SEATS.andres, rotY: face(SEATS.andres, FIRE), gesture: 'sit', group: 'camp' },
]

// Close-up framing of a seated speaker at the fire.
function closeUp(seatAt: Vec3, side: number): [Vec3, Vec3] {
  const yaw = face(seatAt, FIRE)
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const cam: Vec3 = [seatAt[0] + fx * 1.95 + fz * 0.55 * side, 1.42, seatAt[2] + fz * 1.95 - fx * 0.55 * side]
  return [cam, [seatAt[0], 1.2, seatAt[2]]]
}
const push = ([cam, look]: [Vec3, Vec3], k: number): [Vec3, Vec3] => [[cam[0] + (look[0] - cam[0]) * k, cam[1], cam[2] + (look[2] - cam[2]) * k], look]
const view = (v: { pos: Vec3; lookAt: Vec3 }): [Vec3, Vec3] => [v.pos, v.lookAt]
const drift = ([p, l]: [Vec3, Vec3], dx: number, dy: number, dz: number): [Vec3, Vec3] => [[p[0] + dx, p[1] + dy, p[2] + dz], l]

const CU = { vale: closeUp(SEATS.vale, 1), andres: closeUp(SEATS.andres, -1), camila: closeUp(SEATS.camila, 1) }
const HEAD = PRES[1] + 1.62
const D = 18 // shift of the campfire scene relative to the first cut

export const SHOTS: Shot[] = [
  // Medellín, before
  { start: 0, end: 5, from: [[62, 46, 64], [0, 6, -22]], to: [[44, 34, 42], [0, 9, -30]] },
  // UdeA: the president's speech
  { start: 5, end: 10, from: view(V.aerial), to: drift(view(V.aerial), 26, -18, -30) },
  { start: 10, end: 15, from: [[CROWD[0] + 2, 1.65, CROWD[2] + 9], [PRES[0], HEAD, PRES[2]]], to: [[CROWD[0] + 1, 1.6, CROWD[2] + 6.5], [PRES[0], HEAD, PRES[2]]] },
  { start: 15, end: 20, from: [[PRES[0] + 1.6, HEAD + 0.1, PRES[2] + 3.4], [PRES[0], HEAD - 0.1, PRES[2]]], to: [[PRES[0] + 1.1, HEAD + 0.05, PRES[2] + 2.6], [PRES[0], HEAD - 0.05, PRES[2]]], fov: 40 },
  { start: 20, end: 25, from: [[PRES[0] - 0.9, HEAD + 0.35, PRES[2] - 1.6], [CROWD[0], 1.5, CROWD[2] + 2]], to: [[PRES[0] - 0.6, HEAD + 0.4, PRES[2] - 1.8], [CROWD[0] + 1.5, 1.4, CROWD[2] + 3]] },
  { start: 25, end: 30, from: [[PRES[0] + 0.55, HEAD + 0.02, PRES[2] + 1.55], [PRES[0], HEAD, PRES[2]]], to: [[PRES[0] + 0.35, HEAD + 0.02, PRES[2] + 1.15], [PRES[0], HEAD, PRES[2]]], fov: 36 },
  { start: 30, end: 35, from: view(V.monument), to: drift(view(V.monument), 1.2, 0.3, 1.5) },
  // Plaza: the decree is signed from the balcony
  { start: 35, end: 40, from: [[2.4, 11.4, -27.6], [0, 11.1, -31.6]], to: [[1.4, 11.3, -28.6], [0, 11.15, -31.6]], fov: 40 },
  // The war
  { start: 40, end: 47, from: [[-20, 3, 25], [20, 26, -90]], to: [[-17, 3.6, 21], [26, 30, -90]], shake: 0.25 },
  { start: 47, end: 53, from: [[24, 5, 28], [8, 16, -60]], to: [[16, 4.4, 20], [4, 18, -60]], shake: 0.35 },
  // Six months later
  { start: 53, end: 56, from: view(V.ruinedWide), to: view(V.ruinedWide) },
  { start: 56, end: 62, from: view(V.ruinedWide), to: drift(view(V.ruinedWide), -6, -6, -10) },
  { start: 62, end: 68, from: [[-29, 1.2, 29], [-14, 2.6, 6]], to: [[-21, 1.7, 18], [-6, 3, -10]] },
  // The campfire
  { start: 50 + D, end: 55 + D, from: [[15, 2.6, 21], [8, 0.8, 12]], to: [[13.2, 2.1, 18.6], [8, 0.8, 12]] },
  { start: 55 + D, end: 59.2 + D, from: CU.vale, to: push(CU.vale, 0.12), fov: 38 },
  { start: 59.2 + D, end: 63.4 + D, from: CU.andres, to: push(CU.andres, 0.12), fov: 38 },
  { start: 63.4 + D, end: 67.6 + D, from: CU.camila, to: push(CU.camila, 0.15), fov: 38 },
  { start: 67.6 + D, end: 70.6 + D, from: CU.vale, to: push(CU.vale, 0.1), fov: 38 },
  { start: 70.6 + D, end: 74.4 + D, from: CU.camila, to: push(CU.camila, 0.18), fov: 38 },
  { start: 74.4 + D, end: 79 + D, from: CU.andres, to: push(CU.andres, 0.12), fov: 38 },
  { start: 79 + D, end: 84 + D, from: [[11.5, 1.6, 17.5], [8, 0.9, 12.5]], to: [[10.8, 1.5, 16.8], [8, 0.9, 12.5]], fov: 38 },
  { start: 84 + D, end: 87.6 + D, from: CU.vale, to: push(CU.vale, 0.1), fov: 38 },
  { start: 87.6 + D, end: 92 + D, from: CU.camila, to: [[11.6, 2, 18.8], [7.6, 1.2, 13.4]], fov: 38 },
  { start: 92 + D, end: 96 + D, from: [[11.6, 2, 18.8], [7.6, 1.2, 13.4]], to: [[12, 7, 24], [2, 4, -20]] },
]

export const DURATION = 96 + D

export const LINES: Line[] = [
  { at: 0.8, dur: 3.8, style: 'title', text: 'MEDELLÍN · ANTES DE LA GUERRA' },
  { at: 5.4, dur: 4.2, style: 'title', text: 'UNIVERSIDAD DE ANTIOQUIA' },
  { at: 10.3, dur: 4.6, speaker: 'El Presidente', actor: 'president', style: 'decree', gesture: 'podium', expression: 'smug', text: 'Jóvenes de la Universidad de Antioquia: este país necesita disciplina. No pensadores.' },
  { at: 15.1, dur: 4.7, speaker: 'El Presidente', actor: 'president', style: 'decree', gesture: 'fistRaise', expression: 'determined', text: 'Decreto 001: Colombia entra a la guerra… para traer la paz.' },
  { at: 20.1, dur: 4.7, speaker: 'El Presidente', actor: 'president', style: 'decree', gesture: 'point', expression: 'angry', text: 'Decreto 002: se suspenden las pasantías en el exterior. Que practiquen aquí. En el frente.' },
  { at: 25.1, dur: 4.8, speaker: 'El Presidente', actor: 'president', style: 'decree', gesture: 'salute', expression: 'smug', text: 'Decreto 003: esta universidad será un cuartel. El conocimiento estorba.' },
  { at: 30.5, dur: 4.2, style: 'caption', text: 'Esa misma semana, el Gobierno firmó la alianza total con Estados Unidos.' },
  { at: 35.4, dur: 4.3, speaker: 'El Presidente', actor: 'president-balcony', style: 'decree', gesture: 'salute', expression: 'determined', text: '¡Colombia, firmes! El decreto queda firmado.' },
  { at: 41, dur: 6.5, style: 'caption', text: 'ÚLTIMA HORA · Frontera en llamas · Venezuela en ruinas · Toque de queda nacional' },
  { at: 53.3, dur: 2.6, style: 'title', text: 'SEIS MESES DESPUÉS' },
  { at: 56.5, dur: 5, style: 'caption', text: 'La UdeA es un cuartel militar. Su biblioteca atiende en una ventanilla, entre sacos de arena.' },
  { at: 62.5, dur: 5, style: 'caption', text: 'Sus estudiantes acampan en la Plaza Botero.' },
  { at: 55 + D, dur: 4.1, speaker: 'Vale', actor: 'vale', text: 'Seis meses sin internet decente… y la U todavía me cobra la matrícula.' },
  { at: 59.2 + D, dur: 4.1, speaker: 'Andrés', actor: 'andres', text: 'Me falta un examen para graduarme. Uno. Y el hospital ahora es un cuartel.' },
  { at: 63.4 + D, dur: 4.1, speaker: 'Camila', actor: 'camila', text: 'Escuchen. Si no nos graduamos este año, nos reclutan. El Decreto 004 lo dice clarito.' },
  { at: 67.6 + D, dur: 2.9, speaker: 'Vale', actor: 'vale', text: '¿Y qué hacemos, doctora?' },
  { at: 70.6 + D, dur: 3.7, speaker: 'Camila', actor: 'camila', text: 'Diez requisitos. Uno por uno. Primero: las pasantías.' },
  { at: 74.4 + D, dur: 4.5, speaker: 'Andrés', actor: 'andres', text: 'Para empezar pasantías hay que tener el paz y salvo del rector… y el rector se encerró en el Palacio.' },
  { at: 79 + D, dur: 4.9, speaker: 'Camila', actor: 'camila', text: 'Biblioteca en la UdeA, Bienestar y Tesorería en las carpas, y pasar por la asamblea. Cuatro sellos y la firma del rector.' },
  { at: 84 + D, dur: 3.5, speaker: 'Vale', actor: 'vale', text: 'Cuatro sellos en un país en guerra. ¿Qué podría salir mal?' },
  { at: 87.6 + D, dur: 3.2, speaker: 'Camila', actor: 'camila', text: 'Todo. Vamos.' },
  { at: 92 + D, dur: 3.8, style: 'title', text: 'MISIÓN 1 DE 10 · LAS PASANTÍAS' },
]

export const CUES: Cue[] = [
  { at: 5, run: 'show', groups: ['udea'] },
  { at: 35, run: 'show', groups: ['balcony'] },
  { at: 40, run: 'show', groups: [] },
  { at: 40.6, run: 'jets' },
  { at: 42, run: 'blast', at3: [40, 6, -120], size: 2.2 },
  { at: 43.3, run: 'blast', at3: [-34, 5, -130], size: 2.6 },
  { at: 44.6, run: 'jets' },
  { at: 45.4, run: 'blast', at3: [78, 9, -95], size: 2 },
  { at: 46.4, run: 'blast', at3: [8, 10, -105], size: 3.2 },
  { at: 48.2, run: 'blast', at3: [36, 4, -70], size: 1.8 },
  { at: 50, run: 'blast', at3: [-40, 4, -80], size: 2.4 },
  { at: 66, run: 'show', groups: ['camp'] },
  { at: 88.5 + D, run: 'standUp' },
]

// World state over time: which location, how ruined, which light.
export function worldAt(t: number): { ruin: number; mood: Mood; fade: number; location: LocationId } {
  const fadeIn = t < 1.2 ? 1 - t / 1.2 : 0
  if (t < 5) return { ruin: 0, mood: 'day', fade: fadeIn, location: 'plaza' }
  if (t < 35) return { ruin: 0, mood: 'day', fade: t < 5.6 ? 1 - (t - 5) / 0.6 : 0, location: 'udea' }
  if (t < 40) return { ruin: 0, mood: 'golden', fade: 0, location: 'plaza' }
  if (t < 51.5) return { ruin: Math.min(0.5, (t - 41) / 20), mood: 'dusk', fade: 0, location: 'plaza' }
  if (t < 53) return { ruin: 0.5, mood: 'dusk', fade: (t - 51.5) / 1.5, location: 'plaza' }
  if (t < 56) return { ruin: 1, mood: 'golden', fade: 1, location: 'udea' }
  if (t < 62) return { ruin: 1, mood: 'golden', fade: Math.max(0, 1 - (t - 56) / 1.2), location: 'udea' }
  if (t < 67) return { ruin: 1, mood: 'golden', fade: 0, location: 'plaza' }
  return { ruin: 1, mood: 'golden', fade: t > DURATION - 1 ? t - (DURATION - 1) : 0, location: 'plaza' }
}

export type { Subtitle }
