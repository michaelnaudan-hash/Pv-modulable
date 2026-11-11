import JSZip from 'jszip'
import { db, getParametres, SCHEMA_VERSION } from '../db'
import type { Chantier, DocumentJoint, Parametres, Photo, PointControle, PV } from '../types'
import { extensionDepuisType } from './format'

export const FORMAT_SAUVEGARDE = 1

export interface ManifestSauvegarde {
  app: string
  format: number
  schemaVersion: number
  dateExport: number
  counts: Record<string, number>
  checksums: Record<string, string> // chemin -> sha256 hex
}

export interface RapportImport {
  ok: boolean
  erreurs: string[]
  counts: Record<string, number>
  mode: 'fusion' | 'remplacer'
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', buf as BufferSource)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface DonneesExport {
  chantiers: Chantier[]
  pvs: PV[]
  points: PointControle[]
  photos: Array<Omit<Photo, 'blob'> & { fichier: string }>
  documents: Array<Omit<DocumentJoint, 'blob'> & { fichier: string }>
  parametres: Parametres
  dateExport: number
}

export async function exporterSauvegarde(): Promise<{ blob: Blob; nom: string }> {
  const [chantiers, pvs, points, photos, documents] = await Promise.all([
    db.chantiers.toArray(),
    db.pvs.toArray(),
    db.points.toArray(),
    db.photos.toArray(),
    db.documents.toArray()
  ])
  const parametres = await getParametres()

  const zip = new JSZip()
  const checksums: Record<string, string> = {}

  const photosExport: DonneesExport['photos'] = []
  for (const p of photos) {
    const ext = extensionDepuisType(p.type, p.nom)
    const chemin = `files/photos/${p.id}.${ext}`
    const buf = await p.blob.arrayBuffer()
    zip.file(chemin, buf)
    checksums[chemin] = await sha256Hex(buf)
    const { blob: _omit, ...reste } = p
    photosExport.push({ ...reste, fichier: chemin })
  }

  const documentsExport: DonneesExport['documents'] = []
  for (const d of documents) {
    const ext = extensionDepuisType(d.type, d.nom)
    const chemin = `files/documents/${d.id}.${ext}`
    const buf = await d.blob.arrayBuffer()
    zip.file(chemin, buf)
    checksums[chemin] = await sha256Hex(buf)
    const { blob: _omit, ...reste } = d
    documentsExport.push({ ...reste, fichier: chemin })
  }

  const donnees: DonneesExport = {
    chantiers,
    pvs,
    points,
    photos: photosExport,
    documents: documentsExport,
    parametres,
    dateExport: Date.now()
  }
  const dataJson = JSON.stringify(donnees, null, 2)
  zip.file('data.json', dataJson)
  checksums['data.json'] = await sha256Hex(new TextEncoder().encode(dataJson))

  const manifest: ManifestSauvegarde = {
    app: 'pv-etancheite',
    format: FORMAT_SAUVEGARDE,
    schemaVersion: SCHEMA_VERSION,
    dateExport: donnees.dateExport,
    counts: {
      chantiers: chantiers.length,
      pvs: pvs.length,
      points: points.length,
      photos: photos.length,
      documents: documents.length
    },
    checksums
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const horodatage = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const nom = `sauvegarde-pv-chantier-${horodatage}.zip`
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, nom }
}

function validerDonnees(d: unknown): { valide: boolean; erreurs: string[] } {
  const erreurs: string[] = []
  if (typeof d !== 'object' || d === null) return { valide: false, erreurs: ['data.json illisible'] }
  const o = d as Record<string, unknown>
  for (const cle of ['chantiers', 'pvs', 'points', 'photos', 'documents'] as const) {
    if (!Array.isArray(o[cle])) erreurs.push(`Champ manquant ou invalide: ${cle}`)
  }
  if (o.pvs && Array.isArray(o.pvs)) {
    for (const pv of o.pvs as PV[]) if (typeof pv.chantierId !== 'number') erreurs.push('PV sans chantierId valide')
  }
  return { valide: erreurs.length === 0, erreurs }
}

