/**
 * Mesin hitung SIMPUL. Alur (detail lengkap + alasan tiap angka: PERHITUNGAN.md):
 *
 *   1. Baca 4 dataset MAPID → "bukti kegiatan" berkoordinat + jam + bobot
 *   2. Kelompokkan ke sel heksagon ±500 m × 5 blok waktu
 *   3. Poin pengamatan + poin perkiraan (dari sebaran usaha Properti Go ×
 *      kurva blok kota) → total poin per sel per blok
 *   4. Kelas keramaian via ranking persentil (RAMAI = 25% teratas)
 *   5. Skor layanan per sel per blok (jarak ke simpul × profil jadwalnya)
 *   6. Kesenjangan: RAMAI + layanan rendah → gap jadwal / gap jangkauan
 */

import communityRaw from '../data/community.json' with { type: 'json' }
import strukgoRaw from '../data/strukgo.json' with { type: 'json' }
import menugoRaw from '../data/menugo.json' with { type: 'json' }
import propertigoRaw from '../data/propertigo.json' with { type: 'json' }

import { TRANSIT_NODES } from '../data/transitNodes'
import { haversineM } from '../lib/geo'
import type { TransitNode } from '../lib/types'
import { hexAt, hexCenter, hexKey, type HexId } from './hexgrid'
import {
  distanceFactor,
  SERVICE_LOW_THRESHOLD,
  SERVICE_PROFILE,
} from './serviceProfiles'
import {
  blockOfHour,
  hourFromMediaUrls,
  hourFromTimeString,
  TIME_BLOCKS,
  type BlockId,
} from './timeblocks'

/* ── Bobot bukti (keputusan tim — sengaja terbuka biar bisa didebat) ─────── */

export const WEIGHTS = {
  menuRamai: 3, // pengamatan keramaian langsung — paling dipercaya
  menuSedang: 2,
  menuSepi: 1,
  struk: 1, // bukti transaksi beneran terjadi
  strukEcommerce: 0, // dibuang: belanja online tercatat di mana pun pembelinya
  community: 0.5, // bukti aktivitas warga, tapi bukan transaksi
  /** Pengali poin perkiraan supaya tidak menenggelamkan pengamatan asli. */
  estimateScale: 0.35,
}

/** Bobot "wadah kegiatan" per kategori properti — dasar poin perkiraan. */
const PROPERTY_POTENTIAL: Record<string, number> = {
  ruko: 1, retail: 1, 'retail fnb': 1, restoran: 1, 'coworking space': 0.8,
  kantor: 0.6, kos: 0.4, rumah: 0.15, gudang: 0.1, tanah: 0,
}

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
  observed: number
  estimated: number
  total: number
  cls: ActivityClass | null
  /** Persen ranking 0-100 (100 = paling ramai se-kota). */
  percentile: number
  service: number
  gap: GapKind
}

export interface HexCell {
  id: HexId
  key: string
  center: { lat: number; lon: number }
  blocks: Record<BlockId, HexBlock>
  evidence: Evidence[]
  propertyCount: number
  propertyPotential: number
  nearestNode: TransitNode
  nearestNodeDistM: number
  /** Ada minimal satu pengamatan ber-jam (bukan cuma perkiraan). */
  hasObservation: boolean
}

export interface BlockCurvePoint {
  block: BlockId
  observedShare: number
}

export interface SimpulModel {
  cells: HexCell[]
  cellByKey: Map<string, HexCell>
  nodes: TransitNode[]
  /** Kurva blok kota: sebaran pengamatan ber-jam per blok (untuk perkiraan). */
  cityCurve: BlockCurvePoint[]
  counts: {
    strukUsed: number
    strukDropped: number
    communityTimed: number
    communityUntimed: number
    menuPooled: number
    properties: number
  }
}

/* ── Pembacaan data mentah ───────────────────────────────────────────────── */

type Props = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v).trim())
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

