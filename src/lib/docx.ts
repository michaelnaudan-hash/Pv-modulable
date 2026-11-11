import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import type { Parametres, Photo } from '../types'
import { formatDate, formatTaille } from './format'
import type { PVComplet } from './queries'

function couleurHex(hex: string | undefined, defaut: string): string {
  const h = (hex || defaut).replace('#', '')
  return /^[0-9a-fA-F]{6}$/.test(h) ? h.toUpperCase() : defaut.replace('#', '').toUpperCase()
}

function cellule(texte: string, opts?: { gras?: boolean; couleurFond?: string; couleurTexte?: string; largeur?: number; taille?: number }): TableCell {
  return new TableCell({
    width: opts?.largeur ? { size: opts.largeur, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.couleurFond ? { type: ShadingType.CLEAR, fill: opts.couleurFond } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: texte,
            bold: opts?.gras ?? false,
            color: opts?.couleurTexte,
            size: (opts?.taille ?? 18) // 18 half-points = 9pt
          })
        ]
      })
    ]
  })
}

function titreSection(texte: string, couleur: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: texte, bold: true, color: couleur, size: 24 })]
  })
}

async function imageRun(photo: Photo): Promise<ImageRun> {
  const buf = new Uint8Array(await photo.blob.arrayBuffer())
  const largeurPx = 460
  const hauteurPx = photo.largeur && photo.hauteur ? Math.round((largeurPx * photo.hauteur) / photo.largeur) : 300
  return new ImageRun({
    data: buf,
    transformation: { width: largeurPx, height: Math.min(hauteurPx, 560) }
  })
}

