/**
 * Mesin hitung SIMPUL. Alur (detail + alasan tiap angka: PERHITUNGAN.md):
 *
 *   1. Baca dataset MAPID → "bukti kegiatan" berkoordinat + jam + bobot
 *   2. Kelompokkan ke sel heksagon ±500 m × 5 blok waktu
 *   3. Poin per sel per blok = jumlah bobot pengamatan. TIDAK ADA estimasi:
 *      sel tanpa pengamatan = "Tidak Ada Data" (sesuai PRD, out-of-scope:
 *      prediksi keramaian pada kawasan tanpa data)
 *   4. Kelas keramaian via ranking persentil (RAMAI = 25% teratas)
 *   5. Skor layanan per sel per blok dari data transit NYATA:
 *      stasiun (OSM + Gapeka) dan halte TJ/JakLingko (GTFS resmi)
 *   6. Kesenjangan: RAMAI + layanan rendah → gap jadwal / gap jangkauan
 */

import communityRaw from '../data/community.json' with { type: 'json' }
import strukgoRaw from '../data/strukgo.json' with { type: 'json' }
import menugoRaw from '../data/menugo.json' with { type: 'json' }
import propertigoRaw from '../data/propertigo.json' with { type: 'json' }

import { TRANSIT_NODES } from '../data/transitNodes'
import { haversineM } from '../lib/geo'
import type { RegionId, TransitNode } from '../lib/types'
import { hexAt, hexCenter, hexKey, type HexId } from './hexgrid'
import { distanceFactor, SERVICE_LOW_THRESHOLD, SERVICE_PROFILE } from './serviceProfiles'
import {
  blockOfHour,
  hourFromMediaUrls,
  hourFromTimeString,
  TIME_BLOCKS,
  type BlockId,
} from './timeblocks'
import { loadJabodetabekNodes, PointIndex, TJ_STOPS, type BusStop } from './transitData'
import { classifyCrowd, hourFromDescription, wibHour } from './activityText'
import type { MapidActivity } from './mapidApi'

/* ── Bobot bukti (keputusan tim — sengaja terbuka biar bisa didebat) ─────── */

export const WEIGHTS = {
  menuRamai: 3, // pengamatan keramaian langsung — paling dipercaya
  menuSedang: 2,
  menuSepi: 1,
  struk: 1, // bukti transaksi beneran terjadi
  strukEcommerce: 0, // dibuang: belanja online tercatat di mana pun pembelinya
  community: 0.5, // sampel Community Maps lama (jam dari cap foto, tanpa keterangan ramai/sepi)
  /* Laporan warga dari API Activities MAPID — keterangan keramaian dibaca dari teks (activityText.ts). */
  aktivitasRamai: 2, // surveyor menulis "ramai/padat/antre"
  aktivitas: 1, // laporan tanpa keterangan keramaian
  aktivitasSepi: 0.5, // surveyor menulis "sepi/lengang" — tetap pengamatan, bukan "tidak ada data"
}

/** Ambang jangkauan jalan kaki (PRD: catchment 1 km) dan sambungan (2 km). */
export const WALK_M = 1000
export const FEEDER_M = 2000

/* ── Wilayah studi ───────────────────────────────────────────────────────── */

export interface RegionDef {
  id: RegionId
  label: string
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
}

export const REGIONS: Record<RegionId, RegionDef> = {
  jabodetabek: {
    id: 'jabodetabek',
    label: 'Jabodetabek',
    bbox: [106.35, -6.75, 107.2, -5.95],
    center: [106.82, -6.25],
    zoom: 10.6,
  },
  bandung: {
    id: 'bandung',
    label: 'Bandung Raya (sampel)',
    bbox: [107.35, -7.1, 107.85, -6.75],
    center: [107.594, -6.918],
    zoom: 11.4,
  },
}

const inBbox = (lat: number, lon: number, b: RegionDef['bbox']) =>
  lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]

/* ── Tipe hasil ──────────────────────────────────────────────────────────── */

export type ActivityClass = 'ramai' | 'sedang' | 'sepi'
export type GapKind = 'jadwal' | 'jangkauan' | null

