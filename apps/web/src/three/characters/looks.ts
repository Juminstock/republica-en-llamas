import type { FaceShape, HairStyleKey } from './head'
import type { CharacterId } from './types'

export type HairStyle = HairStyleKey

export type Accessory =
  | 'backpack'
  | 'headset'
  | 'hood'
  | 'labCoat'
  | 'armband'
  | 'messengerBag'
  | 'blazerLapels'
  | 'folderBag'
  | 'suitLapels'
  | 'tie'
  | 'sash'
  | 'glasses'
  | 'cardigan'
  | 'vest'
  | 'lanyard'
  | 'bandana'
  | 'helmet'
  | 'tacticalVest'
  | 'beard'
  | 'stubble'
  | 'pocketSquare'
  | 'flagPin'
  | 'stethoscope'
  | 'belt'

export type Look = {
  skin: string
  hair: string
  hairStyle: HairStyle
  eyes: string
  top: string
  // Visible shirt under an open jacket or coat (V at the chest), if any.
  inner?: string
  bottom: string
  shoes: string
  accent?: string
  height: number
  girth: number
  shoulders: number
  // Forward hunch of the upper spine, radians.
  hunch: number
  longSleeves: boolean
  feminine: boolean
  accessories: Accessory[]
  face?: Partial<FaceShape>
  brows?: string
  browThick?: number
  beardColor?: string
  // Grey mixed into the chin of the beard (0..1).
  beardGrey?: number
  lipTint?: string
  // Upright, chest-out posture (president) vs relaxed.
  posture?: number
  // A resting half smile layered under every expression (0..1).
  restSmile?: number
}

const base: Omit<Look, 'skin' | 'hair' | 'hairStyle' | 'top' | 'bottom' | 'shoes'> = {
  eyes: '#3b2416',
  height: 1,
  girth: 1,
  shoulders: 1,
  hunch: 0,
  longSleeves: true,
  feminine: false,
  accessories: [],
}

export const LOOKS: Record<Exclude<CharacterId, 'student'>, Look> = {
  vale: {
    ...base,
    skin: '#b07650',
    hair: '#17100d',
    hairStyle: 'ponytail',
    eyes: '#2a1a10',
    top: '#5e3bb5',
    bottom: '#2a2b33',
    shoes: '#e6e1d8',
    accent: '#f2b705',
    height: 0.955,
    shoulders: 0.95,
    feminine: true,
    accessories: ['hood', 'backpack', 'headset'],
    face: { feminine: true, jaw: 0.92, chin: 0.9, cheek: 1.15, nose: 0.86, noseLen: 0.92, noseW: 0.95, lips: 1.1, eyeSize: 1.08, faceW: 0.95, hairline: 0.15 },
    brows: '#1a120e',
    browThick: 0.85,
    lipTint: '#9c4a45',
  },
  andres: {
    ...base,
    skin: '#6b3f26',
    hair: '#100b09',
    hairStyle: 'curlyShort',
    eyes: '#24160e',
    top: '#2f8f8a',
    inner: '#2f8f8a',
    bottom: '#2f8f8a',
    shoes: '#2a2a2e',
    accent: '#d7263d',
    shoulders: 1.04,
    accessories: ['labCoat', 'armband', 'messengerBag', 'stubble', 'stethoscope'],
    face: { jaw: 1.05, chin: 1.02, cheek: 1.05, nose: 1.08, noseW: 1.15, lips: 1.15, faceW: 1.0, hairline: 0.148 },
    brows: '#0e0907',
    browThick: 1.1,
    beardColor: '#120c0a',
    lipTint: '#5e2f26',
  },
  camila: {
    ...base,
    skin: '#d39b74',
    hair: '#4a2814',
    hairStyle: 'wavyShoulder',
    eyes: '#4a2e17',
    top: '#b51d31',
    inner: '#f2efe8',
    bottom: '#23242c',
    shoes: '#3a2418',
    accent: '#7a4a24',
    height: 0.965,
    shoulders: 0.95,
    feminine: true,
    accessories: ['blazerLapels', 'folderBag', 'belt'],
    face: { feminine: true, jaw: 0.94, chin: 0.95, cheek: 1.1, nose: 0.9, noseLen: 0.95, lips: 1.12, eyeSize: 1.05, faceW: 0.97, hairline: 0.15 },
    brows: '#3a2012',
    browThick: 0.9,
    lipTint: '#a34a48',
  },
  // Satirical caricature of the president, from reference photos.
  president: {
    ...base,
    skin: '#c48e68',
    hair: '#16110f',
    hairStyle: 'slicked',
    eyes: '#2b1a10',
    top: '#1a2340',
    inner: '#f3f3f0',
    bottom: '#1a2340',
    shoes: '#141418',
    accent: '#16213d',
    height: 1.03,
    girth: 0.95,
    shoulders: 1.06,
    posture: 1,
    restSmile: 0.45,
    accessories: ['suitLapels', 'tie', 'sash', 'beard', 'pocketSquare', 'flagPin', 'belt'],
    face: { jaw: 0.95, chin: 1.04, chinFwd: 0.35, cheek: 1.3, nose: 1.1, noseLen: 1.18, noseW: 0.88, lips: 0.92, faceLen: 1.1, faceW: 0.88, ear: 1.12, eyeSize: 1.04, hairline: 0.17, temples: 1.1 },
    brows: '#120d0b',
    browThick: 1.4,
    beardColor: '#33261e',
    beardGrey: 0.65,
    lipTint: '#8a4a40',
  },
  rector: {
    ...base,
    skin: '#c18c66',
    hair: '#c9c6c0',
    hairStyle: 'greyBalding',
    top: '#7a5233',
    inner: '#e8e2d2',
    bottom: '#4b4740',
    shoes: '#3a2a1e',
    height: 0.95,
    girth: 1.12,
    hunch: 0.28,
    accessories: ['cardigan', 'glasses', 'tie', 'belt'],
    face: { jaw: 1.05, chin: 0.95, cheek: 0.9, nose: 1.15, noseLen: 1.1, lips: 0.9, faceLen: 1.05, ear: 1.15, hairline: 0.2 },
    brows: '#b9b4ab',
    browThick: 1.2,
  },
  clerk: {
    ...base,
    skin: '#a06c48',
    hair: '#231a14',
    hairStyle: 'short',
    top: '#e6e2d6',
    bottom: '#3d4150',
    shoes: '#1d1d22',
    accent: '#3d5a8a',
    girth: 1.12,
    longSleeves: false,
    accessories: ['vest', 'tie', 'lanyard', 'belt'],
    face: { jaw: 1.08, nose: 1.1, cheek: 0.95, faceW: 1.05 },
    brows: '#1e1612',
  },
  soldier: {
    ...base,
    skin: '#86563a',
    hair: '#16110e',
    hairStyle: 'short',
    top: '#4d5a37',
    bottom: '#48532f',
    shoes: '#17150f',
    accent: '#2f3622',
    shoulders: 1.08,
    accessories: ['helmet', 'tacticalVest', 'belt'],
    face: { jaw: 1.12, chin: 1.05, cheek: 1.0, nose: 1.05 },
    brows: '#140f0c',
    browThick: 1.2,
  },
}

