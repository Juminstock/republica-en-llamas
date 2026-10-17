import * as THREE from 'three'
import type { Joints } from './skeleton'
import type { Look } from './looks'

// Per-pixel clothing details (shirt V, tie, lapels, sash, pocket square, straps, belt...)
// evaluated on the bind-pose position so every boundary stays crisp at any mesh density.
export const TAG_CODE: Record<string, number> = { neck: 1, foot: 2, thigh: 3, shin: 4, arm: 5, forearm: 6, torso: 7, pelvis: 8 }

const FLAGS = [
  'suit', 'blazer', 'cardigan', 'coat', 'vest', 'hood', 'tactical', 'longSleeves', 'tie', 'sash', 'pocketSquare',
  'flagPin', 'messenger', 'folder', 'backpack', 'belt', 'lanyard', 'armband', 'bandana', 'lightShoes', 'inner',
] as const

const glsl = /* glsl */ `
uniform vec3 uSkin, uTop, uInner, uBottom, uShoes, uAccent, uTie;
uniform float uF[${FLAGS.length}];
uniform vec3 uWristL, uWristR, uShoulderL, uShoulderR;
varying vec3 vBind;
varying float vTag;

float bandDist(vec2 p, vec2 a, vec2 b) {
  vec2 d = b - a;
  return abs((p.x - a.x) * d.y - (p.y - a.y) * d.x) / length(d);
}

vec3 sashColor(vec2 p, inout float hit) {
  vec2 a = vec2(-0.165, 1.42);
  vec2 d = vec2(0.56, -0.828);
  vec2 n = vec2(0.828, 0.56);
  float t = dot(p - a, d);
  float k = dot(p - a, n);
  hit = (t > -0.02 && t < 0.62 && abs(k) < 0.042) ? 1.0 : 0.0;
  if (length(p - vec2(0.115, 1.0)) < 0.024) return vec3(0.62, 0.42, 0.12);
  if (abs(k) > 0.039) return vec3(0.55, 0.42, 0.1);
  if (k < 0.0) return vec3(0.88, 0.58, 0.0);
  if (k < 0.021) return vec3(0.015, 0.05, 0.32);
  return vec3(0.55, 0.008, 0.025);
}

vec3 clothPaint(vec3 P, float tag, out float leather) {
  #define F(i) (uF[i] > 0.5)
  bool suit = F(0), blazer = F(1), cardigan = F(2), coat = F(3), vest = F(4), hood = F(5), tactical = F(6);
  bool longSleeves = F(7), hasTie = F(8), sash = F(9), pocket = F(10), pin = F(11), messenger = F(12), folder = F(13);
  bool backpack = F(14), belt = F(15), lanyard = F(16), armband = F(17), bandana = F(18), lightShoes = F(19), hasInner = F(20);
  bool open = suit || blazer || cardigan;
  leather = 0.0;
  float x = P.x, y = P.y, z = P.z, ax = abs(x);
  vec3 inner = hasInner ? uInner : vec3(0.92, 0.91, 0.88);
  int t = int(tag + 0.5);
  // Boundaries between body parts are decided by position so they never follow mesh edges.
  float frontOpen = (open && z > 0.02) ? max(0.0, 0.06 - ax * 0.45) : 0.0;
  float hem = (suit ? 0.84 : blazer ? 0.87 : cardigan ? 0.87 : hood ? 0.9 : coat ? 0.95 : tactical ? 0.94 : 0.93) + frontOpen;
  float collar = (open || vest) ? 1.462 : hood ? 1.475 : tactical ? 1.455 : coat ? 1.44 : 1.452;
  bool neckZone = y > 1.4 && ax < 0.075 && t != 5 && t != 6;
  if (neckZone && y > collar + (bandana ? 0.03 : 0.0)) return uSkin;
  // Shirt collar ring around the neck, shared by neck and torso so the edge is clean.
  float rn = length(vec2(x, z + 0.012));
  if ((open || vest) && y > 1.415 && rn < 0.066) {
    if (hasTie && z > 0.0 && ax < 0.011 && y < 1.447) return uTie * 0.85;
    return inner;
  }
  if (t == 1) {
    if (bandana && y < 1.49) return uAccent;
    if ((open || vest) && y < 1.462) return inner;
    if (hood && y < 1.475) return uTop * 0.9;
    if (tactical && y < 1.455) return uTop;
    if (coat && y < 1.44) return uTop;
    if (y < 1.452) return uTop;
    return uSkin;
  }
  if (t == 2) {
    leather = 1.0;
    if (y < 0.016) return lightShoes ? vec3(0.62, 0.6, 0.55) : vec3(0.03);
    if (lightShoes && y < 0.03) return vec3(0.85, 0.84, 0.8);
    return uShoes;
  }
  if (t == 3 || t == 4) {
    if (y < 0.105) { leather = 1.0; return uShoes; }
    if (y > hem) return vest ? uAccent : uTop;
    return uBottom;
  }
  if (t == 5 || t == 6) {
    vec3 sh = x >= 0.0 ? uShoulderL : uShoulderR;
    vec3 wr = x >= 0.0 ? uWristL : uWristR;
    float sd = length(P - sh), wd = length(P - wr);
    if (!longSleeves && (t == 6 || sd > 0.13)) return uSkin;
    if (coat && (t == 6 || sd > 0.12)) return uSkin;
    if (t == 5 && armband && x > 0.0 && sd > 0.11 && sd < 0.155) return uAccent;
    if (wd < 0.03 && (hood || cardigan)) return uTop * 0.85;
    return uTop;
  }
  // Torso and pelvis
  vec3 garment = y > hem ? uTop : uBottom;
  if (vest && y > hem) garment = uAccent;
  if (tactical && y > 1.02 && y < 1.43) garment = uTop * 0.55;
  if (y > hem && z > 0.0) {
    if (open || vest) {
      float vB = suit ? 1.1 : blazer ? 1.13 : cardigan ? 1.05 : 1.12;
      if (y > vB) {
        float hw = 0.012 + (y - vB) / (1.47 - vB) * 0.075;
        if (ax < hw) {
          if (hasTie && y < 1.445) {
            float tw = y > 1.415 ? 0.011 : min(0.023, 0.009 + (1.415 - y) * 0.05);
            if (ax < tw) return uTie * (y > 1.415 ? 0.85 : 1.0);
          }
          // Shirt placket and buttons
          if (ax < 0.004 && !hasTie) return inner * 0.9;
          return inner;
        }
        // Lapels: a darker band with a notch
        if ((suit || blazer) && ax < hw + 0.028 && y > vB + 0.05) {
          float edge = smoothstep(0.0, 0.003, hw + 0.028 - ax);
          garment = mix(uTop, uTop * 0.72, edge);
          if (y > 1.36 && y < 1.375 && ax > hw + 0.012) garment = uTop * 0.55;
        }
      }
    }
    if (coat && y > 1.36) {
      float hw = 0.01 + (y - 1.36) / 0.11 * 0.05;
      if (ax < hw) return uSkin;
    }
    if (pocket && x > 0.074 && x < 0.112 && y > 1.268 && y < 1.292) {
      float tri = (y - 1.268) - (x - 0.074) * 0.4;
      return tri > 0.0 ? vec3(0.95) : uTop * 0.7;
    }
    if (pocket && x > 0.068 && x < 0.118 && abs(y - 1.267) < 0.0025) return uTop * 0.6;
    if (pin && length(vec2(x - 0.1, y - 1.338)) < 0.0085) {
      leather = 1.0;
      float k = (y - 1.3295) / 0.017;
      return k > 0.5 ? vec3(0.95, 0.75, 0.0) : k > 0.25 ? vec3(0.07, 0.17, 0.55) : vec3(0.72, 0.04, 0.12);
    }
    if (hood && y > 0.97 && y < 1.12 && ax < 0.1) garment *= 0.86;
    if (hood && y > 1.3 && y < 1.44 && abs(ax - 0.026) < 0.0032) return vec3(0.9, 0.89, 0.86);
    if (lanyard && y > 1.32 && y < 1.45 && abs(ax - (0.03 + (1.45 - y) * 0.22)) < 0.0045) return uAccent;
    // Jacket buttons
    if ((suit || blazer) && ax < 0.004 && abs(y - 1.085) < 0.005 && y < 1.1) { leather = 1.0; return vec3(0.05); }
  }
  if (sash && y > 0.9) {
    float hit;
    vec3 sc = sashColor(vec2(x, y), hit);
    if (hit > 0.5 && (z > 0.01 || z < -0.06)) return sc;
  }
  if (messenger && y > 0.95 && bandDist(vec2(x, y), vec2(-0.15, 1.43), vec2(0.17, 0.96)) < 0.016) { leather = 1.0; return vec3(0.16, 0.1, 0.06); }
  if (folder && y > 0.95 && bandDist(vec2(x, y), vec2(0.15, 1.43), vec2(-0.17, 0.96)) < 0.013) { leather = 1.0; return vec3(0.3, 0.17, 0.08); }
  if (backpack && y > 1.02 && y < 1.44 && abs(ax - 0.085) < 0.016) { leather = 1.0; return vec3(0.06); }
  if (belt && y > 0.962 && y < 0.99 && (y < hem || !(open || coat || hood))) {
    leather = 1.0;
    if (z > 0.05 && ax < 0.016) return vec3(0.6, 0.5, 0.28);
    return vec3(0.09, 0.055, 0.035);
  }
  return garment;
}
`

