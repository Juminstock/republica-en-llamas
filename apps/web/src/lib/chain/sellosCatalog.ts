// Level 1 stamps. Shared by the game and the API; ids are level * 1000 + 100 + n (uint16 onchain).
export const SELLOS = {
  biblioteca: { id: 1101, label: 'Biblioteca Carlos Gaviria Díaz (UdeA)' },
  bienestar: { id: 1102, label: 'Bienestar Universitario' },
  tesoreria: { id: 1103, label: 'Tesorería' },
  asamblea: { id: 1104, label: 'Asamblea del paro' },
  rectoria: { id: 1105, label: 'Paz y salvo del rector' },
} as const

export type SelloKey = keyof typeof SELLOS

export const SELLO_KEYS = Object.keys(SELLOS) as SelloKey[]

export function selloKeyForId(id: number): SelloKey | null {
  return SELLO_KEYS.find((k) => SELLOS[k].id === id) ?? null
}
