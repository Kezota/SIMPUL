/**
 * Data transit Jabodetabek — SEMUA dari sumber nyata:
 *
 *  - Stasiun KRL/MRT/LRT + keanggotaan lintas : OpenStreetMap, relasi
 *    route=train|subway|light_rail (network KAI Commuter, MRT Jakarta,
 *    LRT Jakarta, Jabodebek LRT), diunduh 9 Sep 2026 → stationsJabodetabek.json
 *  - Halte & keberangkatan TransJakarta/JakLingko : GTFS resmi
 *    https://gtfs.transjakarta.co.id/files/file_gtfs.zip (file tertanggal
 *    24 Jul 2026, diunduh 9 Sep 2026). Keberangkatan per halte per blok waktu
 *    dihitung dari frequencies.txt (hari kerja) → tjStops.json
 *  - Jumlah perjalanan KRL per lintas : Gapeka 2025 (berlaku 1 Feb 2025) untuk
 *    Bogor/Cikarang/Rangkasbitung; Gapeka 2023 untuk Tangerang, Tanjung Priok,
 *    Bandara (angka 2025 per lintas tidak dipublikasikan). MRT/LRT dari headway
 *    resmi yang diumumkan operator.
 *
 * Yang MASIH perkiraan (dan ditulis terbuka): pembagian perjalanan harian KRL ke
 * blok waktu memakai bobot headway sibuk/non-sibuk, karena timetable per
 * stasiun belum diperoleh dalam bentuk data terbuka. Lihat PERHITUNGAN.md.
 */

import stationsRaw from '../data/stationsJabodetabek.json' with { type: 'json' }
import tjStopsRaw from '../data/tjStops.json' with { type: 'json' }
import type { NodeKind, TransitNode } from '../lib/types'
import { TIME_BLOCKS, type BlockId } from './timeblocks'

/* ── Profil lintas rel ───────────────────────────────────────────────────── */

interface LineProfile {
  name: string
  /** Total perjalanan per hari, DUA ARAH. */
  tripsPerDay: number
  firstHour: number
  lastHour: number
  /** Headway (menit) jam sibuk (06–09, 16–19) dan di luar itu. */
  peakHeadway: number
  offHeadway: number
  source: string
}

export const LINE_PROFILES: Record<string, LineProfile> = {
  B: { name: 'Lin Bogor', tripsPerDay: 392, firstHour: 4, lastHour: 23.2, peakHeadway: 5, offHeadway: 10, source: 'Gapeka 2025 (KAI Commuter, 1 Feb 2025)' },
  C: { name: 'Lin Lingkar Cikarang', tripsPerDay: 281, firstHour: 4.2, lastHour: 23.8, peakHeadway: 10, offHeadway: 20, source: 'Gapeka 2025 (KAI Commuter, 1 Feb 2025)' },
  R: { name: 'Lin Rangkasbitung', tripsPerDay: 204, firstHour: 4, lastHour: 23.3, peakHeadway: 10, offHeadway: 20, source: 'Gapeka 2025 (KAI Commuter, 1 Feb 2025)' },
  T: { name: 'Lin Tangerang', tripsPerDay: 124, firstHour: 4.4, lastHour: 23.8, peakHeadway: 12, offHeadway: 20, source: 'Gapeka 2023 (DJKA) — angka 2025 per lintas tidak dipublikasikan' },
  TP: { name: 'Lin Tanjung Priuk', tripsPerDay: 86, firstHour: 5.5, lastHour: 21, peakHeadway: 30, offHeadway: 30, source: 'Gapeka 2023 (DJKA)' },
  A: { name: 'Lin Bandara Soekarno-Hatta', tripsPerDay: 56, firstHour: 5, lastHour: 23, peakHeadway: 30, offHeadway: 30, source: 'Gapeka 2023 (DJKA)' },
  LW: { name: 'Commuter Line Walahar', tripsPerDay: 8, firstHour: 5, lastHour: 20, peakHeadway: 120, offHeadway: 120, source: 'Perkiraan dari jadwal publik KA lokal' },
  M: { name: 'MRT Lin Utara–Selatan', tripsPerDay: 276, firstHour: 5, lastHour: 24, peakHeadway: 5, offHeadway: 10, source: 'Headway resmi MRT Jakarta (5 mnt sibuk / 10 mnt non-sibuk, 05.00–24.00)' },
  S: { name: 'LRT Jakarta Lin Selatan', tripsPerDay: 210, firstHour: 5.5, lastHour: 23, peakHeadway: 10, offHeadway: 10, source: 'Headway resmi LRT Jakarta (10 mnt)' },
  CB: { name: 'LRT Jabodebek Lin Cibubur', tripsPerDay: 199, firstHour: 5, lastHour: 23, peakHeadway: 8, offHeadway: 12, source: 'KAI, 1 Jul 2025: 398 perjalanan/hari kerja dua lin (dibagi rata)' },
  BK: { name: 'LRT Jabodebek Lin Bekasi', tripsPerDay: 199, firstHour: 5, lastHour: 23, peakHeadway: 8, offHeadway: 12, source: 'KAI, 1 Jul 2025: 398 perjalanan/hari kerja dua lin (dibagi rata)' },
}

const isPeak = (h: number) => (h >= 6 && h < 9) || (h >= 16 && h < 19)

