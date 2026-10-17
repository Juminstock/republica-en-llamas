import { useGame } from '../session/gameStore'

export type DialogueOption = {
  label: string
  cost?: number
  // Returns the next dialogue id, or null to close.
  pick: () => string | null
}

export type DialogueNode = {
  speaker: string
  text: string
  options: DialogueOption[]
  // Telltale style countdown; on timeout the option at timeoutOption is taken.
  timer?: { seconds: number; timeoutOption: number }
  // Onchain decision this node records.
  choiceId?: string
}

const g = () => useGame.getState()

function remember(text: string) {
  g().showToast(text)
}

function stampAndClose(stamp: string, line: string): string | null {
  g().addStamp(stamp)
  remember(line)
  return null
}

// Task 1 "Paz y Salvo". Placeholder writing; final copy and Ink port come in M4.
export const TASK1: Record<string, DialogueNode> = {
  biblioteca: {
    speaker: 'Funcionaria de Biblioteca',
    text: 'Tiene una multa pendiente: "El coronel no tiene quien le escriba", prestado en 2019. Son 15 buñuelos con intereses de guerra.',
    options: [
      { label: 'Pagar la multa', cost: 15, pick: () => stampAndClose('biblioteca', 'Sello de Biblioteca: pagado.') },
      {
        label: 'Alegar prescripción (Camila)',
        pick: () => {
          g().adjust({ trust: 1 })
          return 'biblioteca_prescripcion'
        },
      },
      {
        label: 'Que Vale hackee el sistema',
        pick: () => {
          g().adjust({ corruption: 1 })
          return stampAndClose('biblioteca', 'Vale borró la multa. Vale recordará esto.')
        },
      },
    ],
  },
  biblioteca_prescripcion: {
    speaker: 'Funcionaria de Biblioteca',
    text: '…Artículo 2536 del Código Civil. Nadie me había citado un artículo desde antes de la guerra. Tome su sello, doctora.',
    options: [{ label: 'Gracias', pick: () => stampAndClose('biblioteca', 'Sello de Biblioteca: por la ley.') }],
  },
  bienestar: {
    speaker: 'Bienestar Universitario',
    text: 'Para el paz y salvo necesita cita. La próxima disponible es en marzo de 2031.',
    options: [
      {
        label: 'Negociar una cita de urgencia',
        pick: () => {
          g().adjust({ trust: 1 })
          return stampAndClose('bienestar', 'Camila consiguió la cita "para ayer".')
        },
      },
      {
        label: 'Ofrecer buñuelos "para el tinto"',
        cost: 10,
        pick: () => {
          g().adjust({ corruption: 1 })
          return stampAndClose('bienestar', 'Sello de Bienestar. Soborno registrado.')
        },
      },
    ],
  },
  tesoreria: {
    speaker: 'Tesorería',
    text: 'Usted debe cero pesos. Pero el sistema dice que debe. Para certificar que no debe, pague el certificado de no deuda: 5 buñuelos.',
    options: [
      { label: 'Pagar el certificado', cost: 5, pick: () => stampAndClose('tesoreria', 'Sello de Tesorería: pagaste por no deber.') },
      {
        label: 'Exigir el paz y salvo gratis',
        pick: () => {
          g().adjust({ trust: 1 })
          return 'tesoreria_fila'
        },
      },
    ],
  },
  tesoreria_fila: {
    speaker: 'Tesorería',
    text: 'Tiene razón. Tome su ficho: turno 847. Vamos en el 846. Hoy es su día de suerte.',
    options: [{ label: 'Esperar…', pick: () => stampAndClose('tesoreria', 'Sello de Tesorería, gratis y con paciencia.') }],
  },
  asamblea: {
    speaker: 'Vocera del paro',
    text: 'La asamblea va a votar el bloqueo total de la Rectoría. Nadie entra, nadie sale. ¿Usted con quién está, compañera?',
    choiceId: 'L1_PARO',
    timer: { seconds: 10, timeoutOption: 0 },
    options: [
      {
        label: 'Votar con el paro',
        pick: () => {
          g().choose('L1_PARO', 0)
          g().adjust({ trust: 2 })
          g().setFlag('paro')
          remember('El paro recordará esto.')
          return null
        },
      },
      {
        label: 'Cruzar la barricada',
        pick: () => {
          g().choose('L1_PARO', 1)
          g().adjust({ trust: -2 })
          g().setFlag('barricada')
          remember('La asamblea recordará esto.')
          return null
        },
      },
    ],
  },
  rectoria_cerrada: {
    speaker: 'Puerta de la Rectoría',
    text: 'Un letrero: "Sin los sellos de Biblioteca, Bienestar y Tesorería, no toque". Y la asamblea todavía no ha votado.',
    options: [{ label: 'Volver', pick: () => null }],
  },
  rectoria: {
    speaker: 'El Rector',
    text: 'Tres sellos… en plena guerra. Pensé que nadie se volvería a graduar en este país. Firmo su paz y salvo. Que Dios y el Ministerio la acompañen.',
    options: [
      {
        label: 'Recibir el paz y salvo',
        pick: () => {
          g().addStamp('rectoria')
          g().earn(20)
          g().completeTask()
          return null
        },
      },
    ],
  },
}

export function dialogueFor(interactId: string): string | null {
  const state = g()
  if (interactId === 'rectoria') {
    const ready = ['biblioteca', 'bienestar', 'tesoreria'].every((s) => state.stamps.includes(s)) && state.choices.some((c) => c.choiceId === 'L1_PARO')
    return ready ? 'rectoria' : 'rectoria_cerrada'
  }
  if (['biblioteca', 'bienestar', 'tesoreria'].includes(interactId) && state.stamps.includes(interactId)) {
    state.showToast('Ese sello ya lo tienes.')
    return null
  }
  if (interactId === 'asamblea' && state.choices.some((c) => c.choiceId === 'L1_PARO')) {
    state.showToast('La asamblea ya votó.')
    return null
  }
  return interactId in TASK1 ? interactId : null
}
