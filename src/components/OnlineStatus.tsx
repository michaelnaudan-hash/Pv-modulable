import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export default function OnlineStatus() {
  const enLigne = useSyncExternalStore(subscribe, () => navigator.onLine)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        enLigne ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
      }`}
      title={
        enLigne
          ? 'En ligne - l\u2019application fonctionne aussi hors ligne après son premier chargement.'
          : 'Hors ligne - toutes les fonctionnalités restent disponibles (données stockées localement).'
      }
    >
      <span className={`h-2 w-2 rounded-full ${enLigne ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
      {enLigne ? 'En ligne' : 'Hors ligne'}
    </span>
  )
}
