import { COLLIDERS, type Collider } from '../world/layout'

// Pushes a circle (x, z, radius) out of every collider. Mutates and returns pos.
export function resolveCollisions(pos: { x: number; z: number }, radius: number, colliders: Collider[] = COLLIDERS) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.kind === 'circle') {
        const dx = pos.x - c.x
        const dz = pos.z - c.z
        const min = c.r + radius
        const d2 = dx * dx + dz * dz
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.0001
          pos.x = c.x + (dx / d) * min
          pos.z = c.z + (dz / d) * min
        }
      } else {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX))
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ))
        const dx = pos.x - cx
        const dz = pos.z - cz
        const d2 = dx * dx + dz * dz
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2)
            pos.x = cx + (dx / d) * radius
            pos.z = cz + (dz / d) * radius
          } else {
            // Center inside the box: exit through the nearest side.
            const exits = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z]
            const i = exits.indexOf(Math.min(...exits))
            if (i === 0) pos.x = c.minX - radius
            else if (i === 1) pos.x = c.maxX + radius
            else if (i === 2) pos.z = c.minZ - radius
            else pos.z = c.maxZ + radius
          }
        }
      }
    }
  }
  return pos
}

// True if the segment from (ax, az) to (bx, bz) crosses a box collider. Used to pull the camera in.
export function segmentHitsBox(ax: number, az: number, bx: number, bz: number, colliders: Collider[] = COLLIDERS): number {
  let nearest = 1
  for (const c of colliders) {
    if (c.kind !== 'box') continue
    const dx = bx - ax
    const dz = bz - az
    let tmin = 0
    let tmax = 1
    for (const [o, d, lo, hi] of [
      [ax, dx, c.minX, c.maxX],
      [az, dz, c.minZ, c.maxZ],
    ] as const) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) {
          tmin = 2
          break
        }
      } else {
        let t1 = (lo - o) / d
        let t2 = (hi - o) / d
        if (t1 > t2) [t1, t2] = [t2, t1]
        tmin = Math.max(tmin, t1)
        tmax = Math.min(tmax, t2)
        if (tmin > tmax) {
          tmin = 2
          break
        }
      }
    }
    if (tmin <= 1 && tmin < nearest) nearest = tmin
  }
  return nearest
}
