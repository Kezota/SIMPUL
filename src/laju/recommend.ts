/**
 * Penyusun rekomendasi LAJU.
 *
 * Aturannya deterministik dan bisa diaudit — AI (LLM) nantinya hanya
 * memperhalus kalimat, TIDAK menentukan isi. Semua angka di rekomendasi
 * ditarik dari model hitungan, bukan dikarang.
 */

import { haversineM } from '../lib/geo'
import type { TransitNode } from '../lib/types'
import { hexKey, hexNeighbors } from './hexgrid'
import { SERVICE_LOW_THRESHOLD, SERVICE_PROFILE } from './serviceProfiles'
import { TIME_BLOCKS, type BlockId } from './timeblocks'
import type { HexCell, LajuModel } from './engine'
import { ACCESS_PINS } from './accessPins'

export interface Recommendation {
  id: string
  kind: 'jadwal' | 'jangkauan'
  target: string
  title: string
  body: string
  /** Satu baris usulan konkret, ditampilkan menonjol. */
  action: string
  accessNote: string | null
  facts: { label: string; value: string }[]
  focus: { lat: number; lon: number; zoom: number }
  block: BlockId | null
  score: number
}

const blockLabel = (id: BlockId) => {
  const b = TIME_BLOCKS.find((x) => x.id === id)!
  return `${b.label} (${b.range})`
}

/** Catatan akses: pin ramah/tidak/belum-dinilai dalam ±1,2 km dari titik. */
function accessNoteFor(lat: number, lon: number): string | null {
  const near = ACCESS_PINS.filter((p) => haversineM(lat, lon, p.lat, p.lon) <= 1200)
  if (!near.length) return null
  const bad = near.filter((p) => p.status === 'tidak-ramah').length
  const unknown = near.filter((p) => p.status === 'belum-dinilai').length
  const parts: string[] = []
  if (bad) parts.push(`${bad} titik dinilai tidak ramah akses dari foto lapangan`)
  if (unknown) parts.push(`${unknown} titik belum ternilai (kandidat survey)`)
  if (!parts.length) return null
  return `Catatan akses: ${parts.join('; ')} — jika layanan ditambah, siapkan juga aksesnya (ramp/penataan pintu masuk).`
}

/**
 * Rekomendasi JADWAL: per simpul, blok dengan kegiatan tinggi di sekitarnya
 * (≤2 km) tapi profil layanannya rendah.
 */
function scheduleRecs(model: LajuModel): Recommendation[] {
  const recs: Recommendation[] = []
  for (const node of model.nodes) {
    const nearby = model.cells.filter(
      (c) => c.nearestNode.id === node.id && c.nearestNodeDistM <= 2000,
    )
    if (!nearby.length) continue
    for (const b of TIME_BLOCKS) {
      const profile = SERVICE_PROFILE[node.kind][b.id]
      if (profile > SERVICE_LOW_THRESHOLD) continue
      const busy = nearby.filter((c) => {
        const cls = c.blocks[b.id].cls
        return cls === 'ramai' || cls === 'sedang'
      })
      const points = nearby.reduce((s, c) => s + c.blocks[b.id].total, 0)
      if (busy.length < 2) continue
      recs.push({
        id: `jadwal-${node.id}-${b.id}`,
        kind: 'jadwal',
        target: 'KAI / operator',
        title: `${node.name.replace(/^Stasiun /, 'St. ').replace(/^Terminal /, 'Term. ')}: kawasan masih hidup saat layanan menipis`,
        body: `Pada blok ${blockLabel(b.id)}, ${busy.length} kawasan di sekitarnya masih ramai — tapi layanan tinggal ${Math.round(
          profile * 100,
        )}% dari jam sibuk (perkiraan jadwal).`,
        action: `Usul: tambah perjalanan pada blok ${blockLabel(b.id)}.`,
        accessNote: accessNoteFor(node.lat, node.lon),
        facts: [
          { label: 'Sel ramai/sedang', value: `${busy.length}` },
          { label: 'Poin kegiatan', value: points.toFixed(1) },
          { label: 'Skor layanan blok', value: `${Math.round(profile * 100)}/100` },
        ],
        focus: { lat: node.lat, lon: node.lon, zoom: 13.5 },
        block: b.id,
        score: busy.length * 2 + points,
      })
    }
  }
  return recs
}

