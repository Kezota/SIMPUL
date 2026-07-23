/**
 * TAHAP 2, 6, 7 (Ketentuan B.3): cleaning -> analisis spasial -> insight.
 *
 * Semua fungsi di sini bekerja pada `Observation` — bentuk ternormalisasi yang
 * dihasilkan adapter di src/data/datasets.ts. Konsekuensinya, satu mesin
 * analisis melayani keempat dataset panitia tanpa percabangan.
 */

import { getDataset } from '../data/datasets'
import { nodesForRegion } from '../data/transitNodes'
import { categoryOf } from '../data/datasets'
import { haversineM, median, normalize } from './geo'
import type {
  AccessClass,
  DatasetDef,
  DatasetId,
  Filters,
  Insights,
  NodeStats,
  Observation,
  TransitNode,
} from './types'

export const ACCESS_META: Record<
  AccessClass,
  { label: string; desc: string; color: string }
> = {
  inti: { label: 'Inti (<500 m)', desc: 'Sekitar 5-7 menit jalan kaki dari simpul', color: '#14b8a6' },
  dekat: { label: 'Dekat (500 m - 1 km)', desc: 'Masih dalam catchment pejalan kaki', color: '#84cc16' },
  sedang: { label: 'Sedang (1 - 2 km)', desc: 'Butuh feeder / kendaraan lanjutan', color: '#f59e0b' },
  luar: { label: 'Luar jangkauan (>2 km)', desc: 'Praktis tidak terlayani transit', color: '#ef4444' },
}

function classifyAccess(distanceM: number): AccessClass {
  if (distanceM <= 500) return 'inti'
  if (distanceM <= 1000) return 'dekat'
  if (distanceM <= 2000) return 'sedang'
  return 'luar'
}

