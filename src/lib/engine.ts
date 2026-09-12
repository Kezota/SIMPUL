/**
 * Mesin hitung SIMPUL, Jabodetabek. Alur (detail + alasan tiap angka: PERHITUNGAN.md,
 * versi bahasa sederhana: CARA-KERJA.md):
 *
 *   1. Laporan warga Community Maps (API MAPID) → "bukti kegiatan":
 *      titik + jam + bobot (bobot dari kata ramai/sepi yang ditulis surveyor)
 *   2. Kelompokkan ke sel heksagon ±500 m × 5 blok waktu
 *   3. Poin per sel per blok = jumlah bobot. TIDAK ADA estimasi: sel tanpa
 *      pengamatan = "Tidak Ada Data" (PRD: prediksi di kawasan tanpa data = out of scope)
 *   4. Kelas keramaian via ranking persentil (RAMAI = 25% teratas)
 *   5. Skor layanan per sel per blok dari data transit NYATA:
 *      stasiun (OSM + Gapeka/headway) dan halte TJ/JakLingko (GTFS resmi)
 *   6. Kesenjangan: RAMAI + layanan rendah → gap jadwal / gap jangkauan
 */

import { haversineM } from './geo'
import type { TransitNode } from './types'
import { classifyCrowd, hourFromDescription, wibHour, type CrowdHint } from './activityText'
import { hexAt, hexCenter, hexKey, type HexId } from './hexgrid'
import type { MapidActivity } from './mapidApi'
import { blockOfHour, TIME_BLOCKS, type BlockId } from './timeblocks'
import { loadJabodetabekNodes, PointIndex, TJ_STOPS, type BusStop } from './transitData'

/* ── Bobot bukti (keputusan tim, sengaja terbuka biar bisa didebat) ─────── */

export const WEIGHTS = {
  /** Surveyor menulis "ramai/padat/antre" di laporannya. */
  aktivitasRamai: 2,
  /** Laporan tanpa keterangan keramaian. */
  aktivitas: 1,
  /** Surveyor menulis "sepi/lengang", tetap pengamatan, bukan "tidak ada data". */
  aktivitasSepi: 0.5,
}

/** Ambang jangkauan jalan kaki (PRD: catchment 1 km) dan sambungan (2 km). */
export const WALK_M = 1000
export const FEEDER_M = 2000

/** Di bawah ambang ini layanan sebuah sel dianggap "kurang" pada blok itu. */
export const SERVICE_LOW_THRESHOLD = 0.35

/** Faktor jarak: ≤1 km jangkauan penuh, 1–2 km butuh sambungan, >2 km tidak terlayani. */
export function distanceFactor(distanceM: number): number {
  if (distanceM <= WALK_M) return 1
  if (distanceM <= FEEDER_M) return 0.6
  return 0
}

/* ── Wilayah studi ───────────────────────────────────────────────────────── */

export interface RegionDef {
  id: string
  label: string
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
}

export const REGION: RegionDef = {
  id: 'jabodetabek',
  label: 'Jabodetabek',
  bbox: [106.35, -6.75, 107.2, -5.95],
  center: [106.82, -6.25],
  zoom: 10.6,
}

const inBbox = (lat: number, lon: number, b: RegionDef['bbox']) =>
  lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]

/* ── Tipe hasil ──────────────────────────────────────────────────────────── */

export type ActivityClass = 'ramai' | 'sedang' | 'sepi'
export type GapKind = 'jadwal' | 'jangkauan' | null

export interface Evidence {
  kind: 'warga'
  label: string
  hour: number | null
  weight: number
  crowd: CrowdHint
}

export interface HexBlock {
  /** Poin pengamatan (tidak ada komponen perkiraan). */
  observed: number
  total: number
  cls: ActivityClass | null
  /** Persen ranking 0-100 (100 = paling ramai se-wilayah). */
  percentile: number
  /** Skor layanan gabungan 0-1 (maks dari rel & bus). */
  service: number
  /** Keberangkatan terjadwal simpul rel terdekat & halte bus terdekat pada blok ini. */
  railDep: number
  busDep: number
  gap: GapKind
  /** Keramaian tingkat sedang tetapi layanan tipis: belum mendesak, cukup dipantau. */
  watch: boolean
}

export interface HexCell {
  id: HexId
  key: string
  center: { lat: number; lon: number }
  blocks: Record<BlockId, HexBlock>
  evidence: Evidence[]
  nearestNode: TransitNode
  nearestNodeDistM: number
  nearestStop: BusStop | null
  nearestStopDistM: number
  /** Jarak ke layanan transit terdekat apa pun (rel atau bus). */
  nearestTransitM: number
  hasObservation: boolean
}

