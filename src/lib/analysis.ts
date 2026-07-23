/**
 * TAHAP 2, 6, 7 (Ketentuan B.3): cleaning -> analisis spasial -> insight.
 *
 * Tiga operasi utama:
 *   1. loadActivities()  — parsing + cleaning + enrichment + nearest-node join
 *   2. computeNodeStats()— agregasi per simpul transit + Indeks Denyut Transit
 *   3. computeInsights() — angka-angka level kota untuk panel Insight
 */

import raw from '../data/activities.json' with { type: 'json' }
import { TRANSIT_NODES } from '../data/transitNodes'
import { enrichOne, THEMES, themeMeta } from './enrich'
import { haversineM, median, normalize } from './geo'
import type {
  AccessClass,
  Activity,
  Filters,
  Insights,
  NodeStats,
  RawActivity,
  ThemeId,
  TransitNode,
} from './types'

export const ACCESS_META: Record<
  AccessClass,
  { label: string; desc: string; color: string; maxM: number }
> = {
  inti: { label: 'Inti (<500 m)', desc: 'Sekitar 5-7 menit jalan kaki dari simpul', color: '#14b8a6', maxM: 500 },
  dekat: { label: 'Dekat (500 m - 1 km)', desc: 'Masih dalam catchment pejalan kaki', color: '#84cc16', maxM: 1000 },
  sedang: { label: 'Sedang (1 - 2 km)', desc: 'Butuh feeder / kendaraan lanjutan', color: '#f59e0b', maxM: 2000 },
  luar: { label: 'Luar jangkauan (>2 km)', desc: 'Praktis tidak terlayani transit', color: '#ef4444', maxM: Infinity },
}

function classifyAccess(distanceM: number): AccessClass {
  if (distanceM <= 500) return 'inti'
  if (distanceM <= 1000) return 'dekat'
  if (distanceM <= 2000) return 'sedang'
  return 'luar'
}

