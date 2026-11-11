// Génère les icônes PNG de la PWA sans aucune dépendance externe.
// Encodage PNG manuel (zlib natif de Node) : fond bleu arrondi, document blanc, coche verte.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function makeCanvas(size) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    const sa = a / 255
    const da = px[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa <= 0) return
    px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa)
    px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa)
    px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa)
    px[i + 3] = Math.round(oa * 255)
  }
  const fillRoundedRect = (x0, y0, w, h, rad, r, g, b, a = 255) => {
    for (let y = Math.floor(y0); y < y0 + h; y++) {
      for (let x = Math.floor(x0); x < x0 + w; x++) {
        const cx = Math.max(x0 + rad, Math.min(x, x0 + w - rad))
        const cy = Math.max(y0 + rad, Math.min(y, y0 + h - rad))
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= rad * rad) set(x, y, r, g, b, a)
      }
    }
  }
  const fillCircle = (cx, cy, rad, r, g, b, a = 255) => {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= rad * rad) set(x, y, r, g, b, a)
      }
  }
  const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
    for (let y = Math.floor(y0); y < y0 + h; y++)
      for (let x = Math.floor(x0); x < x0 + w; x++) set(x, y, r, g, b, a)
  }
  return { px, size, set, fillRoundedRect, fillCircle, fillRect }
}

function drawIcon(size, maskable) {
  const c = makeCanvas(size)
  const pad = maskable ? size * 0.18 : size * 0.06
  const bg = maskable ? 0 : 1
  const R = Math.round(size * (maskable ? 0.22 : 0.18))
  c.fillRoundedRect(pad * bg + (maskable ? pad : 0), maskable ? pad : 0, size - 2 * (maskable ? pad : 0), size - 2 * (maskable ? pad : 0), R, 29, 78, 216)

  // Document blanc avec coin replié
  const dw = size * 0.44
  const dh = size * 0.56
  const dx = (size - dw) / 2
  const dy = size * 0.18
  const fold = size * 0.11
  c.fillRect(dx, dy + fold, dw, dh - fold, 255, 255, 255)
  c.fillRect(dx + dw - fold, dy, fold, fold, 226, 232, 240)
  for (let y = Math.floor(dy); y < dy + fold; y++)
    for (let x = Math.floor(dx + dw - fold); x < dx + dw; x++) {
      const t = (x - (dx + dw - fold)) / fold + (y - dy) / fold
      if (t >= 1) c.set(x, y, 255, 255, 255)
      else if (t >= 0.85) c.set(x, y, 203, 213, 225)
    }
  // Liseré haut du document
  c.fillRect(dx, dy + fold, dw, Math.max(2, size * 0.012), 29, 78, 216)
  // Lignes de texte
  const lineH = Math.max(2, Math.round(size * 0.018))
  const gap = size * 0.055
  const lx = dx + dw * 0.16
  const lw = dw * 0.68
  let ly = dy + fold + size * 0.10
  for (let i = 0; i < 3; i++) {
    const w = i === 2 ? lw * 0.55 : lw
    c.fillRect(lx, ly, w, lineH, 147, 197, 250)
    ly += gap
  }
  // Coche verte en badge
  const br = size * 0.16
  const bx = dx + dw - br * 0.4
  const by = dy + dh - br * 0.4
  c.fillCircle(bx, by, br, 255, 255, 255)
  c.fillCircle(bx, by, br * 0.86, 34, 197, 94)
  // Trait de coche (deux segments épais)
  const sw = Math.max(2, Math.round(size * 0.022))
  const p1 = [bx - br * 0.42, by + br * 0.02]
  const p2 = [bx - br * 0.08, by + br * 0.36]
  const p3 = [bx + br * 0.48, by - br * 0.34]
  const stroke = (a, b) => {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      c.fillCircle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, sw / 2, 255, 255, 255)
    }
  }
  stroke(p1, p2)
  stroke(p2, p3)
  return encodePNG(size, size, c.px)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192, false))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512, false))
writeFileSync(join(outDir, 'maskable-512.png'), drawIcon(512, true))
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180, true))
console.log('Icônes générées dans public/icons/')
