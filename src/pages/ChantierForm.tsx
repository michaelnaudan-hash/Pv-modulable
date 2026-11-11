import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { db } from '../db'
import type { Chantier } from '../types'

export default function ChantierForm() {
  const { id } = useParams()
  const edit = id !== undefined && id !== 'nouveau'
  const navigate = useNavigate()
  const [form, setForm] = useState<Omit<Chantier, 'id' | 'dateCreation' | 'dateModification'>>({
    nom: '',
    numero: '',
    localisation: '',
    maitreOuvrage: '',
    maitreOeuvre: '',
    entreprise: '',
    description: '',
    archive: false
  })
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (edit) {
      ;(async () => {
        const c = await db.chantiers.get(Number(id))
        if (c) {
          const { id: _i, dateCreation: _c, dateModification: _m, ...reste } = c
          setForm(reste)
        }
      })()
    }
  }, [id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const enregistrer = async () => {
    if (!form.nom.trim()) {
      setErreur('Le nom du chantier est obligatoire.')
      return
    }
    const now = Date.now()
    if (edit) {
      await db.chantiers.update(Number(id), { ...form, dateModification: now })
      navigate(`/chantiers/${id}`)
    } else {
      const nid = await db.chantiers.add({ ...form, dateCreation: now, dateModification: now })
      navigate(`/chantiers/${nid}`)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to={edit ? `/chantiers/${id}` : '/chantiers'} className="btn-secondaire !px-3">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{edit ? 'Modifier le chantier' : 'Nouveau chantier'}</h1>
      </div>

      <div className="carte p-5 space-y-4">
        <div>
          <label className="label">Nom du chantier *</label>
          <input className="champ" value={form.nom} onChange={set('nom')} placeholder="Ex. : Pont-route de la vallée de l'Arc - tablier" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Numéro / référence</label>
            <input className="champ" value={form.numero} onChange={set('numero')} placeholder="Ex. : OA-2024-017" />
          </div>
          <div>
            <label className="label">Localisation</label>
            <input className="champ" value={form.localisation} onChange={set('localisation')} placeholder="Ville, PK, département…" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Maître d'ouvrage</label>
            <input className="champ" value={form.maitreOuvrage} onChange={set('maitreOuvrage')} />
          </div>
          <div>
            <label className="label">Maître d'œuvre</label>
            <input className="champ" value={form.maitreOeuvre} onChange={set('maitreOeuvre')} />
          </div>
        </div>
        <div>
          <label className="label">Entreprise réalisant l'étanchéité</label>
          <input className="champ" value={form.entreprise} onChange={set('entreprise')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="champ" rows={3} value={form.description} onChange={set('description')} />
        </div>
        {edit && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.archive} onChange={set('archive')} className="h-4 w-4" />
            Archiver ce chantier (il reste consultable et ses PV sont conservés)
          </label>
        )}
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
