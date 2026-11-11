import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getParametres } from '../db'
import type { Parametres } from '../types'
import { chargerPVComplet, type PVComplet } from '../lib/queries'
import { genererPDF } from '../lib/pdf'
import { genererDOCX } from '../lib/docx'
import { downloadBlob, formatDate, formatTaille, slugify } from '../lib/format'
import { blobEnDataURL } from '../lib/photos'
import { ResultatBadge, StatutBadge } from '../components/Badges'

export default function Preview() {
  const { id } = useParams()
  const [data, setData] = useState<PVComplet | null>(null)
  const [parametres, setParametres] = useState<Parametres | null>(null)
  const [enCours, setEnCours] = useState<'pdf' | 'docx' | null>(null)
  const [erreur, setErreur] = useState('')
  const [urlsPhotos, setUrlsPhotos] = useState<Record<number, string>>({})

  useEffect(() => {
    ;(async () => {
      const d = await chargerPVComplet(Number(id))
      setData(d)
      setParametres(await getParametres())
      if (d) {
        const urls: Record<number, string> = {}
        for (const p of d.photos) {
          if (p.id != null) urls[p.id] = await blobEnDataURL(p.blob)
        }
        setUrlsPhotos(urls)
      }
    })()
  }, [id])

  const exporter = async (format: 'pdf' | 'docx') => {
    if (!data || !parametres) return
    setEnCours(format)
    setErreur('')
    try {
      const base = `PV-${slugify(data.pv.numero)}${data.chantier ? `-${slugify(data.chantier.nom)}` : ''}`
      if (format === 'pdf') {
        const blob = await genererPDF(data, parametres)
        downloadBlob(blob, `${base}.pdf`)
      } else {
        const blob = await genererDOCX(data, parametres)
        downloadBlob(blob, `${base}.docx`)
      }
    } catch (e) {
      setErreur(`Échec de la génération : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setEnCours(null)
    }
  }

  if (!data || !parametres) return <p className="text-sm text-slate-500">Chargement de l'aperçu…</p>
  const { pv, chantier, points, photos, documents } = data
  const nonConformes = points.filter((p) => p.resultat === 'non_conforme')
  const primaire = parametres.charte.couleurPrimaire

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/pv/${id}`} className="btn-secóndaire btn-secondaire !px-3">← Retour au PV</Link>
        <h1 className="text-2xl font-bold text-slate-900 flex-1 min-w-52">Aperçu du PV n°{pv.numero}</h1>
        <button className="btn-primaire" onClick={() => exporter('pdf')} disabled={enCours !== null}>
          {enCours === 'pdf' ? 'Génération…' : '⬇ Télécharger le PDF'}
        </button>
        <button className="btn-secondaire" onClick={() => exporter('docx')} disabled={enCours !== null}>
          {enCours === 'docx' ? 'Génération…' : '⬇ Télécharger le Word (.docx)'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        La génération est entièrement réalisée sur cet appareil : elle fonctionne hors ligne, même en mode avion.
      </p>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {/* Aperçu fidèle au document */}
      <div className="bg-white shadow-lg border border-slate-200 mx-auto max-w-[210mm] p-6 md:p-10 text-sm" style={{ color: '#1e293b' }}>
        <div className="pb-4 mb-4" style={{ borderBottom: `3px solid ${primaire}` }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {parametres.logo && <img src={parametres.logo} alt="Logo" className="h-14 w-auto object-contain" />}
              <div>
                <div className="text-xl font-bold" style={{ color: primaire }}>
                  PROCÈS-VERBAL DE CONTRÔLE DE CHANTIER
                </div>
                <div className="text-sm text-slate-500">{parametres.nomEntreprise}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold" style={{ color: primaire }}>PV n°{pv.numero}</div>
              <StatutBadge statut={pv.statut} />
            </div>
          </div>
        </div>

        <h2 className="font-bold mt-4 mb-2" style={{ color: primaire }}>1. Informations générales</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {(
              [
                ['Chantier', `${chantier?.nom ?? ''}${chantier?.numero ? ` (n° ${chantier.numero})` : ''}`],
                ['Localisation du chantier', chantier?.localisation],
                ['Date du contrôle', formatDate(pv.date)],
                ['Objet du contrôle', pv.objet],
                ['Lieu du contrôle', pv.localisation],
                ['Contrôleur (rédacteur)', pv.controleur],
                ['Entreprise contrôlée', pv.entrepriseControle || chantier?.entreprise],
                ["Maître d'ouvrage", chantier?.maitreOuvrage],
                ["Maître d'œuvre", chantier?.maitreOeuvre],
                ['Conditions météorologiques', pv.conditionsMeteo]
              ] as [string, string | undefined][]
            ).map(([a, b]) => (
              <tr key={a} className="border-b border-slate-200">
                <td className="py-1.5 pr-3 font-semibold bg-slate-50 w-56 align-top">{a}</td>
                <td className="py-1.5">{b || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>2. Points de contrôle</h2>
        {points.length === 0 ? (
          <p className="italic text-slate-500">Aucun point de contrôle renseigné.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: primaire }} className="text-white">
                {['N°', 'Phase', 'Désignation', 'Référence', 'Résultat', 'Observation'].map((h) => (
                  <th key={h} className="p-1.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.id} className="border-b border-slate-200 align-top">
                  <td className="p-1.5 text-center">{i + 1}</td>
                  <td className="p-1.5">{p.phase}</td>
                  <td className="p-1.5">{p.designation}</td>
                  <td className="p-1.5">{p.reference || '—'}</td>
                  <td className="p-1.5"><ResultatBadge resultat={p.resultat} /></td>
                  <td className="p-1.5 whitespace-pre-line">{p.observation || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>3. Non-conformités</h2>
        {nonConformes.length === 0 ? (
          <p className="text-emerald-700 bg-emerald-50 rounded px-2 py-1 inline-block">Aucune non-conformité constatée.</p>
        ) : (
          <ul className="list-disc list-inside bg-red-50 text-red-800 rounded px-3 py-2 space-y-1">
            {nonConformes.map((p) => (
              <li key={p.id}>
                Point n°{points.indexOf(p) + 1} — {p.designation}
                {p.observation ? ` : ${p.observation}` : ''}
              </li>
            ))}
          </ul>
        )}

        {photos.length > 0 && (
          <>
            <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>4. Photographies ({photos.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p, i) => {
                const point = p.pointId ? points.find((x) => x.id === p.pointId) : undefined
                return (
                  <figure key={p.id}>
                    {p.id != null && urlsPhotos[p.id] && (
                      <img src={urlsPhotos[p.id]} alt={p.legende || ''} className="w-full h-36 object-cover border border-slate-200 rounded" />
                    )}
                    <figcaption className="text-xs text-slate-500 mt-1">
                      Photo {i + 1}
                      {p.legende ? ` — ${p.legende}` : ''}
                      {p.phase ? ` (${p.phase})` : ''}
                      {point ? ` — point n°${points.indexOf(point) + 1}` : ''} · {formatTaille(p.taille)}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </>
        )}

        {documents.length > 0 && (
          <>
            <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>{photos.length > 0 ? '5' : '4'}. Documents joints</h2>
            <ul className="list-disc list-inside text-slate-700">
              {documents.map((d) => (
                <li key={d.id}>{d.nom} ({formatTaille(d.taille)})</li>
              ))}
            </ul>
          </>
        )}

        <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>{photos.length > 0 ? (documents.length > 0 ? '6' : '5') : (documents.length > 0 ? '5' : '4')}. Observations générales</h2>
        <p className="whitespace-pre-line text-slate-700">{pv.observationsGenerales?.trim() || 'Aucune observation générale.'}</p>

        <h2 className="font-bold mt-6 mb-2" style={{ color: primaire }}>{photos.length > 0 ? (documents.length > 0 ? '7' : '6') : (documents.length > 0 ? '6' : '5')}. Signatures</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-slate-300 rounded p-3 h-28">
            <p className="font-semibold">Le contrôleur</p>
            <p>{pv.controleur || '—'}</p>
            <p className="text-slate-500 text-xs">Fait le {formatDate(pv.date)}</p>
            <p className="text-slate-400 text-xs mt-4">Signature :</p>
          </div>
          <div className="border border-slate-300 rounded p-3 h-28">
            <p className="font-semibold">Le représentant de l'entreprise</p>
            <p className="text-slate-500 text-xs">Fait le {formatDate(pv.date)}</p>
            <p className="text-slate-400 text-xs mt-4">Signature :</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 border-t border-slate-200 pt-3">
          {parametres.piedDePage || 'Document généré localement — données stockées sur cet appareil uniquement.'}
        </p>
      </div>
    </div>
  )
}
