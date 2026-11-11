import Dexie, { type Table } from 'dexie'
import type { Chantier, DocumentJoint, Parametres, Photo, PointControle, PV } from './types'
import { PARAMETRES_DEFAUT } from './types'

export const SCHEMA_VERSION = 1

export class PVDatabase extends Dexie {
  chantiers!: Table<Chantier, number>
  pvs!: Table<PV, number>
  points!: Table<PointControle, number>
  photos!: Table<Photo, number>
  documents!: Table<DocumentJoint, number>
  parametres!: Table<Parametres, string>

  constructor() {
    super('pv-etancheite-db')
    this.version(1).stores({
      chantiers: '++id, nom, archive, dateCreation',
      pvs: '++id, chantierId, numero, date, statut, dateCreation',
      points: '++id, pvId, ordre, phase, resultat',
      photos: '++id, pvId, pointId, dateAjout',
      documents: '++id, pvId, dateAjout',
      parametres: '&cle'
    })
    // Versions futures : ajouter this.version(N).stores({...}).upgrade(...) ici.
    // Les anciennes données ne sont jamais effacées automatiquement.
  }
}

export const db = new PVDatabase()

export async function getParametres(): Promise<Parametres> {
  let p = await db.parametres.get('global')
  if (!p) {
    p = { cle: 'global', ...PARAMETRES_DEFAUT }
    await db.parametres.put(p)
  }
  if (p.schemaVersion < SCHEMA_VERSION) {
    // Point d'entrée des migrations de structure (aucune perte de données).
    p.schemaVersion = SCHEMA_VERSION
    await db.parametres.put(p)
  }
  return p
}

export async function saveParametres(p: Parametres): Promise<void> {
  await db.parametres.put({ ...p, cle: 'global', schemaVersion: SCHEMA_VERSION })
}
