import { db, getParametres } from '../db'
import type { Chantier, DocumentJoint, Photo, PointControle, PV } from '../types'

export interface PVComplet {
  pv: PV
  chantier: Chantier | undefined
  points: PointControle[]
  photos: Photo[]
  documents: DocumentJoint[]
}

export async function chargerPVComplet(pvId: number): Promise<PVComplet | null> {
  const pv = await db.pvs.get(pvId)
  if (!pv) return null
  const [chantier, points, photos, documents] = await Promise.all([
    db.chantiers.get(pv.chantierId),
    db.points.where('pvId').equals(pvId).sortBy('ordre'),
    db.photos.where('pvId').equals(pvId).sortBy('dateAjout'),
    db.documents.where('pvId').equals(pvId).sortBy('dateAjout')
  ])
  return { pv, chantier, points, photos, documents }
}

export async function compterParStatut(): Promise<{ total: number; brouillons: number; valides: number; clotures: number }> {
  const [total, brouillons, valides, clotures] = await Promise.all([
    db.pvs.count(),
    db.pvs.where('statut').equals('brouillon').count(),
    db.pvs.where('statut').equals('valide').count(),
    db.pvs.where('statut').equals('cloture').count()
  ])
  return { total, brouillons, valides, clotures }
}

export async function dernieresSauvegardesInfo(): Promise<{ date?: number; rappelJours: number; enRetard: boolean }> {
  const p = await getParametres()
  const enRetard =
    !!p.derniereSauvegarde && Date.now() - p.derniereSauvegarde > p.rappelSauvegardeJours * 24 * 3600 * 1000
  const jamais = !p.derniereSauvegarde
  return { date: p.derniereSauvegarde, rappelJours: p.rappelSauvegardeJours, enRetard: enRetard || jamais }
}
