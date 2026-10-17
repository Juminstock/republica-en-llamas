import { useGame } from '../session/gameStore'
import { awardSello, type SelloKey } from '../../lib/chain/sellos'

// A sello counts in the game immediately and is minted onchain in the background.
export function grantSello(key: SelloKey) {
  useGame.getState().addStamp(key)
  void awardSello(key)
}
