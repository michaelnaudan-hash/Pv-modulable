export interface StockageInfo {
  quota: number
  usage: number
  pourcentage: number
  supporte: boolean
}

export async function estimerStockage(): Promise<StockageInfo> {
  if (navigator.storage && navigator.storage.estimate) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    return {
      quota,
      usage,
      pourcentage: quota > 0 ? Math.round((usage / quota) * 100) : 0,
      supporte: true
    }
  }
  return { quota: 0, usage: 0, pourcentage: 0, supporte: false }
}

export function alerteStockage(info: StockageInfo): boolean {
  return info.supporte && info.pourcentage >= 80
}
