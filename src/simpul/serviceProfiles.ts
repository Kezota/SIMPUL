import type { NodeKind } from '../lib/types'
import type { BlockId } from './timeblocks'

/**
 * Skor layanan transit per jenis simpul per blok waktu (0 = tidak ada layanan,
 * 1 = layanan sering).
 *
 * ⚠️ ANGKA PERKIRAAN UNTUK DEMO — diturunkan kasar dari jadwal publik:
 * KA Lokal Bandung Raya (Gapeka 2025, ±37 perjalanan/hari, layanan ±04.30–20.30),
 * Whoosh Padalarang, dan jam operasi umum terminal bus/Trans Metro Bandung.
 * Untuk versi kompetisi, ganti dengan jadwal resmi per stasiun (bisa dihitung
 * langsung dari Gapeka: jumlah keberangkatan per blok ÷ maksimum) dan
 * cantumkan sumbernya.
 */
export const SERVICE_PROFILE: Record<NodeKind, Record<BlockId, number>> = {
  stasiun: { pagi: 1.0, siang: 0.7, sore: 1.0, malam: 0.3, larut: 0 },
  krl: { pagi: 1.0, siang: 0.8, sore: 1.0, malam: 0.6, larut: 0.1 },
  kcic: { pagi: 0.8, siang: 0.8, sore: 0.8, malam: 0.5, larut: 0 },
  terminal: { pagi: 1.0, siang: 0.8, sore: 1.0, malam: 0.5, larut: 0.1 },
}

/**
 * Faktor jarak: seberapa terjangkau sebuah sel dari simpul terdekatnya.
 * <1 km = jangkauan jalan kaki penuh; 1–2 km = butuh sambungan; >2 km = tidak
 * terlayani (ambang yang sama dengan analisis di DATA-DAN-ANALISIS.md).
 */
export function distanceFactor(distanceM: number): number {
  if (distanceM <= 1000) return 1
  if (distanceM <= 2000) return 0.6
  return 0
}

/** Di bawah ambang ini sebuah sel dianggap "layanannya kurang" pada blok itu. */
export const SERVICE_LOW_THRESHOLD = 0.35
