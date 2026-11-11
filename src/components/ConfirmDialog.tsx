interface Props {
  ouvert: boolean
  titre: string
  message: string
  texteConfirmer?: string
  danger?: boolean
  enCours?: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}

export default function ConfirmDialog({ ouvert, titre, message, texteConfirmer = 'Confirmer', danger = false, enCours = false, onConfirmer, onAnnuler }: Props) {
  if (!ouvert) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={enCours ? undefined : onAnnuler}>
      <div className="carte w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900">{titre}</h2>
        <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondaire" onClick={onAnnuler} disabled={enCours}>
            Annuler
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primaire'} onClick={onConfirmer} disabled={enCours}>
            {enCours ? 'En cours…' : texteConfirmer}
          </button>
        </div>
      </div>
    </div>
  )
}
