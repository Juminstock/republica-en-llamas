import * as THREE from 'three'

// Hip roof over a w × d rectangle (ridge along the longer side), UVs in meters / tile.
export function hipRoof(w: number, d: number, h: number, overhang = 0.8, tile = 2) {
  const W = w / 2 + overhang
  const D = d / 2 + overhang
  const along = W >= D
  const r = along ? W - D : D - W
  const ridge = along
    ? [new THREE.Vector3(-r, h, 0), new THREE.Vector3(r, h, 0)]
    : [new THREE.Vector3(0, h, -r), new THREE.Vector3(0, h, r)]
  const c = [new THREE.Vector3(-W, 0, -D), new THREE.Vector3(W, 0, -D), new THREE.Vector3(W, 0, D), new THREE.Vector3(-W, 0, D)]
  const tris: THREE.Vector3[][] = along
    ? [
        [c[0], ridge[0], ridge[1]], [c[0], ridge[1], c[1]],
        [c[2], ridge[1], ridge[0]], [c[2], ridge[0], c[3]],
        [c[1], ridge[1], c[2]],
        [c[3], ridge[0], c[0]],
      ]
    : [
        [c[1], ridge[0], ridge[1]], [c[1], ridge[1], c[2]],
        [c[3], ridge[1], ridge[0]], [c[3], ridge[0], c[0]],
        [c[0], ridge[0], c[1]],
        [c[2], ridge[1], c[3]],
      ]
  const pos: number[] = []
  const uv: number[] = []
  const n = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  for (const [a, b, cc] of tris) {
    e1.subVectors(b, a)
    e2.subVectors(cc, a)
    n.crossVectors(e1, e2)
    // Wind every face so it points up and outward.
    const list = n.y < 0 ? [a, cc, b] : [a, b, cc]
    // Slope-aligned UVs: tiles run down the roof.
    const slope = new THREE.Vector3(n.x, 0, n.z).normalize()
    const side = new THREE.Vector3(-slope.z, 0, slope.x)
    for (const p of list) {
      pos.push(p.x, p.y, p.z)
      const run = p.x * slope.x + p.z * slope.z
      uv.push((p.x * side.x + p.z * side.z) / tile, (p.y * 1.4 - run) / tile)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

// Boat-like crescent base for the monument: a thick curved hull open to the sky.
export function crescentHull(length = 9, height = 3.2, thickness = 1.4) {
  const s = new THREE.Shape()
  s.moveTo(-length / 2, height)
  s.quadraticCurveTo(-length * 0.32, 0.1, 0, 0)
  s.quadraticCurveTo(length * 0.32, 0.1, length / 2, height)
  s.quadraticCurveTo(length * 0.28, height * 0.35, 0, height * 0.28)
  s.quadraticCurveTo(-length * 0.28, height * 0.35, -length / 2, height)
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 3, curveSegments: 24 })
  g.translate(0, 0, -thickness / 2)
  return g
}