/** Simpul transit terdekat untuk satu titik (brute force; n simpul kecil). */
function nearestNode(lat: number, lon: number, nodes: TransitNode[]) {
  let best = nodes[0]
  let bestD = Infinity
  for (const n of nodes) {
    const d = haversineM(lat, lon, n.lat, n.lon)
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return { node: best, distanceM: bestD }
}

export interface LoadedDataset {
  dataset: DatasetDef
  observations: Observation[]
  nodes: TransitNode[]
  dropped: number
  notes: string[]
}

/**
 * Jalankan adapter dataset lalu tempelkan atribut spasial.
 *
 * Simpul transit dipilih berdasarkan wilayah dataset — sampel Menu Go berada di
 * Depok, jadi membandingkannya dengan stasiun Bandung tidak ada artinya.
 */
export function loadDataset(id: DatasetId): LoadedDataset {
  const dataset = getDataset(id)
  const nodes = nodesForRegion(dataset.region)
  const { observations, dropped, notes } = dataset.load()

  const withSpatial = observations.map((o) => {
    const { node, distanceM } = nearestNode(o.lat, o.lon, nodes)
    return {
      ...o,
      nearestNodeId: node.id,
      nearestNodeName: node.name,
      distanceM: Math.round(distanceM),
      accessClass: classifyAccess(distanceM),
    }
  })

  return { dataset, observations: withSpatial, nodes, dropped, notes }
}

/**
 * Konstanta peluruhan jarak (meter). exp(-d/DECAY) memberi bobot ~0.51 pada
 * 1 km, ~0.26 pada 2 km, ~0.07 pada 4 km — "sudah tidak relevan" jatuh di
 * sekitar 4 km, kira-kira batas orang masih mau repot menuju simpul.
 */
const DECAY_M = 1500

/**
 * INDEKS DENYUT TRANSIT (0-100) per simpul.
 *
 * Pertanyaan yang dijawab: "seberapa hidup kawasan yang bergantung pada simpul
 * ini, menurut data lapangan yang benar-benar terkumpul di sana?"
 *
 * Catchment ditentukan lewat pembagian nearest-neighbour (Voronoi): tiap
 * observasi dimiliki oleh SATU simpul terdekatnya. Ini menggantikan buffer 1 km
 * yang kaku — dengan buffer, sebagian besar simpul dapat skor 0 dan indeksnya
 * tidak bisa membedakan apa pun. Kontribusi tiap observasi lalu diluruhkan
 * terhadap jarak, jadi titik jauh tetap terhitung tapi kecil.
 *
 *   pulse = 40% volume    (Σ exp(-d/1500), dinormalisasi ke simpul terbesar)
 *         + 30% relevansi (rata-rata transitRelevance — definisinya berbeda
 *                          per dataset, lihat DatasetDef di datasets.ts)
 *         + 30% bukti     (rata-rata mediaScore — kelengkapan dokumentasi)
 *
 * Bobot dipilih manual dan sengaja ditulis terbuka supaya bisa diperdebatkan;
 * di versi final sebaiknya dikalibrasi terhadap data pembanding (misalnya
 * jumlah naik-turun penumpang) lalu sensitivitasnya dilaporkan.
 */
export function computeNodeStats(
  observations: Observation[],
  nodes: TransitNode[],
): NodeStats[] {
  const buckets = new Map<string, Observation[]>()
  for (const n of nodes) buckets.set(n.id, [])
  for (const o of observations) buckets.get(o.nearestNodeId)?.push(o)

  const weighted = new Map<string, number>()
  for (const n of nodes) {
    weighted.set(
      n.id,
      buckets.get(n.id)!.reduce((s, o) => s + Math.exp(-o.distanceM / DECAY_M), 0),
    )
  }
  const maxWeighted = Math.max(1e-9, ...weighted.values())

  return nodes
    .map((node) => {
      const obs = buckets.get(node.id)!
      const count = obs.length
      const highlightCount = obs.filter((o) => o.highlighted).length

      const mix = new Map<string, number>()
      for (const o of obs) mix.set(o.categoryId, (mix.get(o.categoryId) ?? 0) + 1)
      const categoryMix = [...mix.entries()]
        .map(([categoryId, c]) => ({ categoryId, count: c }))
        .sort((a, b) => b.count - a.count)

      const avg = (fn: (o: Observation) => number) =>
        count ? obs.reduce((s, o) => s + fn(o), 0) / count : 0

      const prices = obs.map((o) => o.price).filter((p): p is number => p !== null)
      const weightedVolume = weighted.get(node.id)!

      return {
        node,
        observations: obs,
        count,
        withinRadius: obs.filter((o) => o.distanceM <= node.serviceRadiusM).length,
        weightedVolume,
        highlightCount,
        highlightRatio: count ? highlightCount / count : 0,
        avgDistanceM: avg((o) => o.distanceM),
        medianPrice: prices.length ? median(prices) : null,
        categoryMix,
        dominantCategory: categoryMix[0]?.categoryId ?? null,
        pulseIndex: Math.round(
          (0.4 * normalize(weightedVolume, 0, maxWeighted) +
            0.3 * avg((o) => o.transitRelevance) +
            0.3 * avg((o) => o.mediaScore)) *
            100,
        ),
      }
    })
    .sort((a, b) => b.pulseIndex - a.pulseIndex)
}

export function computeInsights(
  observations: Observation[],
  nodeStats: NodeStats[],
): Insights {
  const withinServiceArea = observations.filter(
    (o) => o.accessClass === 'inti' || o.accessClass === 'dekat',
  ).length

  const counts = new Map<string, number>()
  for (const o of observations) counts.set(o.categoryId, (counts.get(o.categoryId) ?? 0) + 1)

  const prices = observations.map((o) => o.price).filter((p): p is number => p !== null)
  const active = nodeStats.filter((n) => n.count > 0)

  return {
    total: observations.length,
    withinServiceArea,
    coverageRatio: observations.length ? withinServiceArea / observations.length : 0,
    blankSpots: observations
      .filter((o) => o.accessClass === 'luar')
      .sort((a, b) => b.distanceM - a.distanceM),
    categoryCounts: [...counts.entries()]
      .map(([categoryId, count]) => ({ categoryId, count }))
      .sort((a, b) => b.count - a.count),
    accessCounts: (Object.keys(ACCESS_META) as AccessClass[]).map((cls) => ({
      cls,
      count: observations.filter((o) => o.accessClass === cls).length,
    })),
    highlightRatio: observations.length
      ? observations.filter((o) => o.highlighted).length / observations.length
      : 0,
    medianDistanceM: median(observations.map((o) => o.distanceM)),
    medianPrice: prices.length ? median(prices) : null,
    topNode: active[0] ?? null,
    weakestNode: active.length > 1 ? active[active.length - 1] : null,
  }
}

export function applyFilters(observations: Observation[], f: Filters): Observation[] {
  const q = f.search.trim().toLowerCase()
  return observations.filter((o) => {
    if (f.categories.length && !f.categories.includes(o.categoryId)) return false
    if (f.access.length && !f.access.includes(o.accessClass)) return false
    if (f.onlyHighlighted && !o.highlighted) return false
    if (o.distanceM > f.maxDistanceM) return false
    if (f.nodeId && o.nearestNodeId !== f.nodeId) return false
    if (q) {
      const hay = `${o.title} ${o.subtitle} ${o.description} ${o.tags.join(' ')}`
      if (!hay.toLowerCase().includes(q)) return false
    }
    return true
  })
}

/** Observasi -> FeatureCollection siap dipakai sebagai source MapLibre. */
export function toFeatureCollection(
  observations: Observation[],
  dataset: DatasetDef,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: observations.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lon, o.lat] },
      properties: {
        id: o.id,
        title: o.title,
        color: categoryOf(dataset, o.categoryId).color,
        highlighted: o.highlighted ? 1 : 0,
        distanceM: o.distanceM,
        accessClass: o.accessClass,
        relevance: o.transitRelevance,
        nearestNodeName: o.nearestNodeName,
      },
    })),
  }
}

/** Bounding box observasi, dipakai untuk fitBounds saat ganti dataset. */
export function boundsOf(observations: Observation[]) {
  if (!observations.length) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const o of observations) {
    minLon = Math.min(minLon, o.lon)
    minLat = Math.min(minLat, o.lat)
    maxLon = Math.max(maxLon, o.lon)
    maxLat = Math.max(maxLat, o.lat)
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ] as [[number, number], [number, number]]
}
