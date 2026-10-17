import * as THREE from 'three'
import type { FieldLike, RawMesh } from './mesher'
import type { Prim } from './sdf'
import type { Paint } from './paint'

// Soft ownership of every vertex by nearby primitives, aggregated per bone (top 4).
export function skinWeights(raw: RawMesh, prims: Prim[], boneIndex: (bone: string) => number, kw: number, map?: (x: number, y: number, z: number, out: number[]) => void) {
  const n = raw.positions.length / 3
  const skinIndex = new Uint16Array(n * 4)
  const skinWeight = new Float32Array(n * 4)
  const tags: string[] = new Array(n)
  const d = new Float32Array(prims.length)
  const acc = new Map<number, number>()
  const p = [0, 0, 0]
  for (let v = 0; v < n; v++) {
    p[0] = raw.positions[v * 3]
    p[1] = raw.positions[v * 3 + 1]
    p[2] = raw.positions[v * 3 + 2]
    if (map) map(p[0], p[1], p[2], p)
    let dmin = Infinity
    let owner = 0
    for (let i = 0; i < prims.length; i++) {
      const pr = prims[i]
      const pad = kw * 8
      if (p[0] < pr.min[0] - pad || p[1] < pr.min[1] - pad || p[2] < pr.min[2] - pad || p[0] > pr.max[0] + pad || p[1] > pr.max[1] + pad || p[2] > pr.max[2] + pad) {
        d[i] = Infinity
        continue
      }
      d[i] = pr.d(p[0], p[1], p[2])
      if (d[i] < dmin) {
        dmin = d[i]
        owner = i
      }
    }
    tags[v] = prims[owner]?.tag ?? ''
    acc.clear()
    for (let i = 0; i < prims.length; i++) {
      if (d[i] === Infinity) continue
      const w = Math.exp(-(d[i] - dmin) / kw)
      if (w < 0.01) continue
      const bi = boneIndex(prims[i].bone)
      acc.set(bi, (acc.get(bi) ?? 0) + w)
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    const sum = top.reduce((s, e) => s + e[1], 0) || 1
    for (let k = 0; k < 4; k++) {
      skinIndex[v * 4 + k] = top[k]?.[0] ?? 0
      skinWeight[v * 4 + k] = top[k] ? top[k][1] / sum : 0
    }
  }
  return { skinIndex, skinWeight, tags }
}

// Cheap ambient occlusion baked into vertex colors by sampling the field along the normal.
export function bakeAO(field: FieldLike, raw: RawMesh, scale: number, strength = 0.55): Float32Array {
  const n = raw.positions.length / 3
  const ao = new Float32Array(n)
  const steps = [0.006, 0.016, 0.034].map((s) => s * scale)
  for (let v = 0; v < n; v++) {
    const x = raw.positions[v * 3], y = raw.positions[v * 3 + 1], z = raw.positions[v * 3 + 2]
    const nx = raw.normals[v * 3], ny = raw.normals[v * 3 + 1], nz = raw.normals[v * 3 + 2]
    let occ = 0
    for (const st of steps) {
      const dd = field.eval(x + nx * st, y + ny * st, z + nz * st)
      occ += Math.max(0, Math.min(1, (st - dd) / st))
    }
    ao[v] = 1 - strength * (occ / steps.length)
  }
  return ao
}

const hash = (x: number, y: number, z: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}

// Vertex-colored geometry with one draw group per material class.
export function assemble(
  raw: RawMesh,
  paints: Paint[],
  ao: Float32Array | null,
  opts: { transform?: THREE.Matrix4; flip?: boolean; skin?: { skinIndex: Uint16Array; skinWeight: Float32Array }; noise?: number } = {},
): THREE.BufferGeometry {
  const n = raw.positions.length / 3
  const positions = new Float32Array(raw.positions)
  const normals = new Float32Array(raw.normals)
  if (opts.transform) {
    const v = new THREE.Vector3()
    const nm = new THREE.Matrix3().getNormalMatrix(opts.transform)
    for (let i = 0; i < n; i++) {
      v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).applyMatrix4(opts.transform)
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
      v.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).applyMatrix3(nm).normalize()
      normals[i * 3] = v.x
      normals[i * 3 + 1] = v.y
      normals[i * 3 + 2] = v.z
    }
  }
  const colors = new Float32Array(n * 3)
  const noise = opts.noise ?? 0.035
  for (let i = 0; i < n; i++) {
    const c = paints[i].color
    const k = (ao ? ao[i] : 1) * (1 - noise + noise * 2 * hash(raw.positions[i * 3], raw.positions[i * 3 + 1], raw.positions[i * 3 + 2]))
    colors[i * 3] = c.r * k
    colors[i * 3 + 1] = c.g * k
    colors[i * 3 + 2] = c.b * k
  }
  // Group triangles by material class.
  const buckets: number[][] = [[], [], []]
  const idx = raw.indices
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    const m = Math.max(paints[a].mat, paints[b].mat, paints[c].mat)
    if (opts.flip) buckets[m].push(a, c, b)
    else buckets[m].push(a, b, c)
  }
  const index: number[] = []
  const geo = new THREE.BufferGeometry()
  let start = 0
  buckets.forEach((b, m) => {
    if (!b.length) return
    for (const i of b) index.push(i)
    geo.addGroup(start, b.length, m)
    start += b.length
  })
  geo.setIndex(index)
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  if (opts.skin) {
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(opts.skin.skinIndex, 4))
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(opts.skin.skinWeight, 4))
  }
  geo.computeBoundingSphere()
  return geo
}

export function memo<T>(cache: Map<string, T>, key: string, make: () => T): T {
  let v = cache.get(key)
  if (v === undefined) {
    v = make()
    cache.set(key, v)
  }
  return v
}
