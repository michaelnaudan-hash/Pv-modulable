// Test hors navigateur du aller-retour sauvegarde ZIP (export -> import -> vérification d'intégrité).
// Lancé via esbuild + node, avec fake-indexeddb. Ne fait pas partie de l'application.
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

;(globalThis as unknown as { indexedDB: unknown }).indexedDB = indexedDB
;(globalThis as unknown as { IDBKeyRange: unknown }).IDBKeyRange = IDBKeyRange

const { db, getParametres } = await import('../src/db')
const { exporterSauvegarde, importerSauvegarde } = await import('../src/lib/backup')

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`ÉCHEC: ${msg}`)
  console.log(`OK: ${msg}`)
}

// --- Données de test ---
const now = Date.now()
const cid = (await db.chantiers.add({
  nom: 'Pont de test', numero: 'OA-1', localisation: 'Lyon', archive: false,
  dateCreation: now, dateModification: now
})) as number
const pid = (await db.pvs.add({
  chantierId: cid, numero: 'PV-2025-001', date: '2025-01-15', objet: 'Contrôle membrane',
  controleur: 'M. Durand', statut: 'brouillon', dateCreation: now, dateModification: now
})) as number
await db.points.add({ pvId: pid, ordre: 1, phase: 'Mise en œuvre', designation: 'Adhérence', reference: 'DTU 43.1', resultat: 'non_conforme', observation: 'Bulles constatées', dateCreation: now })
const photoBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]) // faux contenu "PNG"
const photoBlob = new Blob([photoBytes], { type: 'image/png' })
await db.photos.add({ pvId: pid, pointId: null, legende: 'Vue générale', nom: 'vue.png', type: 'image/png', taille: photoBytes.length, largeur: 1600, hauteur: 1200, blob: photoBlob, dateAjout: now })
await db.documents.add({ pvId: pid, nom: 'fiche.pdf', type: 'application/pdf', taille: 1234, blob: new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' }), dateAjout: now })
await getParametres()

// --- Export ---
const { blob, nom } = await exporterSauvegarde()
assert(nom.endsWith('.zip'), `nom de fichier .zip (${nom})`)
const zipBuf = new Uint8Array(await blob.arrayBuffer())
console.log(`Taille de l'archive: ${zipBuf.length} octets`)

// --- Import dans une base "neuve" (mode remplacer) ---
await db.transaction('rw', [db.chantiers, db.pvs, db.points, db.photos, db.documents, db.parametres], async () => {
  await Promise.all([db.chantiers.clear(), db.pvs.clear(), db.points.clear(), db.photos.clear(), db.documents.clear()])
})
assert((await db.pvs.count()) === 0, 'base vidée avant restauration')

const file = new File([zipBuf], 'sauvegarde.zip', { type: 'application/zip' })
const r1 = await importerSauvegarde(file, 'remplacer')
assert(r1.ok, `restauration OK (${JSON.stringify(r1.counts)})`)
assert(r1.counts.chantiers === 1 && r1.counts.pvs === 1 && r1.counts.points === 1 && r1.counts.photos === 1 && r1.counts.documents === 1, 'compteurs restaurés corrects')
const pv = await db.pvs.get(pid)
assert(!!pv && pv.numero === 'PV-2025-001' && pv.controleur === 'M. Durand', 'PV restauré avec ses champs')
const ph = await db.photos.where('pvId').equals(pid!).first()
const phBuf = new Uint8Array(await ph!.blob.arrayBuffer())
assert(phBuf.length === photoBytes.length && phBuf[0] === 137 && phBuf[11] === 8, 'blob photo restauré à l\u2019identique')

// --- Intégrité : archive altérée -> refus ---
const JSZip = (await import('jszip')).default
const zip2 = await JSZip.loadAsync(zipBuf)
zip2.file('data.json', JSON.stringify({ chantiers: 'corrompu' }))
const zip2Buf = await zip2.generateAsync({ type: 'uint8array' })
const r2 = await importerSauvegarde(new File([zip2Buf], 'corrompue.zip', { type: 'application/zip' }), 'fusion')
assert(!r2.ok && r2.erreurs.length > 0, `archive corrompue refusée (${r2.erreurs[0] ?? ''})`)
assert((await db.pvs.count()) === 1, 'aucune donnée modifiée après refus')

// --- Fusion : doublon de PV avec nouvel id ---
const pid2 = (await db.pvs.add({ chantierId: cid, numero: 'PV-2025-002', date: '2025-01-16', statut: 'brouillon', dateCreation: now, dateModification: now })) as number
const r3 = await importerSauvegarde(file, 'fusion')
assert(r3.ok && r3.mode === 'fusion', 'fusion acceptée')
assert((await db.pvs.count()) === 2, 'fusion conserve les données existantes (upsert)')
await db.pvs.delete(pid2)

console.log('\nTous les tests de sauvegarde/restauration passent.')
process.exit(0)
