import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, getParametres, saveParametres } from '../db'
import type { Chantier, Parametres, PV } from '../types'
import { formatDate, formatTaille } from '../lib/format'
import { estimerStockage, alerteStockage, type StockageInfo } from '../lib/stockage'
import { StatutBadge } from '../components/Badges'

export default function Dashboard() {
  const [stats, setStats] = useState({ chantiers: 0, pvs: 0, points: 0, nonConformites: 0, photos: 0, documents: 0 })
  const [derniers, setDerniers] = useState<(PV & { chantier?: Chantier })[]>([])
  const [parametres, setParametres] = useState<Parametres | null>(null)
  const [stockage, setStockage] = useState<StockageInfo | null>(null)

  useEffect(() => {
    ;(async () => {
      const [chantiers, pvs, points, photos, documents, p] = await Promise.all([
        db.chantiers.where('archive').equals(0).count(),
        db.pvs.count(),
        db.points.count(),
        db.photos.count(),
        db.documents.count(),
        getParametres()
      ])
      const nonConformites = await db.points.where('resultat').equals('non_conforme').count()
      setStats({ chantiers, pvs, points, nonConformites, photos, documents })
      const liste = await db.pvs.orderBy('dateModification').reverse().limit(6).toArray()
      const avecChantier = await Promise.all(
        liste.map(async (pv) => ({ ...pv, chantier: await db.chantiers.get(pv.chantierId) }))
      )
      setDerniers(avecChantier)
      setParametres(p)
      setStockage(await estimerStockage())
    })()
  }, [])

  const rappelEnRetard =
    parametres && (!parametres.derniereSauvegarde || Date.now() - parametres.derniereSauvegarde > parametres.rappelSauvegardeJours * 86400000)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500">
            {parametres?.nomEntreprise ? `Bienvenue — ${parametres.nomEntreprise}` : 'Bienvenue'} · aucune connexion requise, tout est stocké sur cet appareil.
          </p>
        </div>
        <Link to="/chantiers/nouveau" className="btn-primaire">
          + Nouveau chantier
        </Link>
      </div>

      {parametres && !parametres.avertissementSecuriteVu && (
        <div className="carte border-l-4 border-amber-400 bg-amber-50 p-4 flex flex-wrap gap-3 items-start justify-between">
          <p className="text-sm text-amber-900 flex-1 min-w-56">
            <strong>Avertissement :</strong> aucune authentification n'est utilisée. La sécurité de vos données dépend de la
            protection de cet appareil et de ce navigateur (code, biométrie, chiffrement du disque). Pensez à exporter
            régulièrement une sauvegarde.
          </p>
          <button
            className="btn-secondaire !bg-white"
            onClick={async () => {
              const p = await getParametres()
              p.avertissementSecuriteVu = true
              await saveParametres(p)
              setParametres(p)
            }}
          >
            J'ai compris
          </button>
        </div>
      )}

      {rappelEnRetard && (
        <div className="carte border-l-4 border-marque-500 bg-marque-50 p-4 flex flex-wrap gap-3 items-center justify-between">
          <p className="text-sm text-marque-900 flex-1 min-w-56">
            {parametres?.derniereSauvegarde
              ? `Dernière sauvegarde : il y a plus de ${parametres.rappelSauvegardeJours} jour(s).`
              : 'Aucune sauvegarde réalisée pour le moment.'}{' '}
            Le stockage du navigateur n'est pas une sauvegarde permanente : exportez vos données sur un support externe.
          </p>
          <Link to="/sauvegarde" className="btn-primaire">
            Faire une sauvegarde
          </Link>
        </div>
      )}

      {stockage && alerteStockage(stockage) && (
        <div className="carte border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            <strong>Stockage local bientôt insuffisant :</strong> {stockage.pourcentage} % du quota utilisé
            ({formatTaille(stockage.usage)} / {formatTaille(stockage.quota)}). Exportez une sauvegarde et supprimez des photos
            anciennes pour libérer de l'espace.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CarteStat titre="Chantiers actifs" valeur={stats.chantiers} lien="/chantiers" couleur="bg-marque-700" />
        <CarteStat titre="PV enregistrés" valeur={stats.pvs} lien="/chantiers" couleur="bg-indigo-600" />
        <CarteStat titre="Non-conformités" valeur={stats.nonConformites} couleur={stats.nonConformites > 0 ? 'bg-red-600' : 'bg-emerald-600'} />
        <CarteStat titre="Photos stockées" valeur={stats.photos} couleur="bg-sky-600" />
      </div>

      {stockage?.supporte && (
        <div className="carte p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Stockage local utilisé</span>
            <span>
              {formatTaille(stockage.usage)} / {formatTaille(stockage.quota)} ({stockage.pourcentage} %)
            </span>
          </div>
          <div className="h-2 rounded bg-slate-200 overflow-hidden">
            <div
              className={`h-full ${stockage.pourcentage >= 80 ? 'bg-red-500' : stockage.pourcentage >= 60 ? 'bg-amber-400' : 'bg-marque-600'}`}
              style={{ width: `${Math.min(100, stockage.pourcentage)}%` }}
            />
          </div>
        </div>
      )}

      <div className="carte p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Derniers PV modifiés</h2>
          <Link to="/chantiers" className="text-sm text-marque-700 hover:underline">
            Voir les chantiers →
          </Link>
        </div>
        {derniers.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Aucun PV pour le moment. Créez un chantier puis un procès-verbal de contrôle.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {derniers.map((pv) => (
              <li key={pv.id}>
                <Link to={`/pv/${pv.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <StatutBadge statut={pv.statut} />
                  <span className="font-medium text-sm text-slate-800">PV n°{pv.numero}</span>
                  <span className="text-sm text-slate-500 truncate">{pv.chantier?.nom}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDate(pv.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CarteStat({ titre, valeur, lien, couleur }: { titre: string; valeur: number; lien?: string; couleur: string }) {
  const contenu = (
    <div className="carte p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`h-11 w-11 rounded-lg ${couleur} text-white flex items-center justify-center text-xl font-bold shrink-0`}>
        {valeur}
      </div>
      <div className="text-sm font-medium text-slate-600">{titre}</div>
    </div>
  )
  return lien ? <Link to={lien}>{contenu}</Link> : contenu
}
