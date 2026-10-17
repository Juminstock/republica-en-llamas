import { createContext, useContext } from 'react'
import type { WorldTextures } from './textures'
import type { RuinUniform } from './ruinShader'

export type WorldCtx = {
  tex: WorldTextures
  // Shared uniform object: shaders read it on the GPU, useFrame code reads .value.
  uRuin: RuinUniform
}

export const WorldContext = createContext<WorldCtx | null>(null)

export function useWorld() {
  const ctx = useContext(WorldContext)
  if (!ctx) throw new Error('World components must render inside <PlazaBotero>')
  return ctx
}
