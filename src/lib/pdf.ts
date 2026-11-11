import { jsPDF } from 'jspdf'
import autoTableImport from 'jspdf-autotable'

// Interop CJS/ESM : selon le bundler, la fonction est sur .default ou directement sur l'import
const autoTable =
  (autoTableImport as unknown as { default?: typeof autoTableImport }).default ?? autoTableImport
import type { Chantier, Parametres, Photo, PointControle, PV } from '../types'
import { formatDate, formatTaille } from './format'
import { blobEnDataURL } from './photos'
import type { PVComplet } from './queries'

const PAGE_W = 210
const PAGE_H = 297
const MARGE = 15
const CONTENT_W = PAGE_W - 2 * MARGE
const Y_DEBUT = 34
const Y_MAX = 282

// Les polices standard de jsPDF sont en Latin-1 : on ramène les caractères problématiques.
export function nettoyerTexte(s: string | undefined | null): string {
  if (!s) return ''
  return s
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const v = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function formatImage(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

async function imageDataUrl(blob: Blob): Promise<string> {
  return blobEnDataURL(blob)
}

export async function genererPDF(donnees: PVComplet, parametres: Parametres): Promise<Blob> {
  const { pv, chantier, points, photos, documents } = donnees
  const primaire = parametres.charte.couleurPrimaire || '#1d4ed8'
  const secondaire = parametres.charte.couleurSecondaire || '#1e3a8a'
  const [pr, pg, pb] = hexToRgb(primaire)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  let y = Y_DEBUT

  const titre = (texte: string) => {
    if (y > Y_MAX - 10) {
      doc.addPage()
      y = Y_DEBUT
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(pr, pg, pb)
    doc.text(nettoyerTexte(texte), MARGE, y)
    doc.setDrawColor(pr, pg, pb)
    doc.setLineWidth(0.4)
    doc.line(MARGE, y + 1.5, MARGE + CONTENT_W, y + 1.5)
    y += 7
  }

  const paragraphe = (texte: string, opts?: { couleurFond?: [number, number, number]; taille?: number }) => {
    const lignes = doc.splitTextToSize(nettoyerTexte(texte), CONTENT_W - 4) as string[]
    const taille = opts?.taille ?? 9.5
    const hauteur = lignes.length * (taille * 0.42) + 3
    if (y + hauteur > Y_MAX) {
      doc.addPage()
      y = Y_DEBUT
    }
    if (opts?.couleurFond) {
      doc.setFillColor(...opts.couleurFond)
      doc.rect(MARGE, y - 3.5, CONTENT_W, hauteur, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(taille)
    doc.setTextColor(30, 30, 30)
    doc.text(lignes, MARGE + 2, y)
    y += hauteur + 2
  }

  // --- 1. Informations générales ---
  titre('1. Informations generales')
  const lignesInfo: [string, string][] = [
    ['Chantier', `${chantier?.nom ?? ''}${chantier?.numero ? ` (n° ${chantier.numero})` : ''}`],
    ['Localisation du chantier', chantier?.localisation ?? ''],
    ['Date du controle', formatDate(pv.date)],
    ['Objet du controle', pv.objet ?? ''],
    ['Lieu du controle', pv.localisation ?? ''],
    ['Controleur (redacteur)', pv.controleur ?? ''],
    ['Entreprise controlee', pv.entrepriseControle ?? chantier?.entreprise ?? ''],
    ["Maitre d'ouvrage", chantier?.maitreOuvrage ?? ''],
    ["Maitre d'oeuvre", chantier?.maitreOeuvre ?? ''],
    ['Conditions meteorologiques', pv.conditionsMeteo ?? ''],
    ['Statut du PV', pv.statut === 'brouillon' ? 'Brouillon' : pv.statut === 'valide' ? 'Valide' : 'Cloture']
  ]
  autoTable(doc, {
    startY: y,
    body: lignesInfo.map(([a, b]) => [nettoyerTexte(a), nettoyerTexte(b)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6, textColor: [30, 30, 30], lineColor: [220, 225, 235], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] },
      1: { cellWidth: CONTENT_W - 52 }
    },
    margin: { left: MARGE, right: MARGE }
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // --- 2. Points de contrôle ---
  titre('2. Points de controle')
  if (points.length === 0) {
    paragraphe('Aucun point de controle renseigne pour ce PV.')
  } else {
    const resultats: Record<string, string> = {
      conforme: 'Conforme',
      non_conforme: 'NON CONFORME',
      reserve: 'Reserve',
      non_controle: 'Non controle'
    }
    autoTable(doc, {
      startY: y,
      head: [['N°', 'Phase', 'Designation', 'Reference', 'Resultat', 'Observation']],
      body: points.map((p, i) => [
        String(i + 1),
        nettoyerTexte(p.phase),
        nettoyerTexte(p.designation),
        nettoyerTexte(p.reference ?? ''),
        resultats[p.resultat] ?? p.resultat,
        nettoyerTexte(p.observation ?? '')
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, lineColor: [220, 225, 235], lineWidth: 0.1, valign: 'top' },
      headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 50 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: CONTENT_W - 9 - 30 - 50 - 28 - 24 }
      },
      didParseCell: (hook) => {
        if (hook.section === 'body' && hook.column.index === 4) {
          const brut = points[hook.row.index]?.resultat
          if (brut === 'conforme') hook.cell.styles.textColor = [21, 128, 61]
          else if (brut === 'non_conforme') hook.cell.styles.textColor = [185, 28, 28]
          else if (brut === 'reserve') hook.cell.styles.textColor = [180, 83, 9]
          else hook.cell.styles.textColor = [100, 100, 100]
        }
      },
      margin: { left: MARGE, right: MARGE }
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // --- 3. Non-conformités ---
  const nonConformes = points.filter((p) => p.resultat === 'non_conforme')
  titre('3. Non-conformites')
  if (nonConformes.length === 0) {
    paragraphe('Aucune non-conformite constatee lors de ce controle.', { couleurFond: [240, 253, 244] })
  } else {
    paragraphe(
      `${nonConformes.length} non-conformite(s) constatee(s) :\n` +
        nonConformes
          .map((p, i) => {
            const n = points.indexOf(p) + 1
            return `${i + 1}. Point n°${n} - ${p.designation}${p.observation ? ` : ${p.observation}` : ''}`
          })
          .join('\n'),
      { couleurFond: [254, 242, 242] }
    )
  }

  // --- 4. Photographies ---
  if (photos.length > 0) {
    titre('4. Photographies')
    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i]
      const point = ph.pointId ? points.find((p) => p.id === ph.pointId) : undefined
      const numPoint = point ? String(points.indexOf(point) + 1) : null
      const legende = `Photo ${i + 1}${ph.legende ? ` - ${ph.legende}` : ''}${ph.phase ? ` (${ph.phase})` : ''}${numPoint ? ` - point de controle n°${numPoint}` : ''}`
      let largeur = 130
      let hauteur = ph.largeur && ph.hauteur ? (largeur * ph.hauteur) / ph.largeur : 80
      if (hauteur > 105) {
        hauteur = 105
        largeur = ph.largeur && ph.hauteur ? (hauteur * ph.largeur) / ph.hauteur : 130
      }
      const hauteurBloc = hauteur + 7
      if (y + hauteurBloc > Y_MAX) {
        doc.addPage()
        y = Y_DEBUT
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(60, 60, 60)
      doc.text(nettoyerTexte(legende), MARGE, y)
      y += 4.5
      const dataUrl = await imageDataUrl(ph.blob)
      const x = MARGE + (CONTENT_W - largeur) / 2
      doc.addImage(dataUrl, formatImage(dataUrl), x, y, largeur, hauteur)
      doc.setDrawColor(180, 185, 195)
      doc.setLineWidth(0.2)
      doc.rect(x, y, largeur, hauteur)
      y += hauteur + 5
    }
  }

  // --- 5. Documents joints ---
  if (documents.length > 0) {
    titre('5. Documents joints')
    paragraphe(
      documents.map((d) => `- ${d.nom} (${formatTaille(d.taille)})`).join('\n')
    )
  }

  // --- 6. Observations générales ---
  titre('6. Observations generales')
  paragraphe(pv.observationsGenerales?.trim() ? pv.observationsGenerales : 'Aucune observation generale.')

  // --- 7. Signatures ---
  titre('7. Signatures')
  const hauteurSign = 32
  if (y + hauteurSign > Y_MAX) {
    doc.addPage()
    y = Y_DEBUT
  }
  const largeurCase = (CONTENT_W - 8) / 2
  doc.setDrawColor(150, 155, 165)
  doc.setLineWidth(0.3)
  doc.rect(MARGE, y, largeurCase, hauteurSign)
  doc.rect(MARGE + largeurCase + 8, y, largeurCase, hauteurSign)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text('Le controleur', MARGE + 3, y + 6)
  doc.text(nettoyerTexte(pv.controleur ?? ''), MARGE + 3, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Fait le ${formatDate(pv.date)}`, MARGE + 3, y + 16)
  doc.text('Signature :', MARGE + 3, y + hauteurSign - 5)
  doc.text("Le representant de l'entreprise", MARGE + largeurCase + 11, y + 6)
  doc.text(`Fait le ${formatDate(pv.date)}`, MARGE + largeurCase + 11, y + 16)
  doc.text('Signature :', MARGE + largeurCase + 11, y + hauteurSign - 5)
  y += hauteurSign + 4

  // --- En-têtes et pieds de page sur toutes les pages (2e passe) ---
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    // Bandeau d'en-tête
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 0, PAGE_W, 17, 'F')
    doc.setFillColor(...hexToRgb(secondaire))
    doc.rect(0, 17, PAGE_W, 1.2, 'F')
    if (parametres.logo) {
      try {
        doc.addImage(parametres.logo, formatImage(parametres.logo), MARGE, 3.5, 12, 10)
      } catch {
        /* logo illisible : on ignore */
      }
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('PROCES-VERBAL DE CONTROLE DE CHANTIER', PAGE_W / 2, 8.5, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(nettoyerTexte(parametres.nomEntreprise ?? ''), PAGE_W / 2, 13.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`PV n° ${nettoyerTexte(pv.numero)}`, PAGE_W - MARGE, 8.5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(nettoyerTexte(chantier?.nom ?? ''), PAGE_W - MARGE, 13.5, { align: 'right' })

    // Pied de page
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.2)
    doc.line(MARGE, PAGE_H - 12, PAGE_W - MARGE, PAGE_H - 12)
    doc.setTextColor(110, 115, 125)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const pied = nettoyerTexte(parametres.piedDePage ?? 'Document genere localement - donnees stockees sur cet appareil uniquement.')
    doc.text(doc.splitTextToSize(pied, 120) as string[], MARGE, PAGE_H - 8)
    doc.text(`Page ${i} / ${total}`, PAGE_W - MARGE, PAGE_H - 8, { align: 'right' })
    doc.text('Genere hors ligne', PAGE_W / 2, PAGE_H - 8, { align: 'center' })
  }

  return doc.output('blob')
}
