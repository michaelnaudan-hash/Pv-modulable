import type { ResultatControle, StatutPV } from '../types'

const STATUTS: Record<StatutPV, { label: string; classe: string }> = {
  brouillon: { label: 'Brouillon', classe: 'bg-slate-200 text-slate-700' },
  valide: { label: 'Validé', classe: 'bg-emerald-100 text-emerald-700' },
  cloture: { label: 'Clôturé', classe: 'bg-marque-100 text-marque-800' }
}

const RESULTATS: Record<ResultatControle, { label: string; classe: string }> = {
  conforme: { label: 'Conforme', classe: 'bg-emerald-100 text-emerald-700' },
  non_conforme: { label: 'Non conforme', classe: 'bg-red-100 text-red-700 font-semibold' },
  reserve: { label: 'Réserve', classe: 'bg-amber-100 text-amber-800' },
  non_controle: { label: 'Non contrôlé', classe: 'bg-slate-200 text-slate-600' }
}

export function StatutBadge({ statut }: { statut: StatutPV }) {
  const s = STATUTS[statut]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.classe}`}>{s.label}</span>
}

export function ResultatBadge({ resultat }: { resultat: ResultatControle }) {
  const r = RESULTATS[resultat]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.classe}`}>{r.label}</span>
}