export interface Evidence {
  kind: 'struk' | 'menu' | 'warga'
  label: string
  hour: number | null
  weight: number
}

export interface HexBlock {
  /** Poin pengamatan (tidak ada komponen perkiraan lagi). */
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
}

export interface HexCell {
  id: HexId
  key: string
  center: { lat: number; lon: number }
  blocks: Record<BlockId, HexBlock>
  evidence: Evidence[]
  /** Titik usaha/hunian Properti Go di sel — konteks, BUKAN skor. */
  propertyCount: number
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
    strukUsed: number
    strukDropped: number
    communityTimed: number
    communityUntimed: number
    /** Laporan warga dari API Activities MAPID (live/snapshot). */
    activities: number
    activitiesRamai: number
    activitiesSepi: number
    /** Berapa di antaranya jamnya dibaca dari teks "pukul …" (sisanya jam unggah WIB). */
    activitiesHourFromText: number
    menuUsed: number
    properties: number
    outsideRegion: number
  }
  sources: string[]
}

/* ── Pembacaan data mentah ───────────────────────────────────────────────── */

type Props = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v).trim())
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface TimedPoint {
  lat: number
  lon: number
  hour: number | null
  weight: number
  kind: Evidence['kind']
  label: string
}

function readStruk(fc: GeoJSON.FeatureCollection) {
  const points: TimedPoint[] = []
  let used = 0
  let dropped = 0
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p['Latitude'])
    const lon = num(p['Longitude'])
    if (lat == null || lon == null) continue
    if (str(p['Kategori Tempat']).toLowerCase() === 'e-commerce') {
      dropped++
      continue
    }
    used++
    points.push({
      lat, lon,
      hour: hourFromTimeString(p['Waktu Transaksi']),
      weight: WEIGHTS.struk,
      kind: 'struk',
      label: str(p['Nama Tempat/Merchant']) || 'Transaksi',
    })
  }
  return { points, used, dropped }
}

function readCommunity(fc: GeoJSON.FeatureCollection) {
  const points: TimedPoint[] = []
  let timed = 0
  let untimed = 0
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p.latitude)
    const lon = num(p.longitude)
    if (lat == null || lon == null) continue
    const hour = hourFromMediaUrls(p.medias_all) ?? hourFromMediaUrls(p.images)
    if (hour == null) untimed++
    else timed++
    points.push({ lat, lon, hour, weight: WEIGHTS.community, kind: 'warga', label: str(p.title) || 'Laporan warga' })
  }
  return { points, timed, untimed }
}

/** Menu Go: pengamatan keramaian langsung — jadi bukti ber-bobot di petanya sendiri. */
/**
 * Laporan warga dari API Activities MAPID. Jam = "pukul …" yang ditulis
 * surveyor kalau ada, kalau tidak jam unggah (WIB). Bobot mengikuti
 * keterangan keramaian yang ditulis surveyor (aturan kata kunci, bukan LLM).
 */
function readActivities(list: MapidActivity[]) {
  const points: TimedPoint[] = []
  let ramai = 0
  let sepi = 0
  let hourFromText = 0
  for (const a of list) {
    const text = `${a.title} ${a.description}`
    const crowd = classifyCrowd(text)
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
      kind: 'warga',
      label: a.title || 'Laporan warga',
    })
  }
  return { points, ramai, sepi, hourFromText }
}

function readMenu(fc: GeoJSON.FeatureCollection) {
  const points: TimedPoint[] = []
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p['Latitude'])
    const lon = num(p['Longitude'])
    if (lat == null || lon == null) continue
    const kondisi = str(p['Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?']).toLowerCase()
    const weight = kondisi.startsWith('ramai')
      ? WEIGHTS.menuRamai
      : kondisi.startsWith('sepi')
        ? WEIGHTS.menuSepi
        : WEIGHTS.menuSedang
    points.push({
      lat, lon,
      hour: hourFromTimeString(p['Waktu']),
      weight,
      kind: 'menu',
      label: `${str(p['Nama Tempat Makan']) || 'Tempat makan'} (${kondisi.split(' ')[0] || 'sedang'})`,
    })
  }
  return { points }
}

