import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import type { Chantier, PV } from '../types'
import { formatDate } from '../lib/format'
import { numeroPVParDefaut } from '../lib/format'
import { StatutBadge } from '../components/Badges'
import ConfirmDialog from '../components/ConfirmDialog'

export default function ChantierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [pvs, setPvs] = useState<PV[]>([])
  const [supprOuvert, setSupprOuvert] = useState(false)

  const recharger = async () => {
    const c = await db.chantiers.get(Number(id))
    setChantier(c ?? null)
    const liste = await db.pvs.where('chantierId').equals(Number(id)).sortBy('date')
    liste.reverse()
    setPvs(liste)
  }

  useEffect(() => {
    recharger()
  }, [id])

  const nouveauPV = async () => {
    const count = await db.pvs.where('chantierId').equals(Number(id)).count()
    const now = Date.now()
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const nid = await db.pvs.add({
      chantierId: Number(id),
      numero: numeroPVParDefaut(iso, count),
      date: iso,
      statut: 'brouillon',
      dateCreation: now,
      dateModification: now
    })
    navigate(`/pv/${nid}/editer`)
  }

  const supprimerChantier = async () => {
    const cid = Number(id)
    const idsPV = (await db.pvs.where('chantierId').equals(cid).toArray()).map((p) => p.id!)
    await db.transaction('rw', db.chantiers, db.pvs, db.points, db.photos, db.documents, async () => {
      await db.points.where('pvId').anyOf(idsPV).delete()
      await db.photos.where('pvId').anyOf(idsPV).delete()
      await db.documents.where('pvId').anyOf(idsPV).delete()
      await db.pvs.where('chantierId').equals(cid).delete()
      await db.chantiers.delete(cid)
    })
    navigate('/chantiers')
  }

  if (!chantier) return <p className="text-sm text-slate-500">Chargement…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/chantiers" className="btn-secondaire !px-3">
          ← Chantiers
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex-1 min-w-52">{chantier.nom}</h1>
        {chantier.archive && <span className="rounded-full bg-slate-200 text-slate-600 text-xs px-2 py-0.5">Archivé</span>}
        <Link to={`/chantiers/${id}/editer`} className="btn-secondaire">
          Modifier
        </Link>
        <button className="btn-danger" onClick={() => setSupprOuvert(true)}>
          Supprimer
        </button>
      </div>

      <div className="carte p-5 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Info label="Numéro" valeur={chantier.numero} />
        <Info label="Localisation" valeur={chantier.localisation} />
        <Info label="Maître d'ouvrage" valeur={chantier.maitreOuvrage} />
        <Info label="Maître d'œuvre" valeur={chantier.maitreOeuvre} />
        <Info label="Entreprise" valeur={chantier.entreprise} />
        <Info label="Créé le" valeur={formatDate(chantier.dateCreation)} />
        {chantier.description && (
          <div className="sm:col-span-2">
            <div className="label">Description</div>
            <p className="whitespace-pre-line">{chantier.description}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Procès-verbaux ({pvs.length})</h2>
        <button className="btn-primaire" onClick={nouveauPV}>
          + Nouveau PV
        </button>
      </div>

      {pvs.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Aucun PV sur ce chantier. Créez le premier contrôle.</p>
      ) : (
        <div className="carte divide-y divide-slate-100">
          {pvs.map((pv) => (
            <Link key={pv.id} to={`/pv/${pv.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-slate-50">
              <StatutBadge statut={pv.statut} />
              <span className="font-medium text-sm">PV n°{pv.numero}</span>
              <span className="text-sm text-slate-500 truncate max-w-64">{pv.objet || '—'}</span>
              {pv.controleur && <span className="text-xs text-slate-400">✍ {pv.controleur}</span>}
              <span className="ml-auto text-xs text-slate-400">{formatDate(pv.date)}</span>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        ouvert={supprOuvert}
        titre="Supprimer ce chantier ?"
        message={`Le chantier « ${chantier.nom} » et tous ses PV, points de contrôle, photos et documents seront supprimés définitivement du stockage local. Pensez d'abord à faire une sauvegarde.`}
        texteConfirmer="Supprimer définitivement"
        danger
        onConfirmer={supprimerChantier}
        onAnnuler={() => setSupprOuvert(false)}
      />
    </div>
  )
}

function Info({ label, valeur }: { label: string; valeur?: string | number | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{valeur || '—'}</div>
    </div>
  )
}
