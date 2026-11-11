import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { PHASES_CONTROLE, RESULTATS, type DocumentJoint, type PointControle, type ResultatControle } from '../types'
import type { PVComplet } from '../lib/queries'
import { chargerPVComplet } from '../lib/queries'
import { formatDate, formatTaille, downloadBlob, todayISO } from '../lib/format'
import { ResultatBadge, StatutBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'
import PhotoGallery from '../components/PhotoGallery'

type Onglet = 'points' | 'photos' | 'documents' | 'infos'

export default function PVDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<PVComplet | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('points')
  const [pointEdite, setPointEdite] = useState<PointControle | 'nouveau' | null>(null)
  const [supprPV, setSupprPV] = useState(false)
  const [docASuppr, setDocASuppr] = useState<DocumentJoint | null>(null)
  const inputDoc = useRef<HTMLInputElement>(null)

  const recharger = async () => setData(await chargerPVComplet(Number(id)))

  useEffect(() => {
    recharger()
  }, [id])

  const supprimerPV = async () => {
    const pid = Number(id)
    await db.transaction('rw', db.pvs, db.points, db.photos, db.documents, async () => {
      await db.points.where('pvId').equals(pid).delete()
      await db.photos.where('pvId').equals(pid).delete()
      await db.documents.where('pvId').equals(pid).delete()
      await db.pvs.delete(pid)
    })
    navigate(data?.chantier ? `/chantiers/${data.chantier.id}` : '/chantiers')
  }

  const ajouterDocument = async (fichiers: FileList | null) => {
    if (!fichiers) return
    for (const f of Array.from(fichiers)) {
      await db.documents.add({
        pvId: Number(id),
        nom: f.name,
        type: f.type || 'application/octet-stream',
        taille: f.size,
        blob: f,
        dateAjout: Date.now()
      })
    }
    if (inputDoc.current) inputDoc.current.value = ''
    await recharger()
  }

  const deplacer = async (p: PointControle, sens: -1 | 1) => {
    const autre = data?.points.find((x) => x.ordre === p.ordre + sens)
    if (!autre || !p.id || !autre.id) return
    await db.transaction('rw', db.points, async () => {
      await db.points.update(p.id!, { ordre: autre.ordre })
      await db.points.update(autre.id!, { ordre: p.ordre })
    })
    await recharger()
  }

  if (!data) return <p className="text-sm text-slate-500">Chargement…</p>
  const { pv, chantier, points, documents } = data
  const nonConformes = points.filter((p) => p.resultat === 'non_conforme')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={chantier ? `/chantiers/${chantier.id}` : '/chantiers'} className="btn-secondaire !px-3">
          ← {chantier?.nom ?? 'Chantiers'}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex-1 min-w-52">PV n°{pv.numero}</h1>
        <StatutBadge statut={pv.statut} />
        <Link to={`/pv/${id}/editer`} className="btn-secondaire">
          Modifier
        </Link>
        <Link to={`/pv/${id}/apercu`} className="btn-primaire">
          👁 Aperçu & export PDF / Word
        </Link>
        <button className="btn-danger" onClick={() => setSupprPV(true)}>
          Supprimer
        </button>
      </div>

      <div className="carte p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
        <div><span className="label">Date</span>{formatDate(pv.date)}</div>
        <div><span className="label">Contrôleur</span>{pv.controleur || '—'}</div>
        <div><span className="label">Objet</span>{pv.objet || '—'}</div>
        <div><span className="label">Lieu</span>{pv.localisation || '—'}</div>
      </div>

      {nonConformes.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-bold text-red-700 text-sm">⚠ {nonConformes.length} non-conformité(s) sur ce PV</p>
          <ul className="mt-1 list-disc list-inside text-sm text-red-800">
            {nonConformes.map((p) => (
              <li key={p.id}>
                Point n°{points.indexOf(p) + 1} — {p.designation}
                {p.observation ? ` : ${p.observation}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {(
          [
            ['points', `Points de contrôle (${points.length})`],
            ['photos', `Photos (${data.photos.length})`],
            ['documents', `Documents (${documents.length})`],
            ['infos', 'Infos générales']
          ] as [Onglet, string][]
        ).map(([o, label]) => (
          <button key={o} className={`onglet ${onglet === o ? 'onglet-actif' : ''}`} onClick={() => setOnglet(o)}>
            {label}
          </button>
        ))}
      </div>

      {onglet === 'points' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-primaire" onClick={() => setPointEdite('nouveau')}>
              + Ajouter un point de contrôle
            </button>
          </div>
          {points.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucun point de contrôle. Ajoutez les contrôles réalisés.</p>
          ) : (
            <div className="carte divide-y divide-slate-100">
              {points.map((p, i) => (
                <div key={p.id} className="p-4 flex flex-wrap gap-2 items-start">
                  <span className="font-bold text-slate-400 text-sm w-7">n°{i + 1}</span>
                  <div className="flex-1 min-w-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{p.phase}</span>
                      <ResultatBadge resultat={p.resultat} />
                    </div>
                    <p className="font-medium text-sm mt-1">{p.designation}</p>
                    {p.reference && <p className="text-xs text-slate-500">Réf. : {p.reference}</p>}
                    {p.observation && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{p.observation}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-secondaire !px-2 !py-1 !text-xs" disabled={i === 0} onClick={() => deplacer(p, -1)} title="Monter">↑</button>
                    <button className="btn-secondaire !px-2 !py-1 !text-xs" disabled={i === points.length - 1} onClick={() => deplacer(p, 1)} title="Descendre">↓</button>
                    <button className="btn-secondaire !px-2 !py-1 !text-xs" onClick={() => setPointEdite(p)}>Modifier</button>
                    <SupprPoint id={p.id!} onDone={recharger} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === 'photos' && <PhotoGallery pvId={Number(id)} points={points} />}

      {onglet === 'documents' && (
        <div className="space-y-3">
          <div className="carte p-4 flex flex-wrap items-center gap-3">
            <button className="btn-primaire" onClick={() => inputDoc.current?.click()}>+ Joindre un document</button>
            <input ref={inputDoc} type="file" multiple className="hidden" onChange={(e) => ajouterDocument(e.target.files)} />
            <p className="text-xs text-slate-500">Tout type de fichier (PDF, plans, fiches…), stocké localement avec le PV.</p>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucun document joint.</p>
          ) : (
            <div className="carte divide-y divide-slate-100">
              {documents.map((d) => (
                <div key={d.id} className="p-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">📎 {d.nom}</span>
                  <span className="text-xs text-slate-400">{formatTaille(d.taille)}</span>
                  <div className="ml-auto flex gap-1">
                    <button className="btn-secondaire !px-2 !py-1 !text-xs" onClick={() => downloadBlob(d.blob, d.nom)}>Télécharger</button>
                    <button className="btn-danger !px-2 !py-1 !text-xs" onClick={() => setDocASuppr(d)}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === 'infos' && (
        <div className="carte p-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <ChampInfo label="Numéro" valeur={pv.numero} />
          <ChampInfo label="Date du contrôle" valeur={formatDate(pv.date)} />
          <ChampInfo label="Objet" valeur={pv.objet} />
          <ChampInfo label="Lieu" valeur={pv.localisation} />
          <ChampInfo label="Contrôleur (rédacteur)" valeur={pv.controleur} />
          <ChampInfo label="Entreprise contrôlée" valeur={pv.entrepriseControle} />
          <ChampInfo label="Conditions météo" valeur={pv.conditionsMeteo} />
          <ChampInfo label="Statut" valeur={pv.statut} />
          <div className="sm:col-span-2">
            <span className="label">Observations générales</span>
            <p className="whitespace-pre-line">{pv.observationsGenerales || '—'}</p>
          </div>
        </div>
      )}

      {pointEdite && (
        <PointEditor
          pvId={Number(id)}
          point={pointEdite === 'nouveau' ? null : pointEdite}
          ordreMax={points.length}
          onFermer={() => setPointEdite(null)}
          onEnregistre={async () => {
            setPointEdite(null)
            await recharger()
          }}
        />
      )}

      <ConfirmDialog
        ouvert={supprPV}
        titre="Supprimer ce PV ?"
        message={`Le PV n°${pv.numero} et tous ses points de contrôle, photos et documents seront supprimés définitivement.`}
        texteConfirmer="Supprimer définitivement"
        danger
        onConfirmer={supprimerPV}
        onAnnuler={() => setSupprPV(false)}
      />
      <ConfirmDialog
        ouvert={!!docASuppr}
        titre="Supprimer le document ?"
        message={docASuppr?.nom ?? ''}
        texteConfirmer="Supprimer"
        danger
        onConfirmer={async () => {
          if (docASuppr?.id) await db.documents.delete(docASuppr.id)
          setDocASuppr(null)
          await recharger()
        }}
        onAnnuler={() => setDocASuppr(null)}
      />
    </div>
  )
}

function ChampInfo({ label, valeur }: { label: string; valeur?: string | null }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div>{valeur || '—'}</div>
    </div>
  )
}

function SupprPoint({ id, onDone }: { id: number; onDone: () => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button className="btn-danger !px-2 !py-1 !text-xs" onClick={() => setOuvert(true)}>Suppr.</button>
      <ConfirmDialog
        ouvert={ouvert}
        titre="Supprimer ce point de contrôle ?"
        message="Les photos associées à ce point resteront attachées au PV (déplacez-les avant si besoin)."
        texteConfirmer="Supprimer"
        danger
        onConfirmer={async () => {
          await db.points.delete(id)
          await db.photos.where('pointId').equals(id).modify({ pointId: null })
          setOuvert(false)
          await onDone()
        }}
        onAnnuler={() => setOuvert(false)}
      />
    </>
  )
}

function PointEditor({
  pvId,
  point,
  ordreMax,
  onFermer,
  onEnregistre
}: {
  pvId: number
  point: PointControle | null
  ordreMax: number
  onFermer: () => void
  onEnregistre: () => Promise<void>
}) {
  const [form, setForm] = useState({
    phase: point?.phase ?? PHASES_CONTROLE[0],
    designation: point?.designation ?? '',
    reference: point?.reference ?? '',
    resultat: point?.resultat ?? ('conforme' as ResultatControle),
    observation: point?.observation ?? ''
  })
  const [phasePerso, setPhasePerso] = useState(point?.phase && !(PHASES_CONTROLE as string[]).includes(point.phase) ? point.phase : '')
  const [erreur, setErreur] = useState('')

  const enregistrer = async () => {
    if (!form.designation.trim()) return setErreur('La désignation du point de contrôle est obligatoire.')
    const phase = form.phase === 'Autre' ? phasePerso.trim() || 'Autre' : form.phase
    const donnees = { pvId, ...form, phase, dateCreation: point?.dateCreation ?? Date.now() }
    if (point?.id) await db.points.update(point.id, { ...donnees, ordre: point.ordre })
    else await db.points.add({ ...donnees, ordre: ordreMax + 1 })
    await onEnregistre()
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFermer}>
      <div className="carte w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">{point ? 'Modifier le point de contrôle' : 'Nouveau point de contrôle'}</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Phase de contrôle</label>
            <select className="champ" value={form.phase} onChange={set('phase')}>
              {PHASES_CONTROLE.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {form.phase === 'Autre' && (
              <input className="champ mt-2" placeholder="Précisez la phase…" value={phasePerso} onChange={(e) => setPhasePerso(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label">Désignation du contrôle *</label>
            <input className="champ" value={form.designation} onChange={set('designation')} placeholder="Ex. : Adhérence de la membrane sur le support béton" />
          </div>
          <div>
            <label className="label">Référence / critère (référentiel)</label>
            <input className="champ" value={form.reference} onChange={set('reference')} placeholder="Ex. : DTU 43.1 §5.2, CCTG…" />
          </div>
          <div>
            <label className="label">Résultat</label>
            <div className="grid grid-cols-2 gap-2">
              {RESULTATS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={form.resultat === r.value ? 'btn-primaire' : 'btn-secondaire'}
                  onClick={() => setForm((f) => ({ ...f, resultat: r.value }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Observation</label>
            <textarea className="champ" rows={3} value={form.observation} onChange={set('observation')} placeholder={form.resultat === 'non_conforme' ? 'Décrire la non-conformité constatée…' : 'Commentaire éventuel…'} />
          </div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondaire" onClick={onFermer}>Annuler</button>
          <button className="btn-primaire" onClick={enregistrer}>Enregistrer</button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Date de saisie du point : {point?.dateCreation ? new Date(point.dateCreation).toLocaleString('fr-FR') : todayISO()}</p>
      </div>
    </div>
  )
}
