import { useGame } from '../features/session/gameStore'
import { Disclaimer, Title } from '../features/screens/IntroScreens'
import { GameScreen } from '../features/screens/GameScreen'
import { AccountBridge, Login } from '../features/screens/Login'
import { Registraduria } from '../features/registraduria/Registraduria'
import { ChainSpike } from '../features/dev/ChainSpike'
import { chainEnabled } from '../lib/env'

const isSpike = new URLSearchParams(window.location.search).has('spike')

export function App() {
  if (isSpike) return <ChainSpike />
  return (
    <>
      {chainEnabled && <AccountBridge />}
      <Screens />
    </>
  )
}

function Screens() {
  const screen = useGame((s) => s.screen)
  switch (screen) {
    case 'disclaimer':
      return <Disclaimer />
    case 'title':
      return <Title />
    case 'login':
      return chainEnabled ? <Login /> : <GameScreen />
    case 'registraduria':
      return chainEnabled ? <Registraduria /> : <GameScreen />
    case 'game':
      return <GameScreen />
  }
}
