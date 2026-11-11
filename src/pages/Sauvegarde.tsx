import { useEffect, useRef, useState } from 'react'
import { getParametres, saveParametres } from '../db'
import { exporterSauvegarde, importerSauvegarde, type ModeRestauration, type RapportImport } from '../lib/backup'
import { downloadBlob, formatDateHeure } from '../lib/format'
import type { Parametres } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Sauvegarde() {
  const [parametres, setParametres] = useState<Parametres | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null)
  const [rapport, setRapport] = useState<RapportImport | null>(null)
  const [mode, setMode] = useState<ModeRestauration>('fusion')
  const [confirmerRemplacer, setConfirmerRemplacer] = useState(false)
  const inputZip = useRef<HTMLInputElement>(null)
  const fichierEnAttente = useRef<File | null>(null)

  useEffect(() => {
    getParametres().then(setParametres)
  }, [])

  const faireExport = async () => {
    setEnCours(true)
    setMessage(null)
    try {
      const { blob, nom } = await exporterSauvegarde()
      downloadBlob(blob, nom)
      const p = await getParametres()
      p.derniereSauvegarde = Date.now()
      await saveParametres(p)
      setParametres(p)
      setMessage({ texte: `Sauvegarde exportée : ${nom}`, ok: true })
    } catch (e) {
      setMessage({ texte: `Échec de l'export : ${e instanceof Error ? e.message : String(e)}`, ok: false })
    } finally {
      setEnCours(false)
    }
  }

  const lancerImport = async (modeChoisi: ModeRestauration) => {
    const f = fichierEnAttente.current
    if (!f) return
    setEnCours(true)
    setMessage(null)
    setRapport(null)
    try {
      const r = await importerSauvegarde(f, modeChoisi)
      setRapport(r)
      if (r.ok) {
        setMessage({
          texte: `Restauration réussie (${r.mode === 'fusion' ? 'fusion' : 'remplacement'}). ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`,
          ok: true
        })
      } else {
        setMessage({ texte: `Restauration refusée : intégrité non vérifiée ou archive invalide (${r.erreurs.length} problème(s)). Aucune donnée n'a été modifiée.`, ok: false })
      }
    } catch (e) {
      setMessage({ texte: `Erreur : ${e instanceof Error ? e.message : String(e)}`, ok: false })
    } finally {
      setEnCours(false)
      setConfirmerRemplacer(false)
      fichierEnAttente.current = null
      if (inputZip.current) inputZip.current.value = ''
    }
  }

  const onFichier = (f: File | undefined) => {
    if (!f) return
    fichierEnAttente.current = f
    setRapport(null)
    if (mode === 'remplacer') setConfirmerRemplacer(true)
    else lancerImport('fusion')
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Sauvegarde & restauration</h1>

      <div className="carte p-5 space-y-3">
        <h2 className="font-bold text-slate-900">1. Exporter une sauvegarde complète</h2>
        <p className="text-sm text-slate-600">
          Exporte <strong>toutes</strong> les données locales (chantiers, PV, points de contrôle, photos, documents joints, paramètres)
          dans un fichier <strong>ZIP structuré</strong> : <code>manifest.json</code> (empreintes SHA-256 de chaque fichier pour vérifier
          l'intégrité), <code>data.json</code> (données) et <code>files/</code> (photos et documents binaires). Ce fichier peut être
          conservé sur un support externe ou restauré sur un autre appareil.
        </p>
        <button className="btn-primaire" onClick={faireExport} disabled={enCours}>
          {enCours ? 'Export en cours…' : '⬇ Exporter la sauvegarde (.zip)'}
        </button>
        {parametres?.derniereSauvegarde && (
          <p className="text-xs text-slate-500">Dernière sauvegarde : {formatDateHeure(parametres.derniereSauvegarde)}</p>
        )}
      </div>

      <div className="carte p-5 space-y-3">
        <h2 className="font-bold text-slate-900">2. Restaurer depuis une sauvegarde</h2>
        <p className="text-sm text-slate-600">
          L'intégrité de l'archive est <strong>vérifiée avant toute écriture</strong> (checksum SHA-256). En cas d'incohérence, rien
          n'est modifié.
        </p>
        <div className="space-y-2">
          <label className="label">Mode de restauration</label>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="mode" className="mt-1" checked={mode === 'fusion'} onChange={() => setMode('fusion')} />
              <span>
                <strong>Fusionner</strong> (recommandé) : ajoute ou met à jour les éléments de la sauvegarde sans toucher au reste.
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="mode" className="mt-1" checked={mode === 'remplacer'} onChange={() => setMode('remplacer')} />
              <span>
                <strong>Remplacer tout</strong> : efface les données actuelles puis restaure la sauvegarde (protection contre
                l'écrasement accidentel : confirmation requise).
              </span>
            </label>
          </div>
        </div>
        <button className="btn-secondaire" onClick={() => inputZip.current?.click()} disabled={enCours}>
          {enCours ? 'Traitement…' : '📁 Choisir un fichier .zip…'}
        </button>
        <input ref={inputZip} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFichier(e.target.files?.[0])} />
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {message.texte}
        </div>
      )}

      {rapport && !rapport.ok && (
        <div className="carte p-4 border-l-4 border-red-400">
          <p className="font-semibold text-red-700 text-sm">Problèmes détectés dans l'archive :</p>
          <ul className="list-disc list-inside text-sm text-red-700 mt-1">
            {rapport.erreurs.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="carte p-5 text-sm text-slate-600 space-y-2">
        <h2 className="font-bold text-slate-900">Bonnes pratiques</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Le stockage du navigateur n'est <strong>pas une sauvegarde permanente</strong> : exportez régulièrement un ZIP sur un support externe (clé USB, disque réseau, autre ordinateur).</li>
          <li>Les mises à jour de l'application <strong>n'effacent jamais</strong> vos données ; la structure des données est versionnée et migrée automatiquement.</li>
          <li>Après un changement d'ordinateur, restaurez simplement le fichier ZIP depuis la page « Sauvegarde » de la nouvelle installation.</li>
        </ul>
      </div>

      <ConfirmDialog
        ouvert={confirmerRemplacer}
        titre="Remplacer TOUTES les données actuelles ?"
        message={
          fichierEnAttente.current
            ? `Le fichier « ${fichierEnAttente.current.name} » va écraser l'intégralité des données actuellement stockées dans ce navigateur. Cette action est irréversible sans sauvegarde préalable.`
            : ''
        }
        texteConfirmer="Oui, remplacer tout"
        danger
        enCours={enCours}
        onConfirmer={() => lancerImport('remplacer')}
        onAnnuler={() => {
          setConfirmerRemplacer(false)
          fichierEnAttente.current = null
          if (inputZip.current) inputZip.current.value = ''
        }}
      />
    </div>
  )
}
