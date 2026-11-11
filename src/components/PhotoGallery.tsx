import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { PHASES_CONTROLE, type Photo, type PointControle } from '../types'
import { compresserImage } from '../lib/photos'
import { formatDateHeure, formatTaille } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  pvId: number
  points: PointControle[]
}

export default function PhotoGallery({ pvId, points }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<Photo | null>(null)
  const [pointSel, setPointSel] = useState<string>('')
  const [phaseSel, setPhaseSel] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const inputRemplacer = useRef<HTMLInputElement>(null)
  const [remplacerId, setRemplacerId] = useState<number | null>(null)

  const recharger = async () => {
    const liste = await db.photos.where('pvId').equals(pvId).sortBy('dateAjout')
    setPhotos(liste)
  }

  useEffect(() => {
    recharger()
  }, [pvId])

  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return
    setEnCours(true)
    setMessage(null)
    try {
      for (let i = 0; i < fichiers.length; i++) {
        const f = fichiers[i]
        if (!f.type.startsWith('image/')) continue
        const c = await compresserImage(f)
        await db.photos.add({
          pvId,
          pointId: pointSel ? Number(pointSel) : null,
          phase: phaseSel || undefined,
          legende: '',
          nom: f.name,
          type: c.blob.type,
          taille: c.taille,
          largeur: c.largeur,
          hauteur: c.hauteur,
          blob: c.blob,
          dateAjout: Date.now() + i
        })
      }
      setMessage(`${fichiers.length} photo(s) ajoutée(s) (compressée(s) pour limiter l'espace occupé).`)
      await recharger()
    } catch (e) {
      setMessage(`Erreur lors de l'ajout : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setEnCours(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remplacer = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0 || remplacerId == null) return
    setEnCours(true)
    try {
      const f = fichiers[0]
      const c = await compresserImage(f)
      await db.photos.update(remplacerId, {
        blob: c.blob,
        type: c.blob.type,
        taille: c.taille,
        largeur: c.largeur,
        hauteur: c.hauteur,
        nom: f.name,
        dateAjout: Date.now()
      })
      await recharger()
      setMessage('Photo remplacée.')
    } catch (e) {
      setMessage(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setEnCours(false)
      setRemplacerId(null)
      if (inputRemplacer.current) inputRemplacer.current.value = ''
    }
  }

  const confirmerSuppression = async () => {
    if (!aSupprimer?.id) return
    await db.photos.delete(aSupprimer.id)
    setASupprimer(null)
    await recharger()
  }

  const maj = async (id: number, patch: Partial<Photo>) => {
    await db.photos.update(id, patch)
    await recharger()
  }

  return (
    <div>
      <div className="carte p-4 mb-4">
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="label">Associer à un point de contrôle (facultatif)</label>
            <select className="champ" value={pointSel} onChange={(e) => setPointSel(e.target.value)}>
              <option value="">— PV entier —</option>
              {points.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Point n°{i + 1} — {p.designation.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Phase de contrôle</label>
            <select className="champ" value={phaseSel} onChange={(e) => setPhaseSel(e.target.value)}>
              <option value="">— Aucune —</option>
              {PHASES_CONTROLE.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <button className="btn-primaire w-full" onClick={() => inputRef.current?.click()} disabled={enCours}>
              {enCours ? 'Ajout en cours…' : '📷 Ajouter des photos'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => ajouter(e.target.files)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fonctionne hors ligne. Sur smartphone/tablette, la caméra s'ouvre directement. Les images sont compressées
          automatiquement (max 1600 px, JPEG 82 %) pour limiter l'espace occupé tout en gardant une qualité suffisante pour le rapport.
        </p>
        {message && <p className="mt-2 text-sm text-marque-700">{message}</p>}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Aucune photo pour ce PV.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((p, i) => (
            <PhotoCarte
              key={p.id}
              photo={p}
              index={i}
              points={points}
              onLegende={(legende) => p.id && maj(p.id, { legende })}
              onPoint={(pointId) => p.id && maj(p.id, { pointId })}
              onPhase={(phase) => p.id && maj(p.id, { phase })}
              onRemplacer={() => {
                setRemplacerId(p.id ?? null)
                inputRemplacer.current?.click()
              }}
              onSupprimer={() => setASupprimer(p)}
            />
          ))}
        </div>
      )}

      <input
        ref={inputRemplacer}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => remplacer(e.target.files)}
      />

      <ConfirmDialog
        ouvert={!!aSupprimer}
        titre="Supprimer la photo ?"
        message={`La photo « ${aSupprimer?.legende || aSupprimer?.nom || ''} » sera définitivement supprimée du stockage local.`}
        texteConfirmer="Supprimer"
        danger
        onConfirmer={confirmerSuppression}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  )
}

function PhotoCarte({
  photo,
  index,
  points,
  onLegende,
  onPoint,
  onPhase,
  onRemplacer,
  onSupprimer
}: {
  photo: Photo
  index: number
  points: PointControle[]
  onLegende: (l: string) => void
  onPoint: (id: number | null) => void
  onPhase: (p: string) => void
  onRemplacer: () => void
  onSupprimer: () => void
}) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])

  const point = photo.pointId ? points.find((p) => p.id === photo.pointId) : undefined
  const numPoint = point ? points.indexOf(point) + 1 : null

  return (
    <div className="carte overflow-hidden flex flex-col">
      <div className="relative bg-slate-900">
        {url && <img src={url} alt={photo.legende || photo.nom} className="w-full h-40 object-cover" />}
        <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs rounded px-1.5 py-0.5">Photo {index + 1}</span>
      </div>
      <div className="p-2 space-y-1.5 flex-1 flex flex-col">
        <input
          className="champ !py-1 text-xs"
          placeholder="Légende…"
          defaultValue={photo.legende ?? ''}
          onBlur={(e) => e.target.value !== (photo.legende ?? '') && onLegende(e.target.value)}
        />
        <select
          className="champ !py-1 text-xs"
          value={photo.pointId ?? ''}
          onChange={(e) => onPoint(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— PV entier —</option>
          {points.map((p, i) => (
            <option key={p.id} value={p.id}>
              Point n°{i + 1}
            </option>
          ))}
        </select>
        <select className="champ !py-1 text-xs" value={photo.phase ?? ''} onChange={(e) => onPhase(e.target.value)}>
          <option value="">— Phase —</option>
          {PHASES_CONTROLE.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <div className="text-[11px] text-slate-400">
          {formatTaille(photo.taille)} · {photo.largeur}×{photo.hauteur}px · {formatDateHeure(photo.dateAjout)}
          {numPoint ? ` · point n°${numPoint}` : ''}
        </div>
        <div className="flex gap-1 mt-auto pt-1">
          <button className="btn-secondaire !px-2 !py-1 !text-xs flex-1" onClick={onRemplacer}>
            Remplacer
          </button>
          <button className="btn-danger !px-2 !py-1 !text-xs flex-1" onClick={onSupprimer}>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
