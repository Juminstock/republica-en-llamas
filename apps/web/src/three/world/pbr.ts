import * as THREE from 'three'

// CC0 PBR sets from Poly Haven (see public/assets/polyhaven/CREDITS.md). Each set: albedo, OpenGL normal, ARM (AO/rough/metal).
export const PBR_SETS = {
  pavers: 'large_floor_tiles_02',
  brick: 'red_brick_03',
  plaster: 'white_plaster_02',
  concrete: 'concrete_wall_008',
  concreteFloor: 'concrete_floor_worn_001',
  pebble: 'pebble_cemented_floor',
  roof: 'clay_roof_tiles',
  asphalt: 'asphalt_02',
  dirt: 'brown_mud_leaves_01',
  bark: 'bark_brown_02',
  grass: 'leafy_grass',
} as const

export type PbrSetName = keyof typeof PBR_SETS

export const HDRI = {
  day: '/assets/polyhaven/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr',
  golden: '/assets/polyhaven/hdri/venice_sunset_1k.hdr',
  dusk: '/assets/polyhaven/hdri/the_sky_is_on_fire_1k.hdr',
  night: '/assets/polyhaven/hdri/shanghai_bund_1k.hdr',
} as const

const loader = new THREE.TextureLoader()
type Entry = { base: THREE.Texture; loaded: boolean; clones: Set<THREE.Texture> }
const cache = new Map<string, Entry>()

function entry(url: string, srgb: boolean): Entry {
  let e = cache.get(url)
  if (e) return e
  const created: Entry = { base: new THREE.Texture(), loaded: false, clones: new Set() }
  created.base = loader.load(url, (t) => {
    created.loaded = true
    created.clones.forEach((c) => {
      c.image = t.image
      c.needsUpdate = true
    })
  })
  created.base.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  cache.set(url, created)
  e = created
  return e
}

// A repeat-able copy of a cached texture that uploads once the shared image arrives.
export function texture(url: string, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}) {
  const e = entry(url, opts.srgb ?? false)
  const t = new THREE.Texture()
  t.colorSpace = e.base.colorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = opts.aniso ?? 8
  if (opts.repeat) t.repeat.set(...opts.repeat)
  if (e.loaded) {
    t.image = e.base.image
    t.needsUpdate = true
  } else e.clones.add(t)
  return t
}

export type PbrMaps = { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture }

const path = (set: PbrSetName, kind: 'diff' | 'nor' | 'arm') => `/assets/polyhaven/tex/${PBR_SETS[set]}_${kind}.jpg`

export function pbrMaps(set: PbrSetName, repeat: [number, number] = [1, 1]): PbrMaps {
  return {
    map: texture(path(set, 'diff'), { srgb: true, repeat }),
    normalMap: texture(path(set, 'nor'), { repeat }),
    arm: texture(path(set, 'arm'), { repeat }),
  }
}

type PbrOpts = THREE.MeshStandardMaterialParameters & { repeat?: [number, number]; normal?: number; noAlbedo?: boolean }

// Standard material wired to a PBR set. noAlbedo keeps a custom map (e.g. painted facades) and only borrows relief.
export function pbrMaterial(set: PbrSetName, { repeat = [1, 1], normal = 1, noAlbedo, ...params }: PbrOpts = {}) {
  const m = pbrMaps(set, repeat)
  return new THREE.MeshStandardMaterial({
    map: noAlbedo ? params.map : m.map,
    normalMap: m.normalMap,
    normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: m.arm,
    aoMap: m.arm,
    aoMapIntensity: 0.85,
    roughness: 1,
    metalness: 0,
    ...params,
  })
}

// Box with UVs in meters (one texture tile = `tile` meters) so PBR detail keeps a real-world scale.
export function meterBox(w: number, h: number, d: number, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const faces: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  faces.forEach(([fu, fv], f) => {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * fu) / tile, (uv.getY(i) * fv) / tile)
    }
  })
  return g
}

export function preloadWorldAssets() {
  ;(Object.keys(PBR_SETS) as PbrSetName[]).forEach((s) => {
    entry(path(s, 'diff'), true)
    entry(path(s, 'nor'), false)
    entry(path(s, 'arm'), false)
  })
  Object.values(HDRI).forEach((u) => fetch(u).catch(() => undefined))
}