interface TimedPoint {
  lat: number
  lon: number
  hour: number | null
  weight: number
  kind: Evidence['kind']
  label: string
}

function readStruk(): { points: TimedPoint[]; used: number; dropped: number } {
  const points: TimedPoint[] = []
  let used = 0
  let dropped = 0
  for (const f of (strukgoRaw as GeoJSON.FeatureCollection).features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p['Latitude'])
    const lon = num(p['Longitude'])
    if (lat == null || lon == null) continue
    const kategori = str(p['Kategori Tempat']).toLowerCase()
    if (kategori === 'e-commerce') {
      dropped++
      continue // bobot 0: titik e-commerce tidak menyatakan keramaian lokasi
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

function readCommunity(): { points: TimedPoint[]; timed: number; untimed: number } {
  const points: TimedPoint[] = []
  let timed = 0
  let untimed = 0
  for (const f of (communityRaw as GeoJSON.FeatureCollection).features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p.latitude)
    const lon = num(p.longitude)
    if (lat == null || lon == null) continue
    const hour = hourFromMediaUrls(p.medias_all) ?? hourFromMediaUrls(p.images)
    if (hour == null) untimed++
    else timed++
    points.push({
      lat, lon, hour,
      weight: WEIGHTS.community,
      kind: 'warga',
      label: str(p.title) || 'Laporan warga',
    })
  }
  return { points, timed, untimed }
}

/**
 * Menu Go berada di Depok — di luar peta Bandung. Perannya di sini: menyumbang
 * "kurva blok kota" (jam berapa kegiatan ekonomi biasanya terjadi) yang dipakai
 * untuk poin perkiraan. Label ramai/sedang/sepi-nya jadi bobot kurva.
 */
function readMenuForCurve(): { hour: number; weight: number }[] {
  const out: { hour: number; weight: number }[] = []
  for (const f of (menugoRaw as GeoJSON.FeatureCollection).features) {
    const p = (f.properties ?? {}) as Props
    const hour = hourFromTimeString(p['Waktu'])
    if (hour == null) continue
    const kondisi = str(p['Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?'])
      .toLowerCase()
    const weight = kondisi.startsWith('ramai')
      ? WEIGHTS.menuRamai
      : kondisi.startsWith('sepi')
        ? WEIGHTS.menuSepi
        : WEIGHTS.menuSedang
    out.push({ hour, weight })
  }
  return out
}

function readProperties(): { lat: number; lon: number; potential: number }[] {
  const out: { lat: number; lon: number; potential: number }[] = []
  for (const f of (propertigoRaw as GeoJSON.FeatureCollection).features) {
    const p = (f.properties ?? {}) as Props
    const lat = num(p['Latitude'])
    const lon = num(p['Longitude'])
    if (lat == null || lon == null) continue
    const kategori = str(p['Kategori Properti']).toLowerCase()
    const matched = Object.entries(PROPERTY_POTENTIAL).find(([k]) =>
      kategori.startsWith(k),
    )
    out.push({ lat, lon, potential: matched ? matched[1] : 0.3 })
  }
  return out
}

/* ── Perakitan model ─────────────────────────────────────────────────────── */

const BANDUNG_NODES = TRANSIT_NODES.filter((n) => n.region === 'bandung')

function emptyBlocks(): Record<BlockId, HexBlock> {
  const mk = (): HexBlock => ({
    observed: 0, estimated: 0, total: 0, cls: null, percentile: 0,
    service: 0, gap: null,
  })
  return { pagi: mk(), siang: mk(), sore: mk(), malam: mk(), larut: mk() }
}

export function buildModel(): SimpulModel {
  const struk = readStruk()
  const community = readCommunity()
  const menuCurveObs = readMenuForCurve()
  const properties = readProperties()

  /* Kurva blok kota: gabungan semua pengamatan ber-jam (struk + menu). */
  const curveRaw: Record<BlockId, number> = { pagi: 0, siang: 0, sore: 0, malam: 0, larut: 0 }
  for (const o of menuCurveObs) curveRaw[blockOfHour(o.hour)] += o.weight
  for (const p of struk.points) {
    if (p.hour != null) curveRaw[blockOfHour(p.hour)] += p.weight
  }
  const curveMax = Math.max(1e-9, ...Object.values(curveRaw))
  const cityCurve: BlockCurvePoint[] = TIME_BLOCKS.map((b) => ({
    block: b.id,
    observedShare: curveRaw[b.id] / curveMax,
  }))

  /* Sel heksagon. */
  const cellMap = new Map<string, HexCell>()
  const getCell = (lat: number, lon: number): HexCell => {
    const id = hexAt(lat, lon)
    const key = hexKey(id)
    let cell = cellMap.get(key)
    if (!cell) {
      const center = hexCenter(id)
      let nearest = BANDUNG_NODES[0]
      let nearestD = Infinity
      for (const n of BANDUNG_NODES) {
        const d = haversineM(center.lat, center.lon, n.lat, n.lon)
        if (d < nearestD) {
          nearestD = d
          nearest = n
        }
      }
      cell = {
        id, key, center,
        blocks: emptyBlocks(),
        evidence: [],
        propertyCount: 0,
        propertyPotential: 0,
        nearestNode: nearest,
        nearestNodeDistM: Math.round(nearestD),
        hasObservation: false,
      }
      cellMap.set(key, cell)
    }
    return cell
  }

  /* 1) Pengamatan ber-jam masuk ke bloknya; tanpa jam → dibagi rata tipis. */
  for (const p of [...struk.points, ...community.points]) {
    const cell = getCell(p.lat, p.lon)
    cell.evidence.push({ kind: p.kind, label: p.label, hour: p.hour, weight: p.weight })
    if (p.hour != null) {
      cell.blocks[blockOfHour(p.hour)].observed += p.weight
      cell.hasObservation = true
    } else {
      for (const b of TIME_BLOCKS) cell.blocks[b.id].observed += p.weight / TIME_BLOCKS.length
    }
  }

  /* 2) Properti → potensi + poin perkiraan mengikuti kurva kota. */
  for (const pr of properties) {
    const cell = getCell(pr.lat, pr.lon)
    cell.propertyCount++
    cell.propertyPotential += pr.potential
  }
  for (const cell of cellMap.values()) {
    for (const b of TIME_BLOCKS) {
      const share = cityCurve.find((c) => c.block === b.id)!.observedShare
      cell.blocks[b.id].estimated =
        cell.propertyPotential * share * WEIGHTS.estimateScale
      cell.blocks[b.id].total = cell.blocks[b.id].observed + cell.blocks[b.id].estimated
    }
  }

  /* 3) Kelas keramaian: ranking persentil atas semua (sel × blok) dgn total>0. */
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
    const dFactor = distanceFactor(cell.nearestNodeDistM)
    for (const b of TIME_BLOCKS) {
      const hb = cell.blocks[b.id]
      if (hb.total > 0) {
        hb.percentile = percentileOf(hb.total)
        hb.cls = hb.percentile >= 75 ? 'ramai' : hb.percentile >= 50 ? 'sedang' : 'sepi'
      }
      hb.service = dFactor * SERVICE_PROFILE[cell.nearestNode.kind][b.id]
      if (hb.cls === 'ramai' && hb.service < SERVICE_LOW_THRESHOLD) {
        hb.gap = dFactor === 0 ? 'jangkauan' : 'jadwal'
      }
    }
  }

  const cells = [...cellMap.values()]
  return {
    cells,
    cellByKey: cellMap,
    nodes: BANDUNG_NODES,
    cityCurve,
    counts: {
      strukUsed: struk.used,
      strukDropped: struk.dropped,
      communityTimed: community.timed,
      communityUntimed: community.untimed,
      menuPooled: menuCurveObs.length,
      properties: properties.length,
    },
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
