export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso?: string | number | null): string {
  if (!iso) return '—'
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateHeure(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(2)} Mo`
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function numeroPVParDefaut(dateISO: string, count: number): string {
  const d = new Date(dateISO)
  const y = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
  return `PV-${y}-${String(count + 1).padStart(3, '0')}`
}

export function downloadBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function extensionDepuisType(type: string, nom: string): string {
  if (type === 'image/jpeg' || nom.toLowerCase().endsWith('.jpg')) return 'jpg'
  if (type === 'image/png' || nom.toLowerCase().endsWith('.png')) return 'png'
  if (type === 'image/webp' || nom.toLowerCase().endsWith('.webp')) return 'webp'
  if (type === 'application/pdf' || nom.toLowerCase().endsWith('.pdf')) return 'pdf'
  const m = nom.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'bin'
}
