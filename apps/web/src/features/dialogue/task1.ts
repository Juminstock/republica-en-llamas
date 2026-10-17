import { useGame } from '../session/gameStore'
import { grantSello } from '../sellos/grant'
import type { SelloKey } from '../../lib/chain/sellos'
import type { Expression, Gesture } from '../../three/characters/types'

export type Who = 'npc' | 'camila' | 'vale' | 'andres'

export type DialogueOption = {
  label: string
  cost?: number
  // Hidden when this returns false (e.g. an argument already used up).
  visible?: () => boolean
  // Returns the next dialogue id, or null to close.
  pick: () => string | null
}

export type DialogueNode = {
  speaker: string
  who: Who
  text: string
  options: DialogueOption[]
  // Telltale style countdown; on timeout the option at timeoutOption is taken.
  timer?: { seconds: number; timeoutOption: number }
  // Onchain decision this node records.
  choiceId?: string
  // Body language for the people in the shot while this line is on screen.
  stage?: Partial<Record<Who, { gesture?: Gesture; expression?: Expression }>>
}

const g = () => useGame.getState()
const say = (text: string) => g().showToast(text)
const tries = (key: string) => g().attempts[key] ?? 0
const next = (label = 'Siguiente', to: string | null = null): DialogueOption => ({ label, pick: () => to })

function stamp(key: SelloKey, line: string): string | null {
  grantSello(key)
  say(line)
  return null
}

