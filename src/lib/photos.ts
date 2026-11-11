import { extensionDepuisType } from './format'

export interface ImageCompressee {
  blob: Blob
  dataUrl: string
  largeur: number
  hauteur: number
  taille: number
}

const MAX_DIMENSION = 1600
const QUALITE_JPEG = 0.82

export function blobEnDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dimensionsImage(dataUrl: string): Promise<{ largeur: number; hauteur: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ largeur: img.naturalWidth, hauteur: img.naturalHeight })
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = dataUrl
  })
}

// Compresse une image (redimensionnement + JPEG) pour limiter l'espace occupé
// tout en conservant une qualité suffisante pour le rapport.
export async function compresserImage(file: File): Promise<ImageCompressee> {
  const dataUrl = await blobEnDataURL(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = dataUrl
  })
  let { naturalWidth: w, naturalHeight: h } = img
  if (Math.max(w, h) > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / Math.max(w, h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const type = 'image/jpeg'
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression impossible'))),
      type,
      QUALITE_JPEG
    )
  })
  const out = await blobEnDataURL(blob)
  return { blob, dataUrl: out, largeur: w, hauteur: h, taille: blob.size }
}

export function nomPhotoOriginal(file: File, index: number): string {
  const ext = extensionDepuisType(file.type, file.name)
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40) || 'photo'
  return `${base}-${index + 1}.${ext}`
}
