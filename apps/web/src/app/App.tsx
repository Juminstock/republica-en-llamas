import { useEffect } from 'react'
import { useGame, type Screen } from '../features/session/gameStore'
import { TitleOverlay } from '../features/screens/IntroScreens'
import { GameScreen } from '../features/screens/GameScreen'
import { CinematicOverlay } from '../features/screens/CinematicOverlay'
import { AccountBridge, StartWithLogin } from '../features/screens/Login'
import { Registraduria } from '../features/registraduria/Registraduria'
import { ChainSpike } from '../features/dev/ChainSpike'
import { GameCanvas } from '../three/GameCanvas'
import { useStage, type StageMode } from '../three/stage'
import { useChain } from '../lib/chain/chainStore'
import { deployment } from '../lib/chain/contracts'
import { releaseMouseLook } from '../three/player/controls'
import { chainEnabled } from '../lib/env'
import { SelloToasts } from '../features/sellos/SelloToast'

const isSpike = new URLSearchParams(window.location.search).has('spike')

const STAGE_FOR: Record<Screen, StageMode> = { title: 'title', intro: 'intro', registraduria: 'title', game: 'play' }

function startGame() {
  useGame.getState().go('intro')
}

function afterIntro() {
  const { address, cedulaId } = useChain.getState()
  const needsCedula = chainEnabled && deployment && address && cedulaId === 0n
  useGame.getState().go(needsCedula ? 'registraduria' : 'game')
}

export function App() {
  if (isSpike) return <ChainSpike />
  return (
    <>
      {chainEnabled && <AccountBridge />}
      <Experience />
    </>
  )
}

function Experience() {
  const screen = useGame((s) => s.screen)

  useEffect(() => {
    const stage = useStage.getState()
    stage.setMode(STAGE_FOR[screen])
    if (screen === 'title' || screen === 'registraduria') stage.set({ ruin: 1, mood: 'dusk', subtitle: null, letterbox: false, fade: 0, location: 'plaza' })
    if (screen === 'game') stage.set({ ruin: 1, mood: 'golden', subtitle: null, letterbox: false, fade: 0, location: 'plaza' })
    if (screen !== 'game') releaseMouseLook()
  }, [screen])

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <GameCanvas onIntroDone={afterIntro} />
      {screen === 'title' && (
        <TitleOverlay start={chainEnabled ? <StartWithLogin onStart={startGame} /> : <button className="btn px-10 py-3 text-2xl" onClick={startGame}>¡Empieza a jugar!</button>} />
      )}
      {screen === 'intro' && <CinematicOverlay onSkip={afterIntro} />}
      {screen === 'registraduria' && chainEnabled && <Registraduria />}
      {screen === 'game' && <GameScreen />}
      <SelloToasts />
    </div>
  )
}
