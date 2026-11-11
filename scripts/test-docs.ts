// Test hors navigateur des moteurs de génération PDF et DOCX (fonctionnent sans réseau).
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

;(globalThis as unknown as { indexedDB: unknown }).indexedDB = indexedDB
;(globalThis as unknown as { IDBKeyRange: unknown }).IDBKeyRange = IDBKeyRange

// Polyfill minimal de FileReader pour Node (utilisé par blobEnDataURL)
class FR {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`
      this.onload?.()
    }, (e) => this.onerror?.(e))
  }
}
;(globalThis as unknown as { FileReader: unknown }).FileReader = FR

const { db, getParametres, saveParametres } = await import('../src/db')
const { chargerPVComplet } = await import('../src/lib/queries')
const { genererPDF } = await import('../src/lib/pdf')
const { genererDOCX } = await import('../src/lib/docx')

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`ÉCHEC: ${msg}`)
  console.log(`OK: ${msg}`)
}

const now = Date.now()
const cid = (await db.chantiers.add({
  nom: 'Pont-route de la vallée', numero: 'OA-2024-017', localisation: 'PK 12+400, Savoie',
  maitreOuvrage: 'Département', entreprise: 'ÉtanchePro', archive: false, dateCreation: now, dateModification: now
})) as number
const pid = (await db.pvs.add({
  chantierId: cid, numero: 'PV-2025-003', date: '2025-03-10', objet: "Contrôle de mise en œuvre de l'étanchéité",
  localisation: 'travée P2-P3', controleur: 'M. Durand', entrepriseControle: 'ÉtanchePro',
  conditionsMeteo: '12 °C, pluie fine', observationsGenerales: 'RAS global.', statut: 'valide',
  dateCreation: now, dateModification: now
})) as number
await db.points.add({ pvId: pid, ordre: 1, phase: 'Préparation du support', designation: 'Propreté du support béton', reference: 'DTU 43.1 §4', resultat: 'conforme', dateCreation: now })
await db.points.add({ pvId: pid, ordre: 2, phase: 'Mise en œuvre', designation: 'Adhérence membrane', reference: 'CCTG', resultat: 'non_conforme', observation: 'Bulles côté rive droite', dateCreation: now })
// Fausse photo JPEG (1x1 px) pour tester l'intégration d'image
const jpeg1x1 = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AvwA//9k=', 'base64')
await db.photos.add({ pvId: pid, pointId: null, phase: 'Mise en œuvre', legende: 'Bulles constatées', nom: 'bulle.jpg', type: 'image/jpeg', taille: jpeg1x1.length, largeur: 1600, hauteur: 1200, blob: new Blob([jpeg1x1], { type: 'image/jpeg' }), dateAjout: now })

const p = await getParametres()
p.nomEntreprise = 'Bureau de contrôle Exemple'
p.logo = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')
await saveParametres(p)

const data = (await chargerPVComplet(pid))!
assert(data.points.length === 2 && data.photos.length === 1, 'données de test chargées')

const pdfBlob = await genererPDF(data, p)
const pdfBuf = Buffer.from(await pdfBlob.arrayBuffer())
assert(pdfBuf.subarray(0, 5).toString() === '%PDF-', `PDF généré (${pdfBuf.length} octets, en-tête %PDF-)`)
assert(pdfBuf.includes(Buffer.from('PV n° PV-2025-003')) || pdfBuf.length > 5000, 'PDF non vide avec contenu')

const docxBlob = await genererDOCX(data, p)
const docxBuf = Buffer.from(await docxBlob.arrayBuffer())
assert(docxBuf.subarray(0, 2).toString() === 'PK', `DOCX généré (${docxBuf.length} octets, en-tête ZIP PK)`)

console.log('\nTous les tests de génération documentaire passent (hors ligne).')
process.exit(0)