const matCache = new Map<string, THREE.Material[]>()

// Body materials for one look: the shared classes with the clothing painter injected.
export function clothMaterials(base: THREE.Material[], look: Look, j: Joints): THREE.Material[] {
  const key = JSON.stringify(look)
  const cached = matCache.get(key)
  if (cached) return cached
  const s = j.scale
  const has = (a: Look['accessories'][number]) => look.accessories.includes(a)
  const flags: Record<(typeof FLAGS)[number], boolean> = {
    suit: has('suitLapels'),
    blazer: has('blazerLapels'),
    cardigan: has('cardigan'),
    coat: has('labCoat'),
    vest: has('vest'),
    hood: has('hood'),
    tactical: has('tacticalVest'),
    longSleeves: look.longSleeves,
    tie: has('tie'),
    sash: has('sash'),
    pocketSquare: has('pocketSquare'),
    flagPin: has('flagPin'),
    messenger: has('messengerBag'),
    folder: has('folderBag'),
    backpack: has('backpack'),
    belt: has('belt'),
    lanyard: has('lanyard'),
    armband: has('armband'),
    bandana: has('bandana'),
    lightShoes: ['#e8e4dc', '#e6e1d8'].includes(look.shoes),
    inner: Boolean(look.inner),
  }
  const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0] / s, a[1] / s, a[2] / s)
  const uniforms = {
    uSkin: { value: new THREE.Color(look.skin) },
    uTop: { value: new THREE.Color(look.top) },
    uInner: { value: new THREE.Color(look.inner ?? '#f2f0ea') },
    uBottom: { value: new THREE.Color(look.bottom) },
    uShoes: { value: new THREE.Color(look.shoes) },
    uAccent: { value: new THREE.Color(look.accent ?? '#d7263d') },
    uTie: { value: new THREE.Color(has('suitLapels') ? '#141b33' : (look.accent ?? '#141b33')) },
    uF: { value: FLAGS.map((f) => (flags[f] ? 1 : 0)) },
    uWristL: { value: v3(j.wrist.L) },
    uWristR: { value: v3(j.wrist.R) },
    uShoulderL: { value: v3(j.shoulder.L) },
    uShoulderR: { value: v3(j.shoulder.R) },
  }
  const mats = base.map((m, i) => {
    const c = m.clone()
    c.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nattribute float aTag;\nvarying vec3 vBind;\nvarying float vTag;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;\nvTag = aTag;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${glsl}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float isLeather;
          vec3 painted = clothPaint(vBind, vTag, isLeather);
          diffuseColor.rgb *= painted;`,
        )
    }
    c.customProgramCacheKey = () => `cloth-${i}`
    return c
  })
  matCache.set(key, mats)
  return mats
}
