const W = 300
const H = 380

// Center crop to the ID photo ratio, apply a worn print look, and keep it small.
export async function toCedulaPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const scale = Math.max(W / img.width, H / img.height)
    const sw = W / scale
    const sh = H / scale
    ctx.filter = 'grayscale(0.25) sepia(0.35) contrast(1.15) brightness(1.05)'
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H)
    ctx.filter = 'none'
    // Print grain.
    const data = ctx.getImageData(0, 0, W, H)
    for (let i = 0; i < data.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18
      data.data[i] += n
      data.data[i + 1] += n
      data.data[i + 2] += n
    }
    ctx.putImageData(data, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}
