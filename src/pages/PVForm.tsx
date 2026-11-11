import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import type { PV, StatutPV } from '../types'
import { todayISO } from '../lib/format'

export default function PVForm() {
  const { id } = useParams()
  const edit = id !== undefined
  const [searchParams] = useSearchParams()
  const chantierIdParam = Number(searchParams.get('chantierId'))
  const navigate = useNavigate()

  const [form, setForm] = useState<Omit<PV, 'id' | 'dateCreation' | 'dateModification' | 'chantierId'>>({
    numero: '',
    date: todayISO(),
    objet: '',
    localisation: '',
    controleur: '',
    entrepriseControle: '',
    conditionsMeteo: '',
    observationsGenerales: '',
    statut: 'brouillon'
  })
  const [chantierId, setChantierId] = useState<number>(chantierIdParam)
  const [chantierNom, setChantierNom] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    ;(async () => {
      if (edit) {
        const pv = await db.pvs.get(Number(id))
        if (pv) {
          const { id: _i, chantierId: cId, dateCreation: _c, dateModification: _m, ...reste } = pv
          setForm(reste)
          setChantierId(cId)
          const c = await db.chantiers.get(cId)
          setChantierNom(c?.nom ?? '')
        }
      } else if (chantierIdParam) {
        const c = await db.chantiers.get(chantierIdParam)
        if (c) {
          setChantierNom(c.nom)
          setForm((f) => ({ ...f, localisation: c.localisation ?? f.localisation, entrepriseControle: c.entreprise ?? f.entrepriseControle }))
          const count = await db.pvs.count()
          setForm((f) => ({ ...f }))
          void count
        }
      }
    })()
  }, [id, chantierIdParam])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const enregistrer = async () => {
    if (!form.numero.trim()) return setErreur('Le numéro de PV est obligatoire.')
    if (!chantierId) return setErreur('Aucun chantier associé.')
    const now = Date.now()
    const doublon = await db.pvs
      .where('numero')
      .equals(form.numero.trim())
      .filter((p) => p.id !== Number(id))
      .count()
    if (doublon > 0) return setErreur(`Un PV porte déjà le numéro « ${form.numero.trim()} ».`)
    if (edit) {
      await db.pvs.update(Number(id), { ...form, chantierId, dateModification: now })
      navigate(`/pv/${id}`)
    } else {
      const nid = await db.pvs.add({ ...form, chantierId, dateCreation: now, dateModification: now })
      navigate(`/pv/${nid}`)
    }
  }

  const setStatut = (s: StatutPV) => setForm((f) => ({ ...f, statut: s }))

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to={edit ? `/pv/${id}` : '/chantiers'} className="btn-secondaire !px-3">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{edit ? 'Modifier le PV' : 'Nouveau procès-verbal'}</h1>
      </div>

      <div className="carte p-5 space-y-4">
        {chantierNom && (
          <p className="text-sm bg-marque-50 text-marque-900 rounded-lg px-3 py-2">
            Chantier : <strong>{chantierNom}</strong>
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Numéro de PV *</label>
            <input className="champ" value={form.numero} onChange={set('numero')} placeholder="PV-2025-001" />
          </div>
          <div>
            <label className="label">Date du contrôle *</label>
            <input type="date" className="champ" value={form.date} onChange={set('date')} />
          </div>
        </div>
        <div>
          <label className="label">Objet du contrôle</label>
          <input className="champ" value={form.objet} onChange={set('objet')} placeholder="Ex. : Contrôle de mise en œuvre de la membrane d'étanchéité, zone tablier aval" />
        </div>
        <div>
          <label className="label">Lieu précis du contrôle</label>
          <input className="champ" value={form.localisation} onChange={set('localisation')} placeholder="Ex. : travée P2-P3, rive droite" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Contrôleur / rédacteur du PV (traçabilité)</label>
            <input className="champ" value={form.controleur} onChange={set('controleur')} placeholder="Nom du responsable du contrôle" />
          </div>
          <div>
            <label className="label">Entreprise contrôlée</label>
            <input className="champ" value={form.entrepriseControle} onChange={set('entrepriseControle')} />
          </div>
        </div>
        <div>
          <label className="label">Conditions météorologiques</label>
          <input className="champ" value={form.conditionsMeteo} onChange={set('conditionsMeteo')} placeholder="Ex. : 18 °C, temps sec, vent faible" />
        </div>
        <div>
          <label className="label">Statut</label>
          <div className="flex gap-2">
            {(['brouillon', 'valide', 'cloture'] as StatutPV[]).map((s) => (
              <button
                key={s}
                type="button"
                className={form.statut === s ? 'btn-primaire' : 'btn-secondaire'}
                onClick={() => setStatut(s)}
              >
                {s === 'brouillon' ? 'Brouillon' : s === 'valide' ? 'Validé' : 'Clôturé'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Observations générales</label>
          <textarea className="champ" rows={4} value={form.observationsGenerales} onChange={set('observationsGenerales')} />
        </div>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondaire" onClick={() => navigate(-1)}>
            Annuler
          </button>
          <button className="btn-primaire" onClick={enregistrer}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