// Task 1 "Paz y Salvo". Nothing comes easy: obstacles, retries and help from the other two.
export const TASK1: Record<string, DialogueNode> = {
  // ─── Biblioteca Carlos Gaviria Díaz (UdeA) ───
  biblioteca: {
    speaker: 'Funcionaria de Biblioteca',
    who: 'npc',
    text: 'Usted tiene una multa de 2019: "El coronel no tiene quien le escriba". Con intereses de guerra son 40 buñuelos. Sin paz y salvo de biblioteca no hay pasantía.',
    stage: { npc: { gesture: 'crossArms', expression: 'smug' }, camila: { expression: 'worried' } },
    options: [
      { label: 'Pagar la multa completa', cost: 40, pick: () => stamp('biblioteca', 'Sello de Biblioteca: pagaste hasta el último buñuelo.') },
      {
        label: 'Camila: alegar prescripción',
        visible: () => tries('bib-camila') < 2,
        pick: () => (g().bump('bib-camila') === 1 ? 'biblioteca_camila_1' : 'biblioteca_camila_2'),
      },
      { label: 'Pedirle a Vale que revise el sistema', visible: () => !g().flags['bib-hacked'], pick: () => 'biblioteca_vale' },
    ],
  },
  biblioteca_camila_1: {
    speaker: 'Funcionaria de Biblioteca',
    who: 'npc',
    text: 'La prescripción quedó suspendida por el Decreto 007 de Conmoción Total. Siguiente, por favor.',
    stage: { npc: { gesture: 'talk', expression: 'smug' }, camila: { expression: 'angry' } },
    options: [next('Insistir', 'biblioteca'), next('Retirarse')],
  },
  biblioteca_camila_2: {
    speaker: 'Camila',
    who: 'camila',
    text: 'Artículo 67 de la Constitución: la educación es un derecho. Ningún decreto de excepción puede cobrar intereses de guerra sobre un libro.',
    stage: { camila: { gesture: 'point', expression: 'determined' }, npc: { expression: 'surprised' } },
    options: [next('…', 'biblioteca_camila_3')],
  },
  biblioteca_camila_3: {
    speaker: 'Funcionaria de Biblioteca',
    who: 'npc',
    text: 'Hace años nadie me citaba la Constitución. Le dejo la multa en 10 buñuelos. Y no me lo vuelva a citar, que me da nostalgia.',
    stage: { npc: { gesture: 'shrug', expression: 'sad' }, camila: { expression: 'smile' } },
    options: [
      { label: 'Pagar 10 buñuelos', cost: 10, pick: () => stamp('biblioteca', 'Sello de Biblioteca: por la Constitución (y 10 buñuelos).') },
      next('Ahora no'),
    ],
  },
  biblioteca_vale: {
    speaker: 'Vale',
    who: 'vale',
    text: 'Esto corre en Windows XP… Puedo borrar la multa, pero si la funcionaria me ve, nos fichan a los tres. Necesito una distracción.',
    stage: { vale: { gesture: 'thinking', expression: 'worried' } },
    options: [
      { label: 'Andrés, distráela', pick: () => 'biblioteca_andres' },
      next('Mejor no arriesgarnos', 'biblioteca'),
    ],
  },
  biblioteca_andres: {
    speaker: 'Andrés',
    who: 'andres',
    text: 'Doña, perdón… ¿hace cuánto no se toma la presión? La veo pálida. Siéntese, yo soy de Medicina.',
    stage: { andres: { gesture: 'talk', expression: 'worried' }, npc: { expression: 'surprised' }, vale: { gesture: 'typing', expression: 'determined' } },
    options: [next('…', 'biblioteca_hacked')],
  },
  biblioteca_hacked: {
    speaker: 'Vale',
    who: 'vale',
    text: 'Listo. Multa borrada. También la de otros 3.000 estudiantes, pero eso es un efecto secundario.',
    stage: { vale: { gesture: 'none', expression: 'smug' }, andres: { gesture: 'thinking' } },
    options: [
      {
        label: 'Recibir el sello',
        pick: () => {
          g().setFlag('bib-hacked')
          g().adjust({ corruption: 1 })
          return stamp('biblioteca', 'Sello de Biblioteca. Vale recordará esto.')
        },
      },
    ],
  },

  biblioteca_traslado: {
    speaker: 'Funcionaria de Biblioteca',
    who: 'npc',
    text: 'Biblioteca en el exilio, mija. Aquí solo guardo el letrero. Los paz y salvos los firma la Biblioteca Carlos Gaviria Díaz, en la UdeA. Tome el Metro… si pasa.',
    stage: { npc: { gesture: 'shrug', expression: 'sad' }, camila: { expression: 'worried' } },
    options: [next('Ir a la UdeA en Metro')],
  },

  // ─── Bienestar Universitario (plaza) ───
  bienestar: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: 'Para el paz y salvo necesita cita previa. La próxima disponible es el 14 de marzo de 2050, a las 6:40 a. m.',
    stage: { npc: { gesture: 'typing', expression: 'neutral' } },
    options: [
      {
        label: 'Camila: pedir una cita de urgencia',
        visible: () => tries('bien-camila') < 3,
        pick: () => ['bienestar_no_1', 'bienestar_no_2', 'bienestar_no_3'][g().bump('bien-camila') - 1],
      },
      { label: 'Pedirle a Andrés que hable con ella', pick: () => 'bienestar_andres' },
      { label: 'Ofrecer buñuelos "para el tinto"', cost: 15, visible: () => !g().flags['bien-bribe-low'], pick: () => 'bienestar_soborno' },
    ],
  },
  bienestar_no_1: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: 'No hay excepciones. Ni siquiera en guerra. Sobre todo en guerra.',
    stage: { npc: { gesture: 'crossArms', expression: 'angry' }, camila: { expression: 'worried' } },
    options: [next('Insistir', 'bienestar'), next('Retirarse')],
  },
  bienestar_no_2: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: 'Le dije que no. Si insiste, le corro la cita para el 2051.',
    stage: { npc: { gesture: 'point', expression: 'angry' }, camila: { gesture: 'facepalm' } },
    options: [next('Insistir', 'bienestar'), next('Retirarse')],
  },
  bienestar_no_3: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: 'Listo: 14 de marzo de 2051. ¿Algo más?',
    stage: { npc: { gesture: 'typing', expression: 'smug' }, camila: { expression: 'sad' }, vale: { gesture: 'shrug' } },
    options: [next('Camila: "Me rindo"', 'bienestar')],
  },
  bienestar_andres: {
    speaker: 'Andrés',
    who: 'andres',
    text: 'Señora, en el campamento hay gente herida y nadie que la atienda. Si me deja ayudar en la enfermería, ¿nos adelanta la cita?',
    stage: { andres: { gesture: 'talk', expression: 'determined' } },
    options: [next('…', 'bienestar_andres_2')],
  },
  bienestar_andres_2: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: 'Trato. Pero primero me revisa la espalda, que desde el paro duermo en este escritorio.',
    stage: { npc: { gesture: 'shrug', expression: 'smile' }, andres: { gesture: 'reach', expression: 'smile' } },
    options: [
      {
        label: 'Andrés le revisa la espalda',
        pick: () => {
          g().adjust({ trust: 1 })
          return stamp('bienestar', 'Sello de Bienestar: Andrés recordará esto.')
        },
      },
    ],
  },
  bienestar_soborno: {
    speaker: 'Bienestar Universitario',
    who: 'npc',
    text: '¿Me está sobornando? …Con 15 no alcanza ni para el tinto. En este país todo subió, mija.',
    stage: { npc: { gesture: 'crossArms', expression: 'smug' } },
    options: [
      {
        label: 'Subir a 25 en total',
        cost: 10,
        pick: () => {
          g().adjust({ corruption: 1 })
          return stamp('bienestar', 'Sello de Bienestar. Soborno registrado en la blockchain.')
        },
      },
      {
        label: 'Retirarse (los 15 ya no vuelven)',
        pick: () => {
          g().setFlag('bien-bribe-low')
          return null
        },
      },
    ],
  },

  // ─── Tesorería (plaza) ───
  tesoreria: {
    speaker: 'Tesorería',
    who: 'npc',
    text: 'Usted debe cero pesos. Pero el sistema dice que debe. Para certificar que no debe, pague el certificado de no deuda: 5 buñuelos.',
    stage: { npc: { gesture: 'typing', expression: 'neutral' } },
    options: [
      { label: 'Pagar el certificado', cost: 5, pick: () => (g().bump('teso-pay') < 3 ? 'tesoreria_caido' : 'tesoreria_ok') },
      { label: 'Pedir turno y esperar', pick: () => (g().bump('teso-turn') < 3 ? 'tesoreria_turno' : 'tesoreria_847') },
      { label: 'Vale: "¿Y si reinicio el router?"', visible: () => tries('teso-pay') + tries('teso-turn') >= 2, pick: () => 'tesoreria_vale' },
    ],
  },
  tesoreria_caido: {
    speaker: 'Tesorería',
    who: 'npc',
    text: 'Uy. Se cayó el sistema justo cuando iba a imprimir. Le devuelvo sus buñuelos. Intente de nuevo.',
    stage: { npc: { gesture: 'facepalm', expression: 'worried' }, camila: { expression: 'angry' } },
    options: [
      {
        label: 'Recibir los buñuelos',
        pick: () => {
          g().earn(5)
          return 'tesoreria'
        },
      },
    ],
  },
  tesoreria_ok: {
    speaker: 'Tesorería',
    who: 'npc',
    text: '¡Volvió el sistema! Rápido, antes de que se vuelva a caer… listo. Certificado de que usted no debe nada. Son 5 buñuelos, gracias.',
    stage: { npc: { gesture: 'stamp', expression: 'smile' } },
    options: [{ label: 'Recibir el sello', pick: () => stamp('tesoreria', 'Sello de Tesorería: pagaste por no deber.') }],
  },
  tesoreria_turno: {
    speaker: 'Tesorería',
    who: 'npc',
    text: 'Su ficho es el 847. Vamos en el 846. Hace tres semanas.',
    stage: { npc: { gesture: 'crossArms', expression: 'neutral' }, vale: { gesture: 'shrug' } },
    options: [next('Esperar más', 'tesoreria'), next('Volver después')],
  },
  tesoreria_847: {
    speaker: 'Tesorería',
    who: 'npc',
    text: '¡Ochocientos cuarenta y siete! Increíble. Tome su paz y salvo, gratis. No se lo cuente a nadie.',
    stage: { npc: { gesture: 'stamp', expression: 'surprised' }, camila: { expression: 'smile' } },
    options: [{ label: 'Recibir el sello', pick: () => stamp('tesoreria', 'Sello de Tesorería, gratis y con paciencia.') }],
  },
  tesoreria_vale: {
    speaker: 'Vale',
    who: 'vale',
    text: 'Disculpe… ese router tiene la luz roja desde 2024. ¿Me deja?',
    stage: { vale: { gesture: 'typing', expression: 'determined' }, npc: { expression: 'surprised' } },
    options: [next('…', 'tesoreria_ok')],
  },

  // ─── La asamblea del paro (plaza) ───
  asamblea: {
    speaker: 'Vocera del paro',
    who: 'npc',
    text: 'La asamblea va a votar el bloqueo total del Palacio, donde se escondió el rector. Nadie entra, nadie sale. ¿Usted con quién está, compañera?',
    choiceId: 'L1_PARO',
    timer: { seconds: 10, timeoutOption: 0 },
    stage: { npc: { gesture: 'fistRaise', expression: 'determined' }, camila: { expression: 'worried' } },
    options: [
      {
        label: 'Votar con el paro',
        pick: () => {
          g().choose('L1_PARO', 0)
          g().adjust({ trust: 2 })
          g().setFlag('paro')
          return stamp('asamblea', 'Votaste con el paro. La asamblea recordará esto.')
        },
      },
      {
        label: 'Cruzar la barricada',
        pick: () => {
          g().choose('L1_PARO', 1)
          g().adjust({ trust: -2 })
          g().setFlag('barricada')
          return stamp('asamblea', 'Cruzaste la barricada. La asamblea recordará esto.')
        },
      },
    ],
  },

  // ─── El rector (puerta del Palacio) ───
  rectoria_cerrada: {
    speaker: 'Puerta del Palacio',
    who: 'npc',
    text: 'Un letrero: "Rectoría en el exilio. Sin los sellos de Biblioteca, Bienestar y Tesorería, y sin pasar por la asamblea, NO TOQUE".',
    options: [next('Volver')],
  },
  rectoria: {
    speaker: 'El Rector',
    who: 'npc',
    text: 'Tres sellos… en plena guerra. Admirable. Pero falta la firma del decano, y el decano está exiliado en Miami.',
    stage: { npc: { gesture: 'shrug', expression: 'sad' }, camila: { expression: 'angry' } },
    options: [
      { label: 'Camila: citar el reglamento estudiantil', pick: () => 'rectoria_camila' },
      { label: 'Pagarle "para el pasaje del decano"', cost: 20, pick: () => 'rectoria_soborno' },
    ],
  },
  rectoria_camila: {
    speaker: 'Camila',
    who: 'camila',
    text: 'Artículo 112 del reglamento: en ausencia del decano, firma el rector. Usted mismo lo aprobó en 2019.',
    stage: { camila: { gesture: 'point', expression: 'determined' }, npc: { expression: 'surprised' } },
    options: [next('…', 'rectoria_duda')],
  },
  rectoria_duda: {
    speaker: 'El Rector',
    who: 'npc',
    text: '¿Artículo 112? No recuerdo ese artículo. Muéstremelo.',
    stage: { npc: { gesture: 'thinking', expression: 'worried' } },
    options: [{ label: 'Vale busca el PDF en su portátil', pick: () => 'rectoria_vale' }],
  },
  rectoria_vale: {
    speaker: 'Vale',
    who: 'vale',
    text: 'Aquí está. Página 48. Subrayado en amarillo. De nada.',
    stage: { vale: { gesture: 'typing', expression: 'smug' }, npc: { expression: 'surprised' } },
    options: [next('…', 'rectoria_firma')],
  },
  rectoria_soborno: {
    speaker: 'El Rector',
    who: 'npc',
    text: 'Bueno… el pasaje está carísimo. Firmo en nombre del decano. Esto nunca pasó.',
    stage: { npc: { gesture: 'reach', expression: 'smug' } },
    options: [
      {
        label: 'Recibir el paz y salvo',
        pick: () => {
          g().adjust({ corruption: 1 })
          return 'rectoria_firma'
        },
      },
    ],
  },
  rectoria_firma: {
    speaker: 'El Rector',
    who: 'npc',
    text: 'Firmo su paz y salvo. Pensé que nadie se volvería a graduar en este país. Que Dios y el Ministerio los acompañen.',
    stage: { npc: { gesture: 'stamp', expression: 'smile' }, camila: { expression: 'smile' }, vale: { expression: 'smile' }, andres: { gesture: 'cheer', expression: 'smile' } },
    options: [
      {
        label: 'Recibir el paz y salvo',
        pick: () => {
          grantSello('rectoria')
          g().earn(20)
          g().completeTask()
          return null
        },
      },
    ],
  },
}

export const TASK1_STAMPS = ['biblioteca', 'bienestar', 'tesoreria', 'asamblea'] as const

export function dialogueFor(interactId: string, location: 'plaza' | 'udea' = 'plaza'): string | null {
  const state = g()
  if (interactId === 'biblioteca' && location === 'plaza' && !state.stamps.includes('biblioteca')) return 'biblioteca_traslado'
  if (interactId === 'rectoria') return TASK1_STAMPS.every((s) => state.stamps.includes(s)) ? 'rectoria' : 'rectoria_cerrada'
  if ((TASK1_STAMPS as readonly string[]).includes(interactId) && state.stamps.includes(interactId)) {
    state.showToast('Ese sello ya lo tienes.')
    return null
  }
  return interactId in TASK1 ? interactId : null
}
