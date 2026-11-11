import { useEffect, useRef, useState } from 'react'
import { db, getParametres, saveParametres } from '../db'
import type { Parametres } from '../types'
import { blobEnDataURL } from '../lib/photos'
import ConfirmDialog from '../components/ConfirmDialog'

export default function ParametresPage() {
  const [p, setP] = useState<Parametres | null>(null)
  const [message, setMessage] = useState('')
  const [effacerOuvert, setEffacerOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const inputLogo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getParametres().then(setP)
  }, [])

  const set = <K extends keyof Parametres>(k: K, v: Parametres[K]) => setP((x) => (x ? { ...x, [k]: v } : x))
  const setCharte = (k: keyof Parametres['charte'], v: string) =>
    setP((x) => (x ? { ...x, charte: { ...x.charte, [k]: v } } : x))

  const enregistrer = async () => {
    if (!p) return
    await saveParametres(p)
    setMessage('Paramètres enregistrés localement.')
    setTimeout(() => setMessage(''), 4000)
  }

  const chargerLogo = async (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return
    // Redimensionne le logo pour alléger le stockage et les documents générés
    const dataUrl = await blobEnDataURL(f)
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('image illisible'))
      img.src = dataUrl
    })
    const max = 400
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * ratio)
    canvas.height = Math.round(img.naturalHeight * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const petit = canvas.toDataURL('image/png')
    set('logo', petit)
    setMessage("Logo chargé (redimensionné). N'oubliez pas d'enregistrer.")
  }

  const effacerTout = async () => {
    setEnCours(true)
    await db.transaction('rw', [db.chantiers, db.pvs, db.points, db.photos, db.documents, db.parametres], async () => {
      await Promise.all([db.chantiers.clear(), db.pvs.clear(), db.points.clear(), db.photos.clear(), db.documents.clear()])
      await db.parametres.clear()
    })
    setEnCours(false)
    setEffacerOuvert(false)
    setP(await getParametres())
    setMessage('Toutes les données locales ont été effacées.')
  }

  if (!p) return <p className="text-sm text-slate-500">Chargement…</p>

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>

      <div className="carte p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Identité de l'émetteur (charte graphique)</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nom de l'entreprise / organisme</label>
            <input className="champ" value={p.nomEntreprise ?? ''} onChange={(e) => set('nomEntreprise', e.target.value)} />
          </div>
          <div>
            <label className="label">SIRET</label>
            <input className="champ" value={p.siret ?? ''} onChange={(e) => set('siret', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Adresse</label>
          <input className="champ" value={p.adresseEntreprise ?? ''} onChange={(e) => set('adresseEntreprise', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Téléphone</label>
            <input className="champ" value={p.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="champ" type="email" value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Logo (apparaît en en-tête des PV)</label>
          <div className="flex items-center gap-3">
            {p.logo && <img src={p.logo} alt="Logo" className="h-14 w-auto border border-slate-200 rounded bg-white p-1" />}
            <button className="btn-secondaire" onClick={() => inputLogo.current?.click()}>{p.logo ? 'Changer le logo' : 'Choisir un logo'}</button>
            {p.logo && (
              <button className="btn-danger !px-3 !py-1.5 !text-xs" onClick={() => set('logo', undefined)}>Retirer</button>
            )}
            <input ref={inputLogo} type="file" accept="image/*" className="hidden" onChange={(e) => chargerLogo(e.target.files?.[0])} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Couleur primaire</label>
            <input type="color" className="champ h-10 p-1" value={p.charte.couleurPrimaire} onChange={(e) => setCharte('couleurPrimaire', e.target.value)} />
          </div>
          <div>
            <label className="label">Couleur secondaire</label>
            <input type="color" className="champ h-10 p-1" value={p.charte.couleurSecondaire} onChange={(e) => setCharte('couleurSecondaire', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Pied de page des documents</label>
          <input className="champ" value={p.piedDePage ?? ''} onChange={(e) => set('piedDePage', e.target.value)} />
        </div>
      </div>

      <div className="carte p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Sauvegarde</h2>
        <div>
          <label className="label">Rappel de sauvegarde tous les (jours)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="champ max-w-32"
            value={p.rappelSauvegardeJours}
            onChange={(e) => set('rappelSauvegardeJours', Math.max(1, Number(e.target.value) || 7))}
          />
          <p className="text-xs text-slate-500 mt-1">
            Dernière sauvegarde : {p.derniereSauvegarde ? new Date(p.derniereSauvegarde).toLocaleString('fr-FR') : 'jamais'}.
          </p>
        </div>
      </div>

      <div className="carte p-5 space-y-3 border-l-4 border-amber-400">
        <h2 className="font-bold text-slate-900">Sécurité et confidentialité</h2>
        <p className="text-sm text-slate-600">
          L'application n'utilise <strong>aucune authentification</strong> et <strong>aucun serveur distant</strong> : toutes les
          données (PV, photos, documents) restent stockées localement dans ce navigateur. La sécurité des informations dépend donc
          de la protection de cet appareil (code d'accès, chiffrement, mises à jour). Le stockage du navigateur peut être vidé par
          le système : réalisez des <strong>sauvegardes régulières</strong> sur un support externe depuis la page « Sauvegarde ».
        </p>
      </div>

      <div className="carte p-5 space-y-3 border-l-4 border-red-400">
        <h2 className="font-bold text-red-700">Zone dangereuse</h2>
        <p className="text-sm text-slate-600">
          Efface <strong>toutes</strong> les données stockées localement (chantiers, PV, photos, documents, paramètres). Action
          irréversible : exportez d'abord une sauvegarde.
        </p>
        <button className="btn-danger" onClick={() => setEffacerOuvert(true)}>Effacer toutes les données locales…</button>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primaire" onClick={enregistrer}>Enregistrer les paramètres</button>
        {message && <span className="text-sm text-emerald-600">{message}</span>}
      </div>

      <ConfirmDialog
        ouvert={effacerOuvert}
        titre="Effacer TOUTES les données locales ?"
        message={'Cette action supprime définitivement tous les chantiers, PV, points de contrôle, photos et documents stockés dans ce navigateur. Exportez une sauvegarde avant si vous souhaitez conserver ces données.'}
        texteConfirmer="Oui, tout effacer"
        danger
        enCours={enCours}
        onConfirmer={effacerTout}
        onAnnuler={() => setEffacerOuvert(false)}
      />
    </div>
  )
}