/**
 * Rekomendasi JANGKAUAN: kelompok sel bersebelahan yang ramai (di blok apa pun)
 * tapi >2 km dari semua simpul → kandidat koridor pengumpan / halte baru.
 */
function coverageRecs(model: LajuModel): Recommendation[] {
  const farBusy = model.cells.filter(
    (c) =>
      c.nearestNodeDistM > 2000 &&
      TIME_BLOCKS.some((b) => c.blocks[b.id].cls === 'ramai'),
  )
  const byKey = new Map(farBusy.map((c) => [c.key, c]))
  const visited = new Set<string>()
  const clusters: HexCell[][] = []

  for (const cell of farBusy) {
    if (visited.has(cell.key)) continue
    const cluster: HexCell[] = []
    const queue = [cell]
    visited.add(cell.key)
    while (queue.length) {
      const cur = queue.pop()!
      cluster.push(cur)
      for (const nb of hexNeighbors(cur.id)) {
        const key = hexKey(nb)
        if (!visited.has(key) && byKey.has(key)) {
          visited.add(key)
          queue.push(byKey.get(key)!)
        }
      }
    }
    clusters.push(cluster)
  }

  return clusters
    .filter((cl) => cl.length >= 2)
    .map((cl) => {
      const lat = cl.reduce((s, c) => s + c.center.lat, 0) / cl.length
      const lon = cl.reduce((s, c) => s + c.center.lon, 0) / cl.length

      // blok dominan = blok dengan total poin terbesar di cluster
      let domBlock: BlockId = 'sore'
      let domPts = -1
      for (const b of TIME_BLOCKS) {
        const pts = cl.reduce((s, c) => s + c.blocks[b.id].total, 0)
        if (pts > domPts) {
          domPts = pts
          domBlock = b.id
        }
      }
      const nearest = cl[0].nearestNode
      const avgDist = Math.round(
        cl.reduce((s, c) => s + c.nearestNodeDistM, 0) / cl.length,
      )
      const props = cl.reduce((s, c) => s + c.propertyCount, 0)
      const reports = cl.reduce((s, c) => s + c.evidence.length, 0)
      const evidenceLine =
        props > 0
          ? `${props} titik usaha/hunian tercatat di dalamnya.`
          : `Buktinya ${reports} laporan warga (belum ada titik usaha tercatat).`

      return {
        id: `jangkauan-${cl[0].key}`,
        kind: 'jangkauan' as const,
        target: 'Dishub / KAI',
        title: `Kantong ramai ${(avgDist / 1000).toFixed(1)} km dari ${nearest.name.replace(/^Stasiun |^Terminal /, '')} — kejauhan buat jalan kaki`,
        body: `Satu kawasan seluas ±${(cl.length * 0.22).toFixed(1)} km² ramai (paling hidup blok ${blockLabel(
          domBlock,
        )}), tapi tak satu pun simpul transit dalam jangkauan. ${evidenceLine}`,
        action: `Usul: rute feeder dari kawasan ini menuju ${nearest.name}.`,
        accessNote: accessNoteFor(lat, lon),
        facts: [
          { label: 'Sel ramai', value: `${cl.length}` },
          {
            label: props > 0 ? 'Titik usaha/hunian' : 'Laporan warga',
            value: props > 0 ? `${props}` : `${reports}`,
          },
          { label: 'Jarak rata-rata', value: `${(avgDist / 1000).toFixed(1)} km` },
        ],
        focus: { lat, lon, zoom: 13 },
        block: domBlock,
        // kantong yang padat usaha diprioritaskan di atas kantong laporan-warga
        score: cl.length * 3 + props / 2 + (props > 0 ? 20 : 0),
      }
    })
}

export function buildRecommendations(model: LajuModel): Recommendation[] {
  // Dua jenis rekomendasi dijamin sama-sama tampil — kalau digabung mentah,
  // skor kantong jangkauan (yang membawa bonus kepadatan usaha) selalu
  // menenggelamkan rekomendasi jadwal.
  const coverage = coverageRecs(model).sort((a, b) => b.score - a.score).slice(0, 5)
  const schedule = scheduleRecs(model).sort((a, b) => b.score - a.score).slice(0, 3)
  return [...coverage, ...schedule].sort((a, b) => b.score - a.score)
}

export type { TransitNode }
