// Game rules shared by the client and the API. Changing a choice id here changes onchain stats.

// Onchain choice ids (uint16) for every recorded decision.
export const CHOICE_IDS: Record<string, number> = {
  L1_PARO: 101,
  L1_EMPRESA: 102,
  L1_RETEN: 103,
  L1_FIRMA: 104,
  L1_HERIDO: 105,
}

// Every new citizen starts with these, minted with the task 1 checkpoint.
export const WELCOME_BONUS = 50

// Max buñuelos a task can mint, indexed by task number. Task 1 includes the welcome bonus.
export const TASK_EARN_CAP: Record<number, number> = { 1: 40 + WELCOME_BONUS, 2: 40, 3: 100, 4: 100, 5: 60 }