export type ModeRestauration = 'fusion' | 'remplacer'

export async function importerSauvegarde(fichier: File, mode: ModeRestauration): Promise<RapportImport> {
  const erreurs: string[] = []
  const counts: Record<string, number> = {}
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(fichier)
  } catch {
    return { ok: false, erreurs: ['Fichier ZIP illisible ou corrompu.'], counts, mode }
  }

  const manifestFile = zip.file('manifest.json')
  const dataFile = zip.file('data.json')
  if (!manifestFile || !dataFile) {
    return { ok: false, erreurs: ['Archive invalide: manifest.json ou data.json manquant.'], counts, mode }
  }

  let manifest: ManifestSauvegarde
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as ManifestSauvegarde
  } catch {
    return { ok: false, erreurs: ['manifest.json illisible.'], counts, mode }
  }
  if (manifest.app !== 'pv-etancheite') erreurs.push('Cette archive ne provient pas de cette application.')
  if (manifest.format > FORMAT_SAUVEGARDE) erreurs.push('Format de sauvegarde plus récent que cette version de l\u2019application.')

  // Vérification d'intégrité : checksum SHA-256 de chaque fichier listé
  for (const [chemin, empreinte] of Object.entries(manifest.checksums ?? {})) {
    const f = zip.file(chemin)
    if (!f) {
      erreurs.push(`Fichier manquant dans l'archive: ${chemin}`)
      continue
    }
    const buf = await f.async('uint8array')
    const reel = await sha256Hex(buf)
    if (reel !== empreinte) erreurs.push(`Intégrité non vérifiée (checksum): ${chemin}`)
  }

  let donnees: DonneesExport
  try {
    donnees = JSON.parse(await dataFile.async('string')) as DonneesExport
  } catch {
    return { ok: false, erreurs: [...erreurs, 'data.json illisible.'], counts, mode }
  }
  const validation = validerDonnees(donnees)
  erreurs.push(...validation.erreurs)
  if (erreurs.length > 0) return { ok: false, erreurs, counts, mode }

  const restaurerBlob = async (chemin: string, type: string): Promise<Blob> => {
    const f = zip.file(chemin)
    if (!f) throw new Error(`Fichier manquant: ${chemin}`)
    return f.async('blob').then((b) => new Blob([b], { type }))
  }

  // Lecture de tous les blobs hors transaction (les opérations non IndexedDB cassent la zone de transaction)
  const photos: Photo[] = []
  for (const p of donnees.photos) {
    const { fichier, ...reste } = p
    photos.push({ ...reste, blob: await restaurerBlob(fichier, reste.type || 'image/jpeg') } as Photo)
  }
  const docs: DocumentJoint[] = []
  for (const d of donnees.documents) {
    const { fichier, ...reste } = d
    docs.push({ ...reste, blob: await restaurerBlob(fichier, reste.type || 'application/octet-stream') } as DocumentJoint)
  }

  await db.transaction('rw', [db.chantiers, db.pvs, db.points, db.photos, db.documents, db.parametres], async () => {
    if (mode === 'remplacer') {
      await Promise.all([db.chantiers.clear(), db.pvs.clear(), db.points.clear(), db.photos.clear(), db.documents.clear()])
    }
    await db.chantiers.bulkPut(donnees.chantiers)
    await db.pvs.bulkPut(donnees.pvs)
    await db.points.bulkPut(donnees.points)
    await db.photos.bulkPut(photos)
    await db.documents.bulkPut(docs)
    counts.chantiers = donnees.chantiers.length
    counts.pvs = donnees.pvs.length
    counts.points = donnees.points.length
    counts.photos = photos.length
    counts.documents = docs.length
    if (donnees.parametres) {
      await db.parametres.put({ ...donnees.parametres, cle: 'global', schemaVersion: SCHEMA_VERSION })
    }
  })

  return { ok: true, erreurs: [], counts, mode }
}
