export type Identity = {
  alias: string
  city: string
  university: string
  career: string
  rh: string
  photoUrl: string | null
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const LEVELS = ['PASANTÍAS', 'VISA', 'INGLÉS', 'NOTARÍA', 'TESIS', 'SUSTENT.', 'ALCALDE', 'GOBERN.', 'DERECHOS', 'GRADO']

// Parody card. Deliberately not the official design: game header, visible watermark,
// no coat of arms, no real ID number, no security features.
export function cedulaSvg({ tokenId, stamps, identity }: { tokenId: number; stamps: number; identity: Identity }) {
  const number = `RL-${String(tokenId).padStart(6, '0')}`
  const photo = identity.photoUrl
    ? `<image href="${esc(identity.photoUrl)}" x="40" y="110" width="220" height="280" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>`
    : `<g fill="#8a8f9e"><circle cx="150" cy="210" r="60"/><rect x="70" y="285" width="160" height="105" rx="60"/></g>`
  const stampCells = LEVELS.map((label, i) => {
    const on = (stamps >> i) & 1
    const x = 300 + (i % 5) * 96
    const y = 330 + Math.floor(i / 5) * 46
    return `<g transform="translate(${x},${y})"><rect width="88" height="38" rx="6" fill="${on ? '#e4572e' : 'none'}" stroke="#14161f" stroke-width="2" stroke-dasharray="${on ? '0' : '4 3'}"/><text x="44" y="25" font-size="13" text-anchor="middle" font-weight="700" fill="${on ? '#fff' : '#14161f'}">${label}</text></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480" font-family="Arial, sans-serif">
<defs><clipPath id="ph"><rect x="40" y="110" width="220" height="280" rx="8"/></clipPath>
<pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 Q6 0 12 12 T24 12" fill="none" stroke="#e8c96a" stroke-width="1"/></pattern></defs>
<rect width="800" height="480" rx="24" fill="#f6e7b0"/><rect width="800" height="480" rx="24" fill="url(#g)" opacity=".7"/>
<rect width="800" height="84" rx="24" fill="#14161f"/><rect y="60" width="800" height="24" fill="#14161f"/>
<text x="40" y="38" font-size="26" font-weight="900" fill="#f2b705">REPÚBLICA EN LLAMAS</text>
<text x="40" y="68" font-size="16" fill="#f4efe1" letter-spacing="3">CÉDULA DE SUPERVIVENCIA</text>
<text x="760" y="52" font-size="22" font-weight="700" fill="#e4572e" text-anchor="end">${number}</text>
<rect x="40" y="110" width="220" height="280" rx="8" fill="#d9d4c4" stroke="#14161f" stroke-width="3"/>${photo}
<g font-size="13" fill="#5a5340"><text x="300" y="125">ALIAS</text><text x="300" y="185">CARRERA</text><text x="560" y="185">RH</text><text x="300" y="245">UNIVERSIDAD</text><text x="560" y="245">CIUDAD</text></g>
<g font-size="24" font-weight="700" fill="#14161f"><text x="300" y="155">${esc(identity.alias)}</text></g>
<g font-size="17" font-weight="700" fill="#14161f"><text x="300" y="207">${esc(identity.career)}</text><text x="560" y="207">${esc(identity.rh)}</text><text x="300" y="267">${esc(identity.university)}</text><text x="560" y="267">${esc(identity.city)}</text></g>
<text x="300" y="318" font-size="13" fill="#5a5340">SELLOS DE GRADO</text>${stampCells}
<text x="400" y="460" font-size="15" font-weight="900" fill="#d7263d" text-anchor="middle" letter-spacing="2" opacity=".85">SIN VALIDEZ LEGAL · DOCUMENTO DE JUEGO</text>
<text x="400" y="300" font-size="64" font-weight="900" fill="#d7263d" opacity=".08" text-anchor="middle" transform="rotate(-18 400 300)">SIN VALIDEZ LEGAL</text>
</svg>`
}
