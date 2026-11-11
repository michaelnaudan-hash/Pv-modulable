import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import type { Chantier } from '../types'
import { formatDate } from '../lib/format'

export default function Chantiers() {
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [filtre, setFiltre] = useState('')
  const [archives, setArchives] = useState(false)
  const [nbPV, setNbPV] = useState<Record<number, number>>({})

  const recharger = async (voirArchives: boolean) => {
    const liste = await db.chantiers
      .where('archive')
      .equals(voirArchives ? 1 : 0)
      .sortBy('dateModification')
    liste.reverse()
    setChantiers(liste)
    const counts: Record<number, number> = {}
    for (const c of liste) {
      if (c.id != null) counts[c.id] = await db.pvs.where('chantierId').equals(c.id).count()
    }
    setNbPV(counts)
  }

  useEffect(() => {
    recharger(archives)
  }, [archives])

  const filtres = chantiers.filter(
    (c) =>
      !filtre ||
      c.nom.toLowerCase().includes(filtre.toLowerCase()) ||
      (c.numero ?? '').toLowerCase().includes(filtre.toLowerCase()) ||
      (c.localisation ?? '').toLowerCase().includes(filtre.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Chantiers</h1>
        <Link to="/chantiers/nouveau" className="btn-primaire">
          + Nouveau chantier
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="champ max-w-xs" placeholder="Rechercher (nom, n°, lieu)…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} className="h-4 w-4" />
          Voir les chantiers archivés
        </label>
      </div>

      {filtres.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          {archives ? 'Aucun chantier archivé.' : 'Aucun chantier actif. Créez votre premier chantier pour commencer un PV.'}
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtres.map((c) => (
            <Link key={c.id} to={`/chantiers/${c.id}`} className="carte p-4 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{c.nom}</div>
                  {c.numero && <div className="text-xs text-slate-500">N° {c.numero}</div>}
                </div>
                <span className="rounded-full bg-marque-100 text-marque-800 text-xs px-2 py-0.5 whitespace-nowrap">
                  {nbPV[c.id ?? -1] ?? 0} PV
                </span>
              </div>
              {c.localisation && <p className="mt-1 text-sm text-slate-600">📍 {c.localisation}</p>}
              {c.entreprise && <p className="text-sm text-slate-600">🏗 {c.entreprise}</p>}
              <p className="mt-2 text-xs text-slate-400">Modifié le {formatDate(c.dateModification)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