/** Cari simpul transit terdekat untuk satu titik (brute force; n kecil). */
function nearestNode(lat: number, lon: number) {
  let best: TransitNode = TRANSIT_NODES[0]
  let bestD = Infinity
  for (const n of TRANSIT_NODES) {
    const d = haversineM(lat, lon, n.lat, n.lon)
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return { node: best, distanceM: bestD }
}

/**
 * Cleaning + enrichment + spatial join.
 *
 * Cleaning yang dilakukan pada data mentah panitia:
 *   - lat/long datang sebagai STRING di properties -> dikonversi ke number
 *   - geometry punya koordinat Z (elevasi) yang selalu 0 -> dibuang
 *   - baris tanpa koordinat valid / di luar bbox Indonesia -> dibuang
 *   - duplikat (judul + koordinat sama) -> dibuang
 *   - `images`/`videos` bisa undefined -> dinormalkan jadi array kosong
 */
export function loadActivities(): { activities: Activity[]; dropped: number } {
  const features = (raw as GeoJSON.FeatureCollection).features ?? []
  const seen = new Set<string>()
  const activities: Activity[] = []
  let dropped = 0

  features.forEach((f, i) => {
    const p = (f.properties ?? {}) as unknown as RawActivity
    const lat = Number(p.latitude)
    const lon = Number(p.longitude)

    const validCoord =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat > -11 && lat < 6 && lon > 95 && lon < 141 // bbox kasar Indonesia

    if (!validCoord) {
      dropped++
      return
    }

    const key = `${p.title}|${lat.toFixed(5)}|${lon.toFixed(5)}`
    if (seen.has(key)) {
      dropped++
      return
    }
    seen.add(key)

    const clean: RawActivity = {
      title: (p.title ?? '').trim() || '(tanpa judul)',
      description: (p.description ?? '').trim(),
      latitude: lat,
      longitude: lon,
      images: p.images ?? [],
      videos: p.videos ?? [],
    }

    const enrichment = enrichOne(clean)
    const { node, distanceM } = nearestNode(lat, lon)

    activities.push({
      id: `act-${i}`,
      title: clean.title,
      description: clean.description,
      lat,
      lon,
      images: clean.images!,
      videos: clean.videos!,
      ...enrichment,
      nearestNodeId: node.id,
      nearestNodeName: node.name,
      distanceM: Math.round(distanceM),
      accessClass: classifyAccess(distanceM),
    })
  })

  return { activities, dropped }
}

/**
 * Konstanta peluruhan jarak (meter). exp(-d/DECAY) memberi bobot ~0.51 pada
 * 1 km, ~0.26 pada 2 km, ~0.07 pada 4 km. Angkanya dipilih supaya "sudah tidak
 * relevan" jatuh di sekitar 4 km — kira-kira batas orang masih mau repot
 * menuju simpul untuk keperluan harian.
 */
const DECAY_M = 1500

/**
 * INDEKS DENYUT TRANSIT (0-100) per simpul.
 *
 * Pertanyaan yang dijawab: "seberapa hidup kawasan yang bergantung pada simpul
 * ini, menurut warga yang benar-benar ada di sana?"
 *
 * Catchment ditentukan lewat pembagian nearest-neighbour (Voronoi): tiap
 * aktivitas dimiliki oleh SATU simpul terdekatnya. Ini dipakai menggantikan
 * buffer 1 km yang kaku — dengan buffer, 8 dari 10 simpul di dataset ini dapat
 * skor 0 dan indeksnya jadi tidak informatif. Kontribusi tiap aktivitas lalu
 * diluruhkan terhadap jarak, jadi titik yang jauh tetap terhitung tapi kecil.
 *
 *   pulse = 40% volume    (Σ exp(-d/1500) atas catchment, dinormalisasi
 *                          terhadap simpul dengan volume terbesar)
 *         + 30% relevansi (rata-rata transitRelevance — aktivitas bertema
 *                          mobilitas/ekonomi lebih bernilai untuk isu transit)
 *         + 30% bukti     (rata-rata mediaScore — laporan berfoto/bervideo
 *                          lebih bisa diverifikasi)
 *
 * Bobot dipilih manual dan sengaja dibuat eksplisit supaya bisa diperdebatkan;
 * di versi final sebaiknya dikalibrasi terhadap data pembanding (misal jumlah
 * naik-turun penumpang) lalu dilaporkan sensitivitasnya.
 */
export function computeNodeStats(activities: Activity[]): NodeStats[] {
  const buckets = new Map<string, Activity[]>()
  for (const n of TRANSIT_NODES) buckets.set(n.id, [])
  for (const a of activities) buckets.get(a.nearestNodeId)?.push(a)

  const weighted = new Map<string, number>()
  for (const n of TRANSIT_NODES) {
    weighted.set(
      n.id,
      buckets.get(n.id)!.reduce((s, a) => s + Math.exp(-a.distanceM / DECAY_M), 0),
    )
  }
  const maxWeighted = Math.max(1e-9, ...weighted.values())

  return TRANSIT_NODES.map((node) => {
    const acts = buckets.get(node.id)!
    const count = acts.length
    const complaintCount = acts.filter((a) => a.sentiment === 'keluhan').length

    const themeMix = THEMES.map((t) => ({
      theme: t.id,
      count: acts.filter((a) => a.theme === t.id).length,
    }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)

    const avg = (fn: (a: Activity) => number) =>
      count ? acts.reduce((s, a) => s + fn(a), 0) / count : 0

    const weightedVolume = weighted.get(node.id)!
    const volume = normalize(weightedVolume, 0, maxWeighted)
    const relevance = avg((a) => a.transitRelevance)
    const evidence = avg((a) => a.mediaScore)

    return {
      node,
      activities: acts,
      count,
      withinRadius: acts.filter((a) => a.distanceM <= node.serviceRadiusM).length,
      weightedVolume,
      complaintCount,
      complaintRatio: count ? complaintCount / count : 0,
      avgDistanceM: avg((a) => a.distanceM),
      themeMix,
      dominantTheme: themeMix[0]?.theme ?? null,
      pulseIndex: Math.round(
        (0.4 * volume + 0.3 * relevance + 0.3 * evidence) * 100,
      ),
    }
  }).sort((a, b) => b.pulseIndex - a.pulseIndex)
}

export function computeInsights(
  activities: Activity[],
  nodeStats: NodeStats[],
): Insights {
  const withinServiceArea = activities.filter(
    (a) => a.accessClass === 'inti' || a.accessClass === 'dekat',
  ).length

  const blankSpots = activities
    .filter((a) => a.accessClass === 'luar')
    .sort((a, b) => b.distanceM - a.distanceM)

  const themeCounts = THEMES.map((t) => ({
    theme: t.id as ThemeId,
    count: activities.filter((a) => a.theme === t.id).length,
  })).filter((t) => t.count > 0)

  const accessCounts = (
    Object.keys(ACCESS_META) as AccessClass[]
  ).map((cls) => ({
    cls,
    count: activities.filter((a) => a.accessClass === cls).length,
  }))

  const active = nodeStats.filter((n) => n.count > 0)

  return {
    total: activities.length,
    withinServiceArea,
    coverageRatio: activities.length ? withinServiceArea / activities.length : 0,
    blankSpots,
    themeCounts: themeCounts.sort((a, b) => b.count - a.count),
    accessCounts,
    complaintRatio: activities.length
      ? activities.filter((a) => a.sentiment === 'keluhan').length /
        activities.length
      : 0,
    medianDistanceM: median(activities.map((a) => a.distanceM)),
    topNode: active[0] ?? null,
    weakestNode: active.length > 1 ? active[active.length - 1] : null,
  }
}

export function applyFilters(activities: Activity[], f: Filters): Activity[] {
  const q = f.search.trim().toLowerCase()
  return activities.filter((a) => {
    if (f.themes.length && !f.themes.includes(a.theme)) return false
    if (f.access.length && !f.access.includes(a.accessClass)) return false
    if (f.onlyComplaints && a.sentiment !== 'keluhan') return false
    if (a.distanceM > f.maxDistanceM) return false
    if (f.nodeId && a.nearestNodeId !== f.nodeId) return false
    if (q) {
      const hay = `${a.title} ${a.description} ${a.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Aktivitas -> FeatureCollection siap dipakai sebagai source MapLibre. */
export function toFeatureCollection(
  activities: Activity[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: activities.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: {
        id: a.id,
        title: a.title,
        theme: a.theme,
        color: themeMeta(a.theme).color,
        sentiment: a.sentiment,
        distanceM: a.distanceM,
        accessClass: a.accessClass,
        relevance: a.transitRelevance,
        nearestNodeName: a.nearestNodeName,
      },
    })),
  }
}