function readProperties(fc: GeoJSON.FeatureCollection) {
  const out: { lat: number; lon: number }[] = []
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p['Latitude'])
    const lon = num(p['Longitude'])
    if (lat != null && lon != null) out.push({ lat, lon })
  }
  return out
}

/** Sumber data aktivitas — default: sampel resmi kompetisi yang dibundel. */
export interface ActivitySources {
  struk: GeoJSON.FeatureCollection
  community: GeoJSON.FeatureCollection
  menu: GeoJSON.FeatureCollection
  properti: GeoJSON.FeatureCollection
  label: string
  /** Laporan warga dari API Activities MAPID (diisi SimpulApp setelah fetch). */
  activities?: MapidActivity[]
  activitiesNote?: string
}

export const BUNDLED_SOURCES: ActivitySources = {
  struk: strukgoRaw as GeoJSON.FeatureCollection,
  community: communityRaw as GeoJSON.FeatureCollection,
  menu: menugoRaw as GeoJSON.FeatureCollection,
  properti: propertigoRaw as GeoJSON.FeatureCollection,
  label: 'Sampel resmi kompetisi (file GeoJSON panitia)',
}

/* ── Perakitan model ─────────────────────────────────────────────────────── */

function emptyBlocks(): Record<BlockId, HexBlock> {
  const mk = (): HexBlock => ({
    observed: 0, total: 0, cls: null, percentile: 0, service: 0, railDep: 0, busDep: 0, gap: null,
  })
  return { pagi: mk(), siang: mk(), sore: mk(), malam: mk(), larut: mk() }
}

function percentile(sorted: number[], q: number) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))
  return sorted[i]
}

