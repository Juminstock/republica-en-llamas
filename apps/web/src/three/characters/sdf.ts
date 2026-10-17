// Signed distance primitives and a smooth CSG field used to sculpt characters procedurally.

export type V3 = [number, number, number]

export type Prim = {
  // Distance from (x, y, z) to the surface; negative inside.
  d: (x: number, y: number, z: number) => number
  // Axis aligned bounds, already padded by the primitive's influence.
  min: V3
  max: V3
  // Skinning owner and region tag used to color and weight the polygonized surface.
  bone: string
  tag: string
}

export type Op = { kind: 'add' | 'sub'; prim: Prim; k: number }

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z)

export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k)
}

type Mat = [number, number, number, number, number, number, number, number, number]

// Rotation matrix from Euler XYZ (radians); applied as the inverse to bring points into local space.
export function rotMat(rx: number, ry: number, rz: number): Mat {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  // R = Rz * Ry * Rx
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ]
}

function bounds(cx: number, cy: number, cz: number, r: number): { min: V3; max: V3 } {
  return { min: [cx - r, cy - r, cz - r], max: [cx + r, cy + r, cz + r] }
}

export function sphere(c: V3, r: number, bone: string, tag: string): Prim {
  const [cx, cy, cz] = c
  return { d: (x, y, z) => len3(x - cx, y - cy, z - cz) - r, ...bounds(cx, cy, cz, r), bone, tag }
}

// Ellipsoid with optional rotation (approximate but well behaved distance).
export function ellipsoid(c: V3, r: V3, bone: string, tag: string, rot?: V3): Prim {
  const [cx, cy, cz] = c
  const [rx, ry, rz] = r
  const m = rot ? rotMat(rot[0], rot[1], rot[2]) : null
  const rmax = Math.max(rx, ry, rz)
  return {
    d: (x, y, z) => {
      let px = x - cx, py = y - cy, pz = z - cz
      if (m) {
        // inverse rotation = transpose
        const qx = m[0] * px + m[3] * py + m[6] * pz
        const qy = m[1] * px + m[4] * py + m[7] * pz
        const qz = m[2] * px + m[5] * py + m[8] * pz
        px = qx; py = qy; pz = qz
      }
      const k0 = len3(px / rx, py / ry, pz / rz)
      const k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz))
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
    },
    ...bounds(cx, cy, cz, rmax),
    bone,
    tag,
  }
}

// Cone between two points with rounded ends of radius ra and rb (capsule when equal).
export function roundCone(a: V3, b: V3, ra: number, rb: number, bone: string, tag: string): Prim {
  const [ax, ay, az] = a
  const bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = ra - rb
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  return {
    d: (x, y, z) => {
      const pax = x - ax, pay = y - ay, paz = z - az
      const yv = pax * bax + pay * bay + paz * baz
      const zv = yv - l2
      const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv
      const x2 = qx * qx + qy * qy + qz * qz
      const y2 = yv * yv * l2
      const z2 = zv * zv * l2
      const k = Math.sign(rr) * rr * rr * x2
      if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb
      if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra
      return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra
    },
    min: [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.min(a[2] - ra, b[2] - rb)],
    max: [Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb), Math.max(a[2] + ra, b[2] + rb)],
    bone,
    tag,
  }
}

export function capsule(a: V3, b: V3, r: number, bone: string, tag: string): Prim {
  return roundCone(a, b, r, r, bone, tag)
}

// Rounded box centered at c with half extents h, corner radius r and optional rotation.
export function roundBox(c: V3, h: V3, r: number, bone: string, tag: string, rot?: V3): Prim {
  const [cx, cy, cz] = c
  const m = rot ? rotMat(rot[0], rot[1], rot[2]) : null
  const hx = h[0] - r, hy = h[1] - r, hz = h[2] - r
  const reach = len3(h[0], h[1], h[2])
  return {
    d: (x, y, z) => {
      let px = x - cx, py = y - cy, pz = z - cz
      if (m) {
        const qx = m[0] * px + m[3] * py + m[6] * pz
        const qy = m[1] * px + m[4] * py + m[7] * pz
        const qz = m[2] * px + m[5] * py + m[8] * pz
        px = qx; py = qy; pz = qz
      }
      const qx = Math.abs(px) - hx, qy = Math.abs(py) - hy, qz = Math.abs(pz) - hz
      const out = len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0))
      return out + Math.min(Math.max(qx, qy, qz), 0) - r
    },
    ...bounds(cx, cy, cz, reach),
    bone,
    tag,
  }
}

// Field = ordered smooth unions and subtractions.
export class Field {
  ops: Op[] = []
  add(prim: Prim, k = 0.02) {
    this.ops.push({ kind: 'add', prim, k })
    return this
  }
  sub(prim: Prim, k = 0.006) {
    this.ops.push({ kind: 'sub', prim, k })
    return this
  }
  // Optional global displacement (noise, strands); added to the distance.
  displace: ((x: number, y: number, z: number, d: number) => number) | null = null

  bounds(pad: number): { min: V3; max: V3 } {
    const min: V3 = [Infinity, Infinity, Infinity]
    const max: V3 = [-Infinity, -Infinity, -Infinity]
    for (const op of this.ops) {
      if (op.kind !== 'add') continue
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], op.prim.min[i] - pad)
        max[i] = Math.max(max[i], op.prim.max[i] + pad)
      }
    }
    return { min, max }
  }

  eval(x: number, y: number, z: number): number {
    let d = 1e3
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i]
      const p = op.prim
      const pad = op.k + 0.02
      if (x < p.min[0] - pad || y < p.min[1] - pad || z < p.min[2] - pad || x > p.max[0] + pad || y > p.max[1] + pad || z > p.max[2] + pad) {
        continue
      }
      const v = p.d(x, y, z)
      d = op.kind === 'add' ? smin(d, v, op.k) : smax(d, -v, op.k)
    }
    if (this.displace) d = this.displace(x, y, z, d)
    return d
  }
}