export interface SimpulModel {
  region: RegionDef
  cells: HexCell[]
  cellByKey: Map<string, HexCell>
  nodes: TransitNode[]
  stops: BusStop[]
  /** Acuan normalisasi keberangkatan per blok (persentil-90 se-wilayah). */
  refDep: { rail: Record<BlockId, number>; bus: Record<BlockId, number> }
  counts: {
    /** Laporan warga yang masuk hitungan. */
    activities: number
    activitiesRamai: number
    activitiesSepi: number
    /** Berapa di antaranya jamnya dibaca dari teks "pukul …" (sisanya jam unggah WIB). */
    activitiesHourFromText: number
    outsideRegion: number
  }
  sources: string[]
}

/* ── Pembacaan laporan warga ─────────────────────────────────────────────── */

export interface TimedPoint {
  lat: number
  lon: number
  hour: number | null
  weight: number
  label: string
  crowd: CrowdHint
}

/**
 * Jam = "pukul …" yang ditulis surveyor kalau ada, kalau tidak jam unggah (WIB).
 * Bobot mengikuti keterangan keramaian yang ditulis surveyor (aturan kata
 * kunci di activityText.ts, bukan LLM).
 */
function readActivities(list: MapidActivity[]) {
  const points: TimedPoint[] = []
  let ramai = 0
  let sepi = 0
  let hourFromText = 0
  for (const a of list) {
    const crowd = classifyCrowd(`${a.title} ${a.description}`)
    if (crowd === 'ramai') ramai++
    else if (crowd === 'sepi') sepi++
    const textHour = hourFromDescription(a.description)
    if (textHour != null) hourFromText++
    points.push({
      lat: a.lat,
      lon: a.lon,
      hour: textHour ?? wibHour(a.createdAt),
      weight:
        crowd === 'ramai' ? WEIGHTS.aktivitasRamai : crowd === 'sepi' ? WEIGHTS.aktivitasSepi : WEIGHTS.aktivitas,
      label: a.title || 'Laporan warga',
      crowd,
    })
  }
  return { points, ramai, sepi, hourFromText }
}

/* ── Perakitan model ─────────────────────────────────────────────────────── */

function emptyBlocks(): Record<BlockId, HexBlock> {
  const mk = (): HexBlock => ({
    observed: 0, total: 0, cls: null, percentile: 0, service: 0, railDep: 0, busDep: 0, gap: null, watch: false,
  })
  return { pagi: mk(), siang: mk(), sore: mk(), malam: mk(), larut: mk() }
}

function percentile(sorted: number[], q: number) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))
  return sorted[i]
}

/** Persentil-90 keberangkatan se-wilayah per blok, acuan "layanan penuh". */
function referenceDepartures(nodes: TransitNode[], stops: BusStop[]) {
  const rail = {} as Record<BlockId, number>
  const bus = {} as Record<BlockId, number>
  for (const b of TIME_BLOCKS) {
    const r = nodes.map((n) => n.depByBlock?.[b.id] ?? 0).filter((v) => v > 0).sort((x, y) => x - y)
    const s = stops.map((st) => st.dep[b.id]).filter((v) => v > 0).sort((x, y) => x - y)
    rail[b.id] = Math.max(1, percentile(r, 0.9))
    bus[b.id] = Math.max(1, percentile(s, 0.9))
  }
  return { rail, bus }
}

/**
 * @param activities laporan warga dari API MAPID (kosong selama memuat)
 * @param activitiesNote kalimat sumber untuk panel Metode (live/snapshot)
 */