export function buildModel(
  regionId: RegionId = 'jabodetabek',
  src: ActivitySources = BUNDLED_SOURCES,
): SimpulModel {
  const region = REGIONS[regionId]
  const sources = [src.label]

  /* Simpul transit sesuai wilayah. */
  const nodes: TransitNode[] =
    regionId === 'jabodetabek'
      ? loadJabodetabekNodes()
      : TRANSIT_NODES.filter((n) => n.region === 'bandung')
  const stops: BusStop[] =
    regionId === 'jabodetabek'
      ? TJ_STOPS.filter((s) => inBbox(s.lat, s.lon, region.bbox))
      : []
  const nodeIndex = new PointIndex(nodes)
  const stopIndex = new PointIndex(stops)
  if (regionId === 'jabodetabek') {
    sources.push(
      'Stasiun & lintas: OpenStreetMap (9 Sep 2026)',
      'Perjalanan KRL: Gapeka 2025 / 2023; MRT & LRT: headway resmi operator',
      'Halte & keberangkatan TJ/JakLingko: GTFS resmi TransJakarta (24 Jul 2026)',
    )
  } else {
    sources.push('Simpul Bandung: perkiraan manual; profil jadwal: perkiraan (mode sampel)')
  }

  /* Acuan normalisasi keberangkatan = persentil-90 se-wilayah per blok. */
  const refDep = {
    rail: {} as Record<BlockId, number>,
    bus: {} as Record<BlockId, number>,
  }
  for (const b of TIME_BLOCKS) {
    const r = nodes.map((n) => n.depByBlock?.[b.id] ?? 0).filter((v) => v > 0).sort((a, c) => a - c)
    const s = stops.map((st) => st.dep[b.id]).filter((v) => v > 0).sort((a, c) => a - c)
    refDep.rail[b.id] = percentile(r, 0.9) || 1
    refDep.bus[b.id] = percentile(s, 0.9) || 1
  }

  /* Baca bukti kegiatan, saring ke wilayah studi. */
  const struk = readStruk(src.struk)
  const community = readCommunity(src.community)
  const menu = readMenu(src.menu)
  const activities = readActivities(src.activities ?? [])
  if (src.activitiesNote) sources.push(src.activitiesNote)
  const properties = readProperties(src.properti)
  const allPoints = [...struk.points, ...community.points, ...menu.points, ...activities.points]
  const inRegion = allPoints.filter((p) => inBbox(p.lat, p.lon, region.bbox))
  const outsideRegion = allPoints.length - inRegion.length

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
        propertyCount: 0,
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
    cell.evidence.push({ kind: p.kind, label: p.label, hour: p.hour, weight: p.weight })
    if (p.hour != null) cell.blocks[blockOfHour(p.hour)].observed += p.weight
    else for (const b of TIME_BLOCKS) cell.blocks[b.id].observed += p.weight / TIME_BLOCKS.length
    cell.hasObservation = true
  }

  /* 2) Properti Go → konteks potensi kawasan (jumlah titik), bukan skor. */
  let propInRegion = 0
  for (const pr of properties) {
    if (!inBbox(pr.lat, pr.lon, region.bbox)) continue
    propInRegion++
    getCell(pr.lat, pr.lon).propertyCount++
  }
  for (const cell of cellMap.values())
    for (const b of TIME_BLOCKS) cell.blocks[b.id].total = cell.blocks[b.id].observed

  /* 3) Kelas keramaian: ranking persentil atas semua (sel × blok) dengan pengamatan. */
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

  /* 4) Layanan + kesenjangan. */
  for (const cell of cellMap.values()) {
    const fRail = distanceFactor(cell.nearestNodeDistM)
    const fBus = distanceFactor(cell.nearestStopDistM)
    for (const b of TIME_BLOCKS) {
      const hb = cell.blocks[b.id]
      if (hb.total > 0) {
        hb.percentile = percentileOf(hb.total)
        hb.cls = hb.percentile >= 75 ? 'ramai' : hb.percentile >= 50 ? 'sedang' : 'sepi'
      }
      // Rel: keberangkatan nyata (Jabodetabek) atau profil relatif (Bandung).
      const railDep = cell.nearestNode.depByBlock?.[b.id]
      const railScore =
        railDep != null
          ? fRail * Math.min(1, railDep / refDep.rail[b.id])
          : fRail * SERVICE_PROFILE[cell.nearestNode.kind][b.id]
      const busDep = cell.nearestStop?.dep[b.id] ?? 0
      const busScore = fBus * Math.min(1, busDep / refDep.bus[b.id])
      hb.railDep = railDep ?? 0
      hb.busDep = busDep
      hb.service = Math.max(railScore, busScore)
      if (hb.cls === 'ramai' && hb.service < SERVICE_LOW_THRESHOLD) {
        // Jangkauan: tidak ada layanan apa pun dalam jarak jalan kaki (PRD: 1 km).
        hb.gap = cell.nearestTransitM > WALK_M ? 'jangkauan' : 'jadwal'
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
      strukUsed: struk.used,
      strukDropped: struk.dropped,
      communityTimed: community.timed,
      communityUntimed: community.untimed,
      activities: activities.points.length,
      activitiesRamai: activities.ramai,
      activitiesSepi: activities.sepi,
      activitiesHourFromText: activities.hourFromText,
      menuUsed: menu.points.length,
      properties: propInRegion,
      outsideRegion,
    },
    sources,
  }
}

/* ── Ringkasan per blok (untuk panel Insight) ────────────────────────────── */

export interface BlockSummary {
  block: BlockId
  activeCells: number
  ramai: number
  sedang: number
  gapJadwal: number
  gapJangkauan: number
  totalPoints: number
}

export function summarizeBlocks(model: SimpulModel): BlockSummary[] {
  return TIME_BLOCKS.map((b) => {
    let activeCells = 0
    let ramai = 0
    let sedang = 0
    let gapJadwal = 0
    let gapJangkauan = 0
    let totalPoints = 0
    for (const cell of model.cells) {
      const hb = cell.blocks[b.id]
      if (hb.total > 0) activeCells++
      if (hb.cls === 'ramai') ramai++
      if (hb.cls === 'sedang') sedang++
      if (hb.gap === 'jadwal') gapJadwal++
      if (hb.gap === 'jangkauan') gapJangkauan++
      totalPoints += hb.total
    }
    return { block: b.id, activeCells, ramai, sedang, gapJadwal, gapJangkauan, totalPoints }
  })
}
