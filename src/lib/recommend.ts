/**
 * Penyusun kandidat SIMPUL (PRD: "daftar kandidat berperingkat").
 *
 * Aturannya deterministik dan bisa diaudit — LLM nantinya hanya memperhalus
 * kalimat alasan, TIDAK menentukan isi. Semua angka ditarik dari model.
 *
 * Kedua jenis kesenjangan dibentuk dengan cara yang sama: sel ber-gap yang
 * bersebelahan digabung jadi satu kantong (flood-fill di grid heksagon), lalu
 * diperingkat. Ini menggantikan pendekatan lama "per simpul" yang tidak masuk
 * akal untuk Jabodetabek (ribuan halte).
 */

import type { TransitNode } from './types'
import { hexKey, hexNeighbors } from './hexgrid'
import { TIME_BLOCKS, type BlockId } from './timeblocks'
import type { HexCell, SimpulModel } from './engine'

export type Confidence = 'tinggi' | 'sedang' | 'rendah'

export interface Recommendation {
  id: string
  kind: 'jadwal' | 'jangkauan'
  target: string
  title: string
  body: string
  /** Satu baris usulan konkret (jenis kandidat — tanpa angka armada). */
  action: string
  facts: { label: string; value: string }[]
  focus: { lat: number; lon: number; zoom: number }
  block: BlockId | null
  score: number
  /** PRD: tinggi = banyak observasi, sedang = jarang, rendah = sangat tipis. */
  confidence: Confidence
  evidenceCount: number
  cellKeys: string[]
  nearestNode: TransitNode
}

const blockLabel = (id: BlockId) => {
  const b = TIME_BLOCKS.find((x) => x.id === id)!
  return `${b.label} (${b.range})`
}

const shortName = (n: TransitNode) =>
  n.name.replace(/^Stasiun (MRT |LRT )?/, '').replace(/^Terminal /, 'Term. ')

function clusters(cells: HexCell[]): HexCell[][] {
  const byKey = new Map(cells.map((c) => [c.key, c]))
  const visited = new Set<string>()
  const out: HexCell[][] = []
  for (const cell of cells) {
    if (visited.has(cell.key)) continue
    const cl: HexCell[] = []
    const queue = [cell]
    visited.add(cell.key)
    while (queue.length) {
      const cur = queue.pop()!
      cl.push(cur)
      for (const nb of hexNeighbors(cur.id)) {
        const k = hexKey(nb)
        if (!visited.has(k) && byKey.has(k)) {
          visited.add(k)
          queue.push(byKey.get(k)!)
        }
      }
    }
    out.push(cl)
  }
  return out
}

/** PRD §7: tinggi bila banyak observasi & tervalidasi; sedang bila jarang. */
function confidenceOf(evidence: number, cells: number): Confidence {
  if (evidence >= 8 && cells >= 2) return 'tinggi'
  if (evidence >= 3) return 'sedang'
  return 'rendah'
}

function buildFor(model: SimpulModel, kind: 'jadwal' | 'jangkauan'): Recommendation[] {
  const gapCells = model.cells.filter((c) => TIME_BLOCKS.some((b) => c.blocks[b.id].gap === kind))
  return clusters(gapCells).map((cl) => {
    const lat = cl.reduce((s, c) => s + c.center.lat, 0) / cl.length
    const lon = cl.reduce((s, c) => s + c.center.lon, 0) / cl.length

    // blok dominan = blok dengan poin kegiatan terbesar di antara blok ber-gap
    let domBlock: BlockId = 'pagi'
    let domPts = -1
    for (const b of TIME_BLOCKS) {
      const pts = cl.reduce((s, c) => s + (c.blocks[b.id].gap === kind ? c.blocks[b.id].total : 0), 0)
      if (pts > domPts) {
        domPts = pts
        domBlock = b.id
      }
    }
    const evidence = cl.reduce((s, c) => s + c.evidence.length, 0)
    const nearest = cl[0].nearestNode
    const avgNodeM = Math.round(cl.reduce((s, c) => s + c.nearestNodeDistM, 0) / cl.length)
    const avgTransitM = Math.round(cl.reduce((s, c) => s + c.nearestTransitM, 0) / cl.length)
    const service = cl.reduce((s, c) => s + c.blocks[domBlock].service, 0) / cl.length
    const railDep = Math.round(cl.reduce((s, c) => s + c.blocks[domBlock].railDep, 0) / cl.length)
    const busDep = Math.round(cl.reduce((s, c) => s + c.blocks[domBlock].busDep, 0) / cl.length)
    const confidence = confidenceOf(evidence, cl.length)
    const stopName = cl[0].nearestStop?.name

    const base = {
      id: `${kind}-${cl[0].key}`,
      kind,
      focus: { lat, lon, zoom: 13.5 },
      block: domBlock,
      confidence,
      evidenceCount: evidence,
      cellKeys: cl.map((c) => c.key),
      nearestNode: nearest,
    }

    if (kind === 'jangkauan') {
      return {
        ...base,
        target: 'Dishub / operator feeder',
        title: `Kawasan ramai ${(avgTransitM / 1000).toFixed(1)} km dari layanan terdekat (arah ${shortName(nearest)})`,
        body: `${cl.length} sel bersebelahan tergolong ramai (paling hidup blok ${blockLabel(domBlock)}), tetapi tidak ada stasiun maupun halte dalam jarak jalan kaki 1 km. Bukti: ${evidence} laporan lapangan.`,
        action: `Jenis kandidat: rute pengumpan / halte baru menuju ${nearest.name}.`,
        facts: [
          { label: 'Sel ramai', value: `${cl.length}` },
          { label: 'Bukti', value: `${evidence}` },
          { label: 'Ke layanan', value: `${(avgTransitM / 1000).toFixed(1)} km` },
        ],
        score: cl.length * 3 + evidence,
      }
    }
    return {
      ...base,
      target: railDep >= busDep ? 'KAI Commuter / operator rel' : 'TransJakarta / JakLingko',
      title: `${shortName(nearest)}${stopName ? ` · ${stopName}` : ''}: ramai saat frekuensi rendah`,
      body: `${cl.length} sel di sekitarnya ramai pada blok ${blockLabel(domBlock)}, tetapi skor layanan hanya ${Math.round(
        service * 100,
      )}/100 — ±${railDep} keberangkatan rel dan ±${busDep} keberangkatan bus terjadwal pada blok itu (${(avgNodeM / 1000).toFixed(1)} km ke stasiun terdekat).`,
      action: `Jenis kandidat: penambahan frekuensi pada blok ${blockLabel(domBlock)}.`,
      facts: [
        { label: 'Sel ramai', value: `${cl.length}` },
        { label: 'Bukti', value: `${evidence}` },
        { label: 'Skor layanan', value: `${Math.round(service * 100)}/100` },
      ],
      score: cl.length * 2 + evidence + (1 - service) * 5,
    }
  })
}

export function buildRecommendations(model: SimpulModel): Recommendation[] {
  const jangkauan = buildFor(model, 'jangkauan').sort((a, b) => b.score - a.score)
  const jadwal = buildFor(model, 'jadwal').sort((a, b) => b.score - a.score)
  // PRD: minimal 10 kandidat berperingkat; kedua jenis dijamin tampil.
  const merged = [...jangkauan.slice(0, 8), ...jadwal.slice(0, 8)].sort((a, b) => b.score - a.score)
  return merged.slice(0, 12)
}
