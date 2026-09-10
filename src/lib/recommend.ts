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

export interface Proposal {
  /** Satu kalimat: apa yang sebaiknya dilakukan. */
  summary: string
  /** Langkah konkret berurutan (2–4). */
  steps: string[]
  /** Angka indikatif, tiap item membawa cara hitungnya. */
  estimate: { label: string; value: string; how: string }[]
  /** Usulan rute pengumpan (khusus tak terjangkau) untuk digambar di peta. */
  route?: { from: { lat: number; lon: number; name: string }; to: { lat: number; lon: number }; lengthM: number }
  caveat: string
}

export interface Recommendation {
  id: string
  kind: 'jadwal' | 'jangkauan'
  target: string
  title: string
  /** Nama tempat pendek untuk judul kartu (mis. "Lebak Bulus BSI"). */
  place: string
  /** Satu baris inti kartu (mis. "1,5 km dari layanan terdekat"). */
  headline: string
  body: string
  /** 3 poin singkat "apa yang terjadi" untuk modal detail (pengganti paragraf). */
  highlights: string[]
  /** Satu baris usulan konkret (jenis kandidat). */
  action: string
  /** Usulan tindakan terperinci + perkiraan indikatif (armada/perjalanan). */
  proposal: Proposal
  facts: { label: string; value: string }[]
  focus: { lat: number; lon: number; zoom: number }
  block: BlockId | null
  score: number
  /** PRD: tinggi = banyak observasi, sedang = jarang, rendah = sangat tipis. */
  confidence: Confidence
  /**
   * Dasar peringkat, ditulis terbuka supaya pengguna tahu "prioritas ini
   * berdasarkan apa": rumus + angkanya untuk kantong ini.
   */
  rankBasis: string
  evidenceCount: number
  cellKeys: string[]
  nearestNode: TransitNode
}

/** Lama blok (jam) untuk mengubah "keberangkatan per blok" ↔ headway. */
const BLOCK_HOURS: Record<BlockId, number> = { pagi: 4, siang: 4, sore: 4, malam: 4, larut: 8 }

/** Target layanan wajar untuk kawasan ramai: skor 60/100 dari acuan simpul tersibuk. */
const TARGET_SERVICE = 0.6

const fmtMin = (m: number) => (m >= 1 ? `${Math.round(m)} menit` : '< 1 menit')