/**
 * Bagi perjalanan harian sebuah lintas ke 5 blok waktu.
 * Bobot tiap jam = 1/headway (lebih sering di jam sibuk), hanya di dalam jam
 * operasi; lalu dinormalisasi supaya totalnya = tripsPerDay.
 */
export function lineDeparturesByBlock(line: LineProfile): Record<BlockId, number> {
  const weights: number[] = []
  for (let h = 0; h < 24; h++) {
    const inService =
      line.lastHour > 24
        ? h >= line.firstHour || h < line.lastHour - 24
        : h >= line.firstHour && h < line.lastHour
    weights.push(inService ? 1 / (isPeak(h) ? line.peakHeadway : line.offHeadway) : 0)
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const out = { pagi: 0, siang: 0, sore: 0, malam: 0, larut: 0 } as Record<BlockId, number>
  weights.forEach((w, h) => {
    const b = TIME_BLOCKS.find((tb) =>
      tb.id === 'larut' ? h >= 22 || h < 6 : h >= tb.fromHour && h < tb.toHour,
    )!
    out[b.id] += (w / sum) * line.tripsPerDay
  })
  for (const k of Object.keys(out) as BlockId[]) out[k] = Math.round(out[k])
  return out
}

/* ── Stasiun rel Jabodetabek → TransitNode ───────────────────────────────── */

interface StationRow {
  id: string
  name: string
  kind: 'krl' | 'mrt' | 'lrt' | 'lrt_jabodebek'
  lines: string[]
  lat: number
  lon: number
  network: string
}

const KIND_LABEL: Record<string, string> = {
  krl: 'Stasiun',
  mrt: 'Stasiun MRT',
  lrt: 'Stasiun LRT',
  lrt_jabodebek: 'Stasiun LRT',
}

export function loadJabodetabekNodes(): TransitNode[] {
  return (stationsRaw as StationRow[]).map((s) => {
    const dep = { pagi: 0, siang: 0, sore: 0, malam: 0, larut: 0 } as Record<BlockId, number>
    const sources = new Set<string>()
    for (const l of s.lines) {
      const prof = LINE_PROFILES[l]
      if (!prof) continue
      const d = lineDeparturesByBlock(prof)
      for (const b of TIME_BLOCKS) dep[b.id] += d[b.id]
      sources.add(prof.source)
    }
    return {
      id: s.id,
      name: `${KIND_LABEL[s.kind] ?? 'Stasiun'} ${s.name}`,
      kind: s.kind as NodeKind,
      region: 'jabodetabek',
      lat: s.lat,
      lon: s.lon,
      serviceRadiusM: 1000,
      lines: s.lines,
      depByBlock: dep,
      scheduleSource: [...sources].join(' · ') || 'Lintas tidak dikenali',
    }
  })
}

/* ── Halte TransJakarta / JakLingko dari GTFS ────────────────────────────── */

export interface BusStop {
  id: string
  name: string
  lat: number
  lon: number
  /** Keberangkatan hari kerja per blok [pagi, siang, sore, malam, larut]. */
  dep: Record<BlockId, number>
  /** Dilayani rute JAK (Mikrotrans/JakLingko). */
  jak: boolean
}

interface TjRow { id: string; n: string; lat: number; lon: number; d: number[]; jak: number }

export const TJ_STOPS: BusStop[] = (tjStopsRaw as TjRow[]).map((r) => ({
  id: r.id,
  name: r.n,
  lat: r.lat,
  lon: r.lon,
  dep: { pagi: r.d[0], siang: r.d[1], sore: r.d[2], malam: r.d[3], larut: r.d[4] },
  jak: r.jak === 1,
}))

export const TJ_GTFS_SOURCE =
  'GTFS resmi TransJakarta (gtfs.transjakarta.co.id, file 24 Jul 2026, diunduh 9 Sep 2026), hari kerja'

/* ── Indeks spasial sederhana untuk pencarian tetangga terdekat ──────────── */

const CELL_DEG = 0.01 // ≈1,1 km

export class PointIndex<T extends { lat: number; lon: number }> {
  private buckets = new Map<string, T[]>()
  private items: T[]
  constructor(items: T[]) {
    this.items = items
    for (const it of items) {
      const k = this.key(it.lat, it.lon)
      const arr = this.buckets.get(k)
      if (arr) arr.push(it)
      else this.buckets.set(k, [it])
    }
  }
  private key(lat: number, lon: number) {
    return `${Math.floor(lat / CELL_DEG)},${Math.floor(lon / CELL_DEG)}`
  }
  /** Tetangga terdekat dalam radius (meter); null kalau tidak ada. */
  nearest(lat: number, lon: number, maxM: number): { item: T; distM: number } | null {
    const r = Math.ceil(maxM / 1100) + 1
    const cy = Math.floor(lat / CELL_DEG)
    const cx = Math.floor(lon / CELL_DEG)
    let best: { item: T; distM: number } | null = null
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const arr = this.buckets.get(`${cy + dy},${cx + dx}`)
        if (!arr) continue
        for (const it of arr) {
          const d = haversine(lat, lon, it.lat, it.lon)
          if (d <= maxM && (!best || d < best.distM)) best = { item: it, distM: d }
        }
      }
    return best
  }
  get size() {
    return this.items.length
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = p2 - p1
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
