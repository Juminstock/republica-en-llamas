import type { V3 } from './sdf'

export type FieldLike = { bounds: (pad: number) => { min: V3; max: V3 }; eval: (x: number, y: number, z: number) => number }

export type RawMesh = {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

// Naive surface nets over a narrow band of the field, with Newton projection and gradient normals.
export function polygonize(field: FieldLike, cell: number, pad = 0.01): RawMesh {
  const { min, max } = field.bounds(pad)
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1
  const sxy = nx * ny
  const values = new Float32Array(nx * ny * nz)

  // Coarse pass: only evaluate fine samples near the surface.
  const C = 4
  const cnx = Math.ceil(nx / C) + 1, cny = Math.ceil(ny / C) + 1, cnz = Math.ceil(nz / C) + 1
  const coarse = new Float32Array(cnx * cny * cnz)
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++)
        coarse[i + j * cnx + k * cnx * cny] = field.eval(min[0] + i * C * cell, min[1] + j * C * cell, min[2] + k * C * cell)
  const band = C * cell * 1.9
  for (let ck = 0; ck < cnz - 1; ck++)
    for (let cj = 0; cj < cny - 1; cj++)
      for (let ci = 0; ci < cnx - 1; ci++) {
        let near = false
        let sign = 0
        for (let c = 0; c < 8; c++) {
          const v = coarse[ci + (c & 1) + (cj + ((c >> 1) & 1)) * cnx + (ck + (c >> 2)) * cnx * cny]
          if (Math.abs(v) < band) near = true
          sign += v < 0 ? -1 : 1
        }
        const i0 = ci * C, j0 = cj * C, k0 = ck * C
        for (let k = k0; k <= Math.min(k0 + C, nz - 1); k++)
          for (let j = j0; j <= Math.min(j0 + C, ny - 1); j++)
            for (let i = i0; i <= Math.min(i0 + C, nx - 1); i++) {
              const idx = i + j * nx + k * sxy
              if (near) values[idx] = field.eval(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell)
              else if (values[idx] === 0) values[idx] = sign < 0 ? -1 : 1
            }
      }

  // One vertex per sign-changing cell.
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1)
  const cnxm = nx - 1, cnym = ny - 1
  const pos: number[] = []
  const corner = new Float32Array(8)
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0
        for (let c = 0; c < 8; c++) {
          const v = values[i + (c & 1) + (j + ((c >> 1) & 1)) * nx + (k + (c >> 2)) * sxy]
          corner[c] = v
          if (v < 0) mask |= 1 << c
        }
        if (mask === 0 || mask === 255) continue
        let ax = 0, ay = 0, az = 0, n = 0
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b]
          if (va < 0 === vb < 0) continue
          const t = va / (va - vb)
          ax += (a & 1) + t * ((b & 1) - (a & 1))
          ay += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1))
          az += (a >> 2) + t * ((b >> 2) - (a >> 2))
          n++
        }
        cellVert[i + j * cnxm + k * cnxm * cnym] = pos.length / 3
        pos.push(min[0] + (i + ax / n) * cell, min[1] + (j + ay / n) * cell, min[2] + (k + az / n) * cell)
      }

  // Quads across every sign-changing grid edge.
  const idx: number[] = []
  const cv = (i: number, j: number, k: number) => cellVert[i + j * cnxm + k * cnxm * cnym]
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = values[i + j * nx + k * sxy]
        const inside = v0 < 0
        // x edge
        if (i < nx - 1 && inside !== values[i + 1 + j * nx + k * sxy] < 0) {
          quad(idx, cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), inside)
        }
        if (j < ny - 1 && inside !== values[i + (j + 1) * nx + k * sxy] < 0) {
          quad(idx, cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), inside)
        }
        if (k < nz - 1 && inside !== values[i + j * nx + (k + 1) * sxy] < 0) {
          quad(idx, cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), inside)
        }
      }

  // Project onto the surface and compute normals from the gradient.
  const count = pos.length / 3
  const positions = new Float32Array(pos)
  const normals = new Float32Array(count * 3)
  const e = cell * 0.35
  const g: V3 = [0, 0, 0]
  for (let v = 0; v < count; v++) {
    let x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2]
    for (let it = 0; it < 2; it++) {
      const d = field.eval(x, y, z)
      grad(field, x, y, z, e, g)
      const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]
      if (l2 < 1e-12) break
      const step = Math.max(-cell * 0.6, Math.min(cell * 0.6, d / l2))
      x -= g[0] * step
      y -= g[1] * step
      z -= g[2] * step
    }
    positions[v * 3] = x
    positions[v * 3 + 1] = y
    positions[v * 3 + 2] = z
    grad(field, x, y, z, e, g)
    const l = Math.hypot(g[0], g[1], g[2]) || 1
    normals[v * 3] = g[0] / l
    normals[v * 3 + 1] = g[1] / l
    normals[v * 3 + 2] = g[2] / l
  }
  return { positions, normals, indices: new Uint32Array(idx) }
}

function grad(f: FieldLike, x: number, y: number, z: number, e: number, out: V3) {
  out[0] = f.eval(x + e, y, z) - f.eval(x - e, y, z)
  out[1] = f.eval(x, y + e, z) - f.eval(x, y - e, z)
  out[2] = f.eval(x, y, z + e) - f.eval(x, y, z - e)
  const inv = 1 / (2 * e)
  out[0] *= inv
  out[1] *= inv
  out[2] *= inv
}

function quad(out: number[], a: number, b: number, c: number, d: number, flip: boolean) {
  if (a < 0 || b < 0 || c < 0 || d < 0) return
  if (flip) out.push(a, b, c, a, c, d)
  else out.push(a, c, b, a, d, c)
}