const blockLabel = (id: BlockId) => {
  const b = TIME_BLOCKS.find((x) => x.id === id)!
  return b.label
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
      // Usulan rute pengumpan: dari layanan terdekat (halte kalau lebih dekat, kalau tidak stasiun) ke pusat kantong.
      const stop = cl[0].nearestStop
      const useStop = !!stop && cl[0].nearestStopDistM < cl[0].nearestNodeDistM
      const from = useStop ? { lat: stop!.lat, lon: stop!.lon, name: `Halte ${stop!.name}` } : { lat: nearest.lat, lon: nearest.lon, name: nearest.name }
      const lengthM = Math.max(avgTransitM, 500)
      const hours = BLOCK_HOURS[domBlock]
      const headway = 15
      const cycleMin = (2 * lengthM) / 1000 / 15 * 60 + 10 // 15 km/jam di jalan lokal + 10 menit layover
      const fleet = Math.max(1, Math.ceil(cycleMin / headway))
      const tripsPerBlock = Math.round((hours * 60) / headway) * 2
      const proposal: Proposal = {
        summary: `Buka rute pengumpan (mikrobus/JakLingko) sepanjang ±${(lengthM / 1000).toFixed(1).replace('.', ',')} km dari ${from.name} ke kawasan ini, dengan halte pemberhentian di dalam kantong.`,
        steps: [
          `Verifikasi lapangan pada blok ${blockLabel(domBlock)}: hitung penumpang potensial di ${cl.length} sel ini (${evidence} laporan warga sudah ada).`,
          `Tetapkan titik henti di dalam kantong (jarak jalan kaki ≤ 500 m) dan rute ke ${from.name}.`,
          `Uji coba ${fleet} unit dengan headway ${headway} menit pada blok ${blockLabel(domBlock)}; evaluasi okupansi setelah 4–6 minggu.`,
        ],
        estimate: [
          { label: 'Armada uji coba', value: `${fleet} unit`, how: `Siklus PP ≈ ${Math.round(cycleMin)} menit (2 × ${(lengthM / 1000).toFixed(1)} km @ 15 km/jam + 10 menit layover) ÷ headway ${headway} menit, dibulatkan ke atas.` },
          { label: 'Perjalanan/blok', value: `±${tripsPerBlock}`, how: `${hours} jam × 60 ÷ ${headway} menit × 2 arah.` },
          { label: 'Panjang rute', value: `±${(lengthM / 1000).toFixed(1)} km`, how: 'Jarak lurus rata-rata sel ke layanan terdekat; jalur jalan sebenarnya bisa lebih panjang.' },
        ],
        route: { from, to: { lat, lon }, lengthM },
        caveat: 'Angka indikatif untuk memulai kajian, bukan rencana operasi. Kapasitas, tarif, dan trayek final ditentukan operator dan Dishub.',
      }
      return {
        ...base,
        proposal,
        highlights: [
          `${cl.length} sel bersebelahan tergolong ramai, paling hidup pada blok ${blockLabel(domBlock)}`,
          `Tidak ada stasiun/halte dalam 1 km — yang terdekat ${(avgTransitM / 1000).toFixed(1).replace('.', ',')} km (${shortName(nearest)})`,
          `${evidence} laporan warga menjadi bukti`,
        ],
        target: 'TransJakarta / JakLingko (rute pengumpan) · Dishub',
        title: `Kawasan ramai ${(avgTransitM / 1000).toFixed(1)} km dari layanan terdekat (arah ${shortName(nearest)})`,
        place: `Arah ${shortName(nearest)}`,
        headline: `${(avgTransitM / 1000).toFixed(1).replace('.', ',')} km dari stasiun/halte terdekat`,
        body: `${cl.length} sel bersebelahan tergolong ramai (paling hidup blok ${blockLabel(domBlock)}), tetapi tidak ada stasiun maupun halte dalam jarak jalan kaki 1 km. Bukti: ${evidence} laporan lapangan.`,
        action: `Jenis kandidat: rute pengumpan / halte baru menuju ${nearest.name}.`,
        facts: [
          { label: 'Sel ramai', value: `${cl.length}` },
          { label: 'Bukti', value: `${evidence}` },
          { label: 'Ke layanan', value: `${(avgTransitM / 1000).toFixed(1)} km` },
        ],
        score: cl.length * 3 + evidence,
        rankBasis: `3 × ${cl.length} sel + ${evidence} bukti = ${cl.length * 3 + evidence}`,
      }
    }
    const railTarget = railDep >= busDep
    const hours = BLOCK_HOURS[domBlock]
    const ref = railTarget ? model.refDep.rail[domBlock] : model.refDep.bus[domBlock]
    const nowDep = railTarget ? railDep : busDep
    const targetDep = Math.ceil(TARGET_SERVICE * ref)
    const extra = Math.max(0, targetDep - nowDep)
    const headwayNow = nowDep > 0 ? (hours * 60) / (nowDep / 2) : Infinity
    const headwayTarget = (hours * 60) / (targetDep / 2)
    const cycleMin = railTarget ? 120 : 90 // asumsi siklus PP rangkaian KRL / bus koridor
    const fleet = Math.max(1, Math.ceil(((extra / 2) * cycleMin) / (hours * 60)))
    const moda = railTarget ? 'kereta' : 'bus'
    const proposal: Proposal = {
      summary: `Rapatkan jadwal ${moda} di ${shortName(nearest)}${stopName && !railTarget ? ` / halte ${stopName}` : ''} pada blok ${blockLabel(domBlock)}: dari ±${nowDep} menjadi ±${targetDep} keberangkatan (headway ${fmtMin(headwayNow)} → ${fmtMin(headwayTarget)}).`,
      steps: [
        `Cek okupansi ${moda} di ${shortName(nearest)} pada blok ${blockLabel(domBlock)} — kawasan sekitarnya ramai (${evidence} laporan) tetapi skor layanan ${Math.round(service * 100)}/100.`,
        `Tambah ±${extra} keberangkatan per blok (dua arah) supaya skor layanan naik ke ≥ ${Math.round(TARGET_SERVICE * 100)}/100.`,
        railTarget ? `Bila jalur padat, alternatifnya perpanjang perjalanan yang sudah ada atau tambah pengumpan bus ke stasiun lain.` : `Bila armada terbatas, prioritaskan jam puncak dalam blok itu dulu.`,
      ],
      estimate: [
        { label: 'Tambahan keberangkatan', value: `+${extra}/blok`, how: `Target ${Math.round(TARGET_SERVICE * 100)}/100 × acuan ${ref} keberangkatan (simpul tersibuk pada blok ini) = ${targetDep}; dikurangi ±${nowDep} yang ada sekarang.` },
        { label: railTarget ? 'Rangkaian tambahan' : 'Armada tambahan', value: `≈ ${fleet}`, how: `(${extra} ÷ 2 arah) × siklus PP ${cycleMin} menit ÷ (${hours} jam × 60 menit), dibulatkan ke atas. Siklus adalah asumsi umum, bukan data operator.` },
        { label: 'Headway', value: `${fmtMin(headwayNow)} → ${fmtMin(headwayTarget)}`, how: `${hours} jam × 60 ÷ (keberangkatan per blok ÷ 2 arah).` },
      ],
      caveat: 'Angka indikatif untuk membuka pembicaraan dengan operator; ketersediaan rangkaian, slot jalur, dan biaya tidak dihitung SIMPUL.',
    }
    return {
      ...base,
      proposal,
      highlights: [
        `${cl.length} sel di sekitar ${shortName(nearest)} ramai pada blok ${blockLabel(domBlock)}`,
        `Skor layanan hanya ${Math.round(service * 100)}/100: ±${railDep} kereta dan ±${busDep} bus pada blok itu`,
        `${evidence} laporan warga menjadi bukti · ${(avgNodeM / 1000).toFixed(1).replace('.', ',')} km ke stasiun terdekat`,
      ],
      target: railTarget ? 'KAI Commuter / operator rel' : 'TransJakarta / JakLingko',
      title: `${shortName(nearest)}${stopName ? ` · ${stopName}` : ''}: ramai saat frekuensi rendah`,
      place: `${shortName(nearest)}${stopName ? ` · ${stopName}` : ''}`,
      headline: `Skor layanan ${Math.round(service * 100)}/100 saat ramai (${blockLabel(domBlock)})`,
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
      rankBasis: `2 × ${cl.length} sel + ${evidence} bukti + 5 × (1 − ${service.toFixed(2)} layanan) = ${(
        cl.length * 2 +
        evidence +
        (1 - service) * 5
      ).toFixed(1)}`,
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
