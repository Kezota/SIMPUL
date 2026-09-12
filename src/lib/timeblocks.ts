/**
 * Blok waktu SIMPUL.
 *
 * Hari dibagi 5 blok (bukan per jam) karena data sample masih tipis, kalau
 * dipecah per jam, tiap sel isinya 0-1 pengamatan dan kesimpulannya bohong.
 * Blok bisa dipersempit setelah data penuh (API) tersedia.
 */

export type BlockId = 'pagi' | 'siang' | 'sore' | 'malam' | 'larut'

export interface TimeBlock {
  id: BlockId
  label: string
  range: string
  /** Jam awal (inklusif) dan akhir (eksklusif), 24 jam. */
  fromHour: number
  toHour: number
}

export const TIME_BLOCKS: TimeBlock[] = [
  { id: 'pagi', label: 'Pagi', range: '06–10', fromHour: 6, toHour: 10 },
  { id: 'siang', label: 'Siang', range: '10–14', fromHour: 10, toHour: 14 },
  { id: 'sore', label: 'Sore', range: '14–18', fromHour: 14, toHour: 18 },
  { id: 'malam', label: 'Malam', range: '18–22', fromHour: 18, toHour: 22 },
  { id: 'larut', label: 'Larut', range: '22–06', fromHour: 22, toHour: 6 },
]

export function blockOfHour(hour: number): BlockId {
  if (hour >= 6 && hour < 10) return 'pagi'
  if (hour >= 10 && hour < 14) return 'siang'
  if (hour >= 14 && hour < 18) return 'sore'
  if (hour >= 18 && hour < 22) return 'malam'
  return 'larut'
}

/** "12:58:00" -> 12. Null kalau tidak bisa dibaca. */
export function hourFromTimeString(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = s.match(/^(\d{1,2}):/)
  if (!m) return null
  const h = Number(m[1])
  return h >= 0 && h < 24 ? h : null
}

/**
 * Nama file media MAPID mengandung stempel waktu epoch milidetik, contoh:
 * ".../5c7e0e80..._1780968994582.jpg". Kami sudah memverifikasi angka ini
 * cocok dengan cap tanggal-jam yang tercetak di fotonya (WIB = UTC+7).
 */
export function hourFromMediaUrls(urls: unknown): number | null {
  if (!Array.isArray(urls)) return null
  for (const u of urls) {
    if (typeof u !== 'string') continue
    const m = u.match(/_(\d{13})[._]/)
    if (!m) continue
    const epochSec = Number(m[1]) / 1000
    const wibSec = epochSec + 7 * 3600
    return Math.floor((wibSec % 86400) / 3600)
  }
  return null
}