export function buildModel(activities: MapidActivity[] = [], activitiesNote?: string): SimpulModel {
  const region = REGION
  const sources = [
    'Stasiun & lintas: OpenStreetMap (9 Sep 2026)',
    'Perjalanan KRL: Gapeka 2025 / 2023; MRT & LRT: headway resmi operator',
    'Halte & keberangkatan TJ/JakLingko: GTFS resmi TransJakarta (24 Jul 2026)',
  ]
  if (activitiesNote) sources.unshift(activitiesNote)

  /* Simpul transit. */
  const nodes = loadJabodetabekNodes()
  const stops = TJ_STOPS.filter((s) => inBbox(s.lat, s.lon, region.bbox))
  const nodeIndex = new PointIndex(nodes)
  const stopIndex = new PointIndex(stops)
  const refDep = referenceDepartures(nodes, stops)

  /* Bukti kegiatan, disaring ke wilayah studi. */
  const read = readActivities(activities)
  const inRegion = read.points.filter((p) => inBbox(p.lat, p.lon, region.bbox))
  const outsideRegion = read.points.length - inRegion.length

  /* Sel heksagon. */
  const cellMap = new Map<string, HexCell>()
  const getCell = (lat: number, lon: number): HexCell => {
    const id = hexAt(lat, lon)
    const key = hexKey(id)
    let cell = cellMap.get(key)
    if (!cell) {
      const center = hexCenter(id)
      const nn = nodeIndex.nearest(center.lat, center.lon, 30000)
      const nearest = nn?.item ?? nodes[0]
      const nearestD = nn ? nn.distM : haversineM(center.lat, center.lon, nodes[0].lat, nodes[0].lon)
      const ns = stopIndex.size ? stopIndex.nearest(center.lat, center.lon, 5000) : null
      cell = {
        id, key, center,
        blocks: emptyBlocks(),
        evidence: [],
        nearestNode: nearest,
        nearestNodeDistM: Math.round(nearestD),
        nearestStop: ns?.item ?? null,
        nearestStopDistM: ns ? Math.round(ns.distM) : Infinity,
        nearestTransitM: Math.round(Math.min(nearestD, ns ? ns.distM : Infinity)),
        hasObservation: false,
      }
      cellMap.set(key, cell)
    }
    return cell
  }

  /* 1) Pengamatan ber-jam masuk ke bloknya; tanpa jam → dibagi rata tipis. */
  for (const p of inRegion) {
    const cell = getCell(p.lat, p.lon)
    cell.evidence.push({ kind: 'warga', label: p.label, hour: p.hour, weight: p.weight, crowd: p.crowd })
    if (p.hour != null) cell.blocks[blockOfHour(p.hour)].observed += p.weight
    else for (const b of TIME_BLOCKS) cell.blocks[b.id].observed += p.weight / TIME_BLOCKS.length
    cell.hasObservation = true
  }
  for (const cell of cellMap.values())
    for (const b of TIME_BLOCKS) cell.blocks[b.id].total = cell.blocks[b.id].observed

  /* 2) Kelas keramaian: ranking persentil atas semua (sel × blok) dengan pengamatan. */
  const values: number[] = []
  for (const cell of cellMap.values())
    for (const b of TIME_BLOCKS) {
      const t = cell.blocks[b.id].total
      if (t > 0) values.push(t)
    }
  values.sort((a, b) => a - b)
  const percentileOf = (v: number) => {
    if (!values.length) return 0
    let lo = 0
    let hi = values.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (values[mid] < v) lo = mid + 1
      else hi = mid
    }
    return Math.round((lo / values.length) * 100)
  }

  /* 3) Layanan + kesenjangan. */
  for (const cell of cellMap.values()) {
    const fRail = distanceFactor(cell.nearestNodeDistM)
    const fBus = distanceFactor(cell.nearestStopDistM)
    for (const b of TIME_BLOCKS) {
      const hb = cell.blocks[b.id]
      if (hb.total > 0) {
        hb.percentile = percentileOf(hb.total)
        hb.cls = hb.percentile >= 75 ? 'ramai' : hb.percentile >= 50 ? 'sedang' : 'sepi'
      }
      const railDep = cell.nearestNode.depByBlock?.[b.id] ?? 0
      const busDep = cell.nearestStop?.dep[b.id] ?? 0
      const railScore = fRail * Math.min(1, railDep / refDep.rail[b.id])
      const busScore = fBus * Math.min(1, busDep / refDep.bus[b.id])
      hb.railDep = railDep
      hb.busDep = busDep
      hb.service = Math.max(railScore, busScore)
      if (hb.cls === 'ramai' && hb.service < SERVICE_LOW_THRESHOLD) {
        // Jangkauan: tidak ada layanan apa pun dalam jarak jalan kaki (PRD: 1 km).
        hb.gap = cell.nearestTransitM > WALK_M ? 'jangkauan' : 'jadwal'
      } else if (hb.cls === 'sedang' && hb.service < SERVICE_LOW_THRESHOLD) {
        hb.watch = true
      }
    }
  }

  return {
    region,
    cells: [...cellMap.values()],
    cellByKey: cellMap,
    nodes,
    stops,
    refDep,
    counts: {
      activities: inRegion.length,
      activitiesRamai: read.ramai,
      activitiesSepi: read.sepi,
      activitiesHourFromText: read.hourFromText,
      outsideRegion,
    },
    sources,
  }
}

/* ── Ringkasan per blok (untuk panel kanan) ──────────────────────────────── */

export interface BlockSummary {
  block: BlockId
  activeCells: number
  ramai: number
  sedang: number
  gapJadwal: number
  gapJangkauan: number
  watch: number
  totalPoints: number
}

export function summarizeBlocks(model: SimpulModel): BlockSummary[] {
  return TIME_BLOCKS.map((b) => {
    let activeCells = 0
    let ramai = 0
    let sedang = 0
    let gapJadwal = 0
    let gapJangkauan = 0
    let watch = 0
    let totalPoints = 0
    for (const cell of model.cells) {
      const hb = cell.blocks[b.id]
      if (hb.total > 0) activeCells++
      if (hb.cls === 'ramai') ramai++
      if (hb.cls === 'sedang') sedang++
      if (hb.gap === 'jadwal') gapJadwal++
      if (hb.gap === 'jangkauan') gapJangkauan++
      if (hb.watch) watch++
      totalPoints += hb.total
    }
    return { block: b.id, activeCells, ramai, sedang, gapJadwal, gapJangkauan, watch, totalPoints }
  })
}