const STUDENT_SKINS = ['#d6a07c', '#9c6644', '#6c3f25', '#c58b62', '#e1b391', '#83502f']
const STUDENT_HAIR = ['#141010', '#3b2414', '#1e1714', '#5a3a20', '#0f0c0b']
const STUDENT_TOPS = ['#2f6f4f', '#c0522c', '#2b4f8a', '#8a2b4f', '#d1a43a', '#4a4a52', '#1f7a7a', '#7a3fa0']
const STUDENT_BOTTOMS = ['#2a2d38', '#3f4b63', '#24262c', '#51463a', '#1c3550']
const STUDENT_HAIRSTYLES: HairStyle[] = ['short', 'bun', 'curlyShort', 'ponytail', 'short', 'wavyShoulder']

export function studentLook(variant = 0): Look {
  const v = Math.abs(Math.floor(variant))
  const pick = <T,>(arr: T[], salt: number) => arr[(v * 7 + salt * 3 + v * salt) % arr.length]
  const hairStyle = pick(STUDENT_HAIRSTYLES, 1)
  const feminine = hairStyle === 'bun' || hairStyle === 'ponytail' || hairStyle === 'wavyShoulder'
  const accessories: Accessory[] = []
  if (v % 2 === 0) accessories.push('backpack')
  if (v % 3 === 1) accessories.push('bandana')
  // Shapes are bucketed so crowds share a few sculpts.
  const girth = [0.95, 1.03, 1.12][v % 3]
  return {
    ...base,
    skin: pick(STUDENT_SKINS, 2),
    hair: pick(STUDENT_HAIR, 4),
    hairStyle,
    top: pick(STUDENT_TOPS, 5),
    bottom: pick(STUDENT_BOTTOMS, 6),
    shoes: v % 2 ? '#e8e4dc' : '#2a2a2e',
    accent: v % 3 === 1 ? ['#d7263d', '#f2b705', '#1f7a7a'][v % 3] : undefined,
    height: feminine ? 0.95 : 0.99,
    girth,
    shoulders: feminine ? 0.94 : 1.02,
    longSleeves: v % 4 !== 3,
    feminine,
    accessories,
    face: { feminine, jaw: feminine ? 0.92 : 1 + (v % 2) * 0.08, nose: 0.95 + (v % 3) * 0.06, lips: feminine ? 1.1 : 1, hairline: 0.15 },
    brows: pick(STUDENT_HAIR, 4),
  }
}

const CLERK_VARIANTS: Partial<Look>[] = [
  {},
  {
    skin: '#d8a882',
    hair: '#5b4636',
    hairStyle: 'bun',
    feminine: true,
    height: 0.95,
    shoulders: 0.93,
    top: '#d9dfe8',
    accent: '#7a2f3a',
    accessories: ['vest', 'lanyard', 'glasses'],
    face: { feminine: true, jaw: 0.95, lips: 1.1, nose: 0.95, hairline: 0.15 },
    brows: '#4a382b',
  },
  { skin: '#6a3f27', hair: '#2a2a2a', hairStyle: 'greyBalding', top: '#efe6cf', accent: '#3d5a3a', girth: 1.2, accessories: ['vest', 'tie', 'lanyard', 'belt'], face: { jaw: 1.12, nose: 1.15, hairline: 0.2 }, brows: '#2a2a2a' },
]

export function lookFor(id: CharacterId, variant = 0): Look {
  if (id === 'student') return studentLook(variant)
  if (id === 'clerk') return { ...LOOKS.clerk, ...CLERK_VARIANTS[Math.abs(Math.floor(variant)) % CLERK_VARIANTS.length] }
  return LOOKS[id]
}
