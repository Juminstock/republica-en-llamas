import { Field, capsule, ellipsoid, roundBox, roundCone, sphere, type Prim } from './sdf'
import { FINGERS, type Finger } from './skeleton'
import type { V3 } from './sdf'

// Canonical left hand: wrist at the origin, fingers along +x, palm facing -y, thumb toward +z.
export function handField(joints: Record<Finger, V3[]>, feminine: boolean): { field: Field; prims: Prim[] } {
  const f = new Field()
  const prims: Prim[] = []
  const w = feminine ? 0.9 : 1
  const add = (p: Prim, k: number) => {
    prims.push(p)
    f.add(p, k)
  }
  // Forearm stub hidden inside the sleeve, wrist and palm masses
  add(capsule([-0.075, 0, 0], [-0.015, 0, 0], 0.027 * w, 'forearm', 'wrist'), 0.012)
  add(ellipsoid([-0.004, 0.0, 0.0], [0.03, 0.017 * w, 0.028 * w], 'hand', 'wrist'), 0.012)
  add(roundBox([0.046 * w, 0.001, 0.0], [0.046 * w, 0.0135 * w, 0.036 * w], 0.012 * w, 'hand', 'palm', [0, 0, 0.0]), 0.01)
  add(ellipsoid([0.032 * w, -0.008, 0.024 * w], [0.03 * w, 0.0125 * w, 0.017 * w], 'thumb1', 'palm', [0, -0.5, 0]), 0.01)
  add(ellipsoid([0.04 * w, -0.007, -0.022 * w], [0.032 * w, 0.0105 * w, 0.013 * w], 'hand', 'palm'), 0.01)

  const radii: Record<Finger, number[]> = {
    thumb: [0.0135, 0.0108, 0.0098, 0.0088],
    index: [0.0098, 0.0089, 0.0081, 0.0072],
    middle: [0.0101, 0.0092, 0.0083, 0.0074],
    ring: [0.0096, 0.0087, 0.0079, 0.007],
    pinky: [0.0085, 0.0077, 0.007, 0.0063],
  }
  for (const fg of FINGERS) {
    const pts = joints[fg]
    const r = radii[fg].map((x) => x * w)
    for (let i = 0; i < 3; i++) {
      add(roundCone(pts[i], pts[i + 1], r[i], r[i + 1], `${fg}${i + 1}`, i === 2 ? 'tip' : 'finger'), 0.004)
      // Knuckle pads on the back of the hand
      if (i > 0) add(sphere([pts[i][0], pts[i][1] + 0.0012, pts[i][2]], r[i] * 1.04, `${fg}${i + 1}`, 'finger'), 0.003)
    }
    if (fg !== 'thumb') add(sphere([pts[0][0] - 0.002, pts[0][1] + 0.003, pts[0][2]], r[0] * 1.12, `${fg}1`, 'knuckle'), 0.008)
  }
  return { field: f, prims }
}