export async function genererDOCX(donnees: PVComplet, parametres: Parametres): Promise<Blob> {
  const { pv, chantier, points, photos, documents } = donnees
  const primaire = couleurHex(parametres.charte.couleurPrimaire, '#1d4ed8')
  const secondaire = couleurHex(parametres.charte.couleurSecondaire, '#1e3a8a')

  const infoRows = (
    [
      ['Chantier', `${chantier?.nom ?? ''}${chantier?.numero ? ` (n° ${chantier.numero})` : ''}`],
      ['Localisation du chantier', chantier?.localisation ?? ''],
      ['Date du contrôle', formatDate(pv.date)],
      ['Objet du contrôle', pv.objet ?? ''],
      ['Lieu du contrôle', pv.localisation ?? ''],
      ['Contrôleur (rédacteur)', pv.controleur ?? ''],
      ['Entreprise contrôlée', pv.entrepriseControle ?? chantier?.entreprise ?? ''],
      ["Maître d'ouvrage", chantier?.maitreOuvrage ?? ''],
      ["Maître d'œuvre", chantier?.maitreOeuvre ?? ''],
      ['Conditions météorologiques', pv.conditionsMeteo ?? ''],
      ['Statut du PV', pv.statut === 'brouillon' ? 'Brouillon' : pv.statut === 'valide' ? 'Valide' : 'Clôture']
    ] as [string, string][]
  ).map(([a, b]) => new TableRow({ children: [cellule(a, { gras: true, couleurFond: 'F1F5F9', largeur: 30 }), cellule(b, { largeur: 70 })] }))

  const resultats: Record<string, string> = {
    conforme: 'Conforme',
    non_conforme: 'NON CONFORME',
    reserve: 'Réserve',
    non_controle: 'Non contrôlé'
  }
  const couleurResultat: Record<string, string> = {
    conforme: '15803D',
    non_conforme: 'B91C1C',
    reserve: 'B45309',
    non_controle: '646464'
  }

  const pointsRows = [
    new TableRow({
      tableHeader: true,
      children: ['N°', 'Phase', 'Désignation', 'Référence', 'Résultat', 'Observation'].map((h) =>
        cellule(h, { gras: true, couleurFond: primaire, couleurTexte: 'FFFFFF' })
      )
    }),
    ...points.map((p, i) =>
      new TableRow({
        children: [
          cellule(String(i + 1), { largeur: 6 }),
          cellule(p.phase, { largeur: 17 }),
          cellule(p.designation, { largeur: 28 }),
          cellule(p.reference ?? '', { largeur: 15 }),
          cellule(resultats[p.resultat] ?? p.resultat, { gras: true, couleurTexte: couleurResultat[p.resultat], largeur: 13 }),
          cellule(p.observation ?? '', { largeur: 21 })
        ]
      })
    )
  ]

  const nonConformes = points.filter((p) => p.resultat === 'non_conforme')

  const photoParagraphs: Paragraph[] = []
  for (let i = 0; i < photos.length; i++) {
    const ph = photos[i]
    const point = ph.pointId ? points.find((p) => p.id === ph.pointId) : undefined
    const numPoint = point ? String(points.indexOf(point) + 1) : null
    const legende = `Photo ${i + 1}${ph.legende ? ` — ${ph.legende}` : ''}${ph.phase ? ` (${ph.phase})` : ''}${numPoint ? ` — point de contrôle n°${numPoint}` : ''}`
    photoParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: legende, bold: true, size: 17, color: '3C3C3C' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [await imageRun(ph)] })
    )
  }

  const enfants: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `PV n° ${pv.numero}`, bold: true, size: 36, color: primaire })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: chantier?.nom ?? '', size: 22, color: '444444' })]
    }),
    titreSection('1. Informations générales', primaire),
    new Table({ style: 'TableGrid', width: { size: 100, type: WidthType.PERCENTAGE }, rows: infoRows }),
    titreSection('2. Points de contrôle', primaire),
    ...(points.length === 0
      ? [new Paragraph({ children: [new TextRun({ text: 'Aucun point de contrôle renseigné pour ce PV.', italics: true })] })]
      : [new Table({ style: 'TableGrid', width: { size: 100, type: WidthType.PERCENTAGE }, rows: pointsRows })]),
    titreSection('3. Non-conformités', primaire),
    new Paragraph({
      children: [
        new TextRun({
          text:
            nonConformes.length === 0
              ? 'Aucune non-conformité constatée lors de ce contrôle.'
              : `${nonConformes.length} non-conformité(s) constatée(s) :\n` +
                nonConformes
                  .map((p) => {
                    const n = points.indexOf(p) + 1
                    return `${n}. Point n°${n} — ${p.designation}${p.observation ? ` : ${p.observation}` : ''}`
                  })
                  .join('\n'),
          color: nonConformes.length === 0 ? '15803D' : 'B91C1C',
          bold: nonConformes.length > 0
        })
      ]
    }),
    ...(photos.length > 0 ? [titreSection('4. Photographies', primaire), ...photoParagraphs] : []),
    ...(documents.length > 0
      ? [
          titreSection('5. Documents joints', primaire),
          new Paragraph({
            children: documents.map((d, i) => new TextRun({ text: `${i > 0 ? '\n' : ''}• ${d.nom} (${formatTaille(d.taille)})` }))
          })
        ]
      : []),
    titreSection(documents.length > 0 ? '6. Observations générales' : '5. Observations générales', primaire),
    new Paragraph({
      children: [new TextRun({ text: pv.observationsGenerales?.trim() ? pv.observationsGenerales : 'Aucune observation générale.' })]
    }),
    titreSection(documents.length > 0 ? '7. Signatures' : '6. Signatures', primaire),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cellule(`Le contrôleur\n${pv.controleur ?? ''}\nFait le ${formatDate(pv.date)}\n\nSignature :`, { largeur: 50 }),
            cellule(`Le représentant de l'entreprise\n\nFait le ${formatDate(pv.date)}\n\nSignature :`, { largeur: 50 })
          ]
        })
      ]
    })
  ]

  const headerChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PROCÈS-VERBAL DE CONTRÔLE DE CHANTIER', bold: true, size: 26, color: primaire })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${parametres.nomEntreprise ?? ''}  —  PV n° ${pv.numero}  —  ${chantier?.nom ?? ''}`,
          size: 18,
          color: secondaire
        })
      ]
    })
  ]
  if (parametres.logo) {
    try {
      const m = parametres.logo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
      if (m) {
        const buf = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
        headerChildren.unshift(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: buf, transformation: { width: 90, height: 60 } })]
          })
        )
      }
    } catch {
      /* logo illisible : ignoré */
    }
  }

  const doc = new Document({
    creator: pv.controleur || 'PV Chantier',
    title: `PV ${pv.numero} - ${chantier?.nom ?? ''}`,
    description: 'Procès-verbal de contrôle de chantier généré hors ligne.',
    sections: [
      {
        properties: {
          page: { margin: { top: 1400, bottom: 1200, left: 1134, right: 1134 } }
        },
        headers: { default: new Header({ children: headerChildren }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: parametres.piedDePage || 'Document généré localement — données stockées sur cet appareil uniquement.',
                    size: 14,
                    color: '6E7381'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', size: 14, color: '6E7381' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '6E7381' }),
                  new TextRun({ text: ' / ', size: 14, color: '6E7381' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '6E7381' })
                ]
              })
            ]
          })
        },
        children: enfants
      }
    ]
  })

  return Packer.toBlob(doc)
}
