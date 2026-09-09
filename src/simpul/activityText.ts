/**
 * Pembacaan teks laporan warga Community Maps — ATURAN TERBUKA, BUKAN LLM.
 *
 * PRD melarang LLM menghitung angka. Maka dua hal yang kami tarik dari teks
 * laporan dibaca dengan aturan kata kunci yang bisa diaudit siapa pun:
 *
 *   1. Keterangan keramaian yang ditulis surveyor ("ramai", "padat", "antre"
 *      vs "sepi", "lengang"). Kalau keduanya muncul atau tidak ada → netral.
 *   2. Jam pengamatan yang ditulis surveyor ("pukul 15.30", "jam 07:00").
 *      Ini lebih jujur daripada jam unggah, karena banyak surveyor mengunggah
 *      beberapa jam setelah turun lapangan.
 */

export type CrowdHint = 'ramai' | 'sepi' | 'netral'

const RAMAI_RE =
  /\b(ramai|padat|antre|antri|mengantre|mengantri|penuh|macet|sesak|berdesak\w*|membludak|kerumunan|banyak (orang|pengunjung|pembeli|penumpang|warga))\b/i
const SEPI_RE =
  /\b(sepi|kosong|lengang|sunyi|tidak ramai|tidak ada orang|sedikit orang|jarang (orang|pengunjung|penumpang))\b/i

export function classifyCrowd(text: string): CrowdHint {
  const ramai = RAMAI_RE.test(text)
  const sepi = SEPI_RE.test(text)
  if (ramai && !sepi) return 'ramai'
  if (sepi && !ramai) return 'sepi'
  return 'netral'
}

/** "pukul 15.30" / "jam 07:00" / "pukul 9 pagi" → jam 0–23; null kalau tidak ada. */
export function hourFromDescription(text: string): number | null {
  const m = text.match(/\b(?:pukul|jam)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam)?/i)
  if (!m) return null
  let h = Number(m[1])
  if (!Number.isFinite(h) || h > 24) return null
  if (h === 24) h = 0
  const suffix = m[3]?.toLowerCase()
  // "jam 3 sore" → 15; "jam 7 malam" → 19. Angka ≥ 13 sudah 24-jam, biarkan.
  if (suffix && h < 12 && (suffix === 'sore' || suffix === 'malam')) h += 12
  if (suffix === 'siang' && h < 10) h += 12
  return h
}

/** Jam WIB (UTC+7) dari stempel ISO. */
export function wibHour(iso: string): number | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor(((t / 1000 + 7 * 3600) % 86400) / 3600)
}
