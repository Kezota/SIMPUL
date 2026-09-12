/**
 * Penyusun kandidat SIMPUL (PRD: "daftar kandidat berperingkat").
 *
 * Aturannya deterministik dan bisa diaudit. LLM hanya memperhalus kalimat,
 * TIDAK menentukan isi. Semua angka ditarik dari model.
 *
 * Dua tingkat:
 *   prioritas = petak RAMAI (25% teratas) yang layanannya kurang;
 *   pantau    = petak tingkat SEDANG yang layanannya tipis (belum mendesak).
 * Petak yang bersebelahan digabung jadi satu kantong (flood-fill heksagon),
 * lalu diperingkat.
 */

import type { TransitNode } from './types'
import { hexKey, hexNeighbors } from './hexgrid'
import { TIME_BLOCKS, type BlockId } from './timeblocks'
import { WALK_M, type HexCell, type SimpulModel } from './engine'

export type Confidence = 'tinggi' | 'sedang' | 'rendah'
export type Tier = 'prioritas' | 'pantau'
export type GapKind = 'jadwal' | 'jangkauan'

export interface Proposal {
  /** Satu kalimat: apa yang sebaiknya dilakukan (dipakai asisten). */
  summary: string
  /** Versi terbaca: judul tindakan pendek + poin angka. */
  headline: string
  points: { label: string; value: string }[]
  /** Langkah konkret berurutan. */
  steps: string[]
  /** Angka indikatif; tiap item membawa cara hitungnya dalam bahasa biasa. */
  estimate: { label: string; value: string; how: string }[]
  /** Usulan rute pengumpan (khusus tak terjangkau) untuk digambar di peta. */
  route?: { from: { lat: number; lon: number; name: string }; to: { lat: number; lon: number }; lengthM: number }
  caveat: string
}

export interface Recommendation {
  id: string
  kind: GapKind
  tier: Tier
  /** Instansi yang wajar menindaklanjuti. */
  target: string
  /** Nama pendek instansi untuk pengelompokan. */
  targetShort: 'KAI Commuter' | 'TransJakarta'
  title: string
  /** Nama tempat pendek untuk judul kartu. */
  place: string
  /** Satu baris inti kartu. */
  headline: string
  body: string
  /** 3 poin singkat "apa yang terjadi". */
  highlights: string[]
  action: string
  proposal: Proposal
  facts: { label: string; value: string }[]
  focus: { lat: number; lon: number; zoom: number }
  block: BlockId | null
  score: number
  confidence: Confidence
  rankBasis: string
  /** Dasar peringkat dipecah jadi poin pendek. */
  rankParts: string[]
  evidenceCount: number
  cellKeys: string[]
  nearestNode: TransitNode
}

/** Lama blok (jam) untuk mengubah "keberangkatan per blok" menjadi jeda antar keberangkatan. */
const BLOCK_HOURS: Record<BlockId, number> = { pagi: 4, siang: 4, sore: 4, malam: 4, larut: 8 }

/** Target layanan wajar untuk kawasan ramai: 60% dari simpul tersibuk. */
const TARGET_SERVICE = 0.6

const fmtMin = (m: number) => (Number.isFinite(m) ? (m >= 1 ? `${Math.round(m)} menit` : 'kurang dari 1 menit') : 'tidak ada')
const km = (m: number) => (m / 1000).toFixed(1).replace('.', ',')

const blockLabel = (id: BlockId) => TIME_BLOCKS.find((x) => x.id === id)!.label

const shortName = (n: TransitNode) => n.name.replace(/^Stasiun (MRT |LRT )?/, '').replace(/^Terminal /, 'Term. ')

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

/** PRD §7: tinggi bila banyak observasi dan tervalidasi; sedang bila jarang. */
function confidenceOf(evidence: number, cells: number): Confidence {
  if (evidence >= 8 && cells >= 2) return 'tinggi'
  if (evidence >= 3) return 'sedang'
  return 'rendah'
}

function buildFor(model: SimpulModel, kind: GapKind, tier: Tier): Recommendation[] {
  const flagged = (c: HexCell, b: BlockId) =>
    tier === 'prioritas' ? c.blocks[b].gap === kind : c.blocks[b].watch && (c.nearestTransitM > WALK_M ? 'jangkauan' : 'jadwal') === kind
  const pool =
    tier === 'prioritas'
      ? model.cells
      : model.cells.filter((c) => !TIME_BLOCKS.some((b) => c.blocks[b.id].gap)) // sudah prioritas, jangan dihitung dua kali
  const gapCells = pool.filter((c) => TIME_BLOCKS.some((b) => flagged(c, b.id)))

  return clusters(gapCells).map((cl) => {
    const lat = cl.reduce((s, c) => s + c.center.lat, 0) / cl.length
    const lon = cl.reduce((s, c) => s + c.center.lon, 0) / cl.length

    // Blok dominan = blok dengan poin kegiatan terbesar di antara blok yang bermasalah.
    let domBlock: BlockId = 'pagi'
    let domPts = -1
    for (const b of TIME_BLOCKS) {
      const pts = cl.reduce((s, c) => s + (flagged(c, b.id) ? c.blocks[b.id].total : 0), 0)
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
    const blok = blockLabel(domBlock)
    const petak = `${cl.length} petak`
    const levelWord = tier === 'prioritas' ? 'ramai' : 'cukup ramai (tingkat sedang)'

    const base = {
      id: `${tier}-${kind}-${cl[0].key}`,
      kind,
      tier,
      focus: { lat, lon, zoom: 13.5 },
      block: domBlock,
      confidence,
      evidenceCount: evidence,
      cellKeys: cl.map((c) => c.key),
      nearestNode: nearest,
    }

    if (kind === 'jangkauan') {
      // Usulan rute pengumpan dari layanan terdekat (halte kalau lebih dekat, kalau tidak stasiun) ke pusat kantong.
      const stop = cl[0].nearestStop
      const useStop = !!stop && cl[0].nearestStopDistM < cl[0].nearestNodeDistM
      const from = useStop ? { lat: stop!.lat, lon: stop!.lon, name: `Halte ${stop!.name}` } : { lat: nearest.lat, lon: nearest.lon, name: nearest.name }
      const lengthM = Math.max(avgTransitM, 500)
      const hours = BLOCK_HOURS[domBlock]
      const headway = 15
      const cycleMin = ((2 * lengthM) / 1000 / 15) * 60 + 10 // 15 km/jam di jalan lokal + 10 menit istirahat
      const fleet = Math.max(1, Math.ceil(cycleMin / headway))
      const tripsPerBlock = Math.round((hours * 60) / headway) * 2
      const proposal: Proposal = {
        summary: `Buka rute pengumpan (mikrobus atau JakLingko) sekitar ${km(lengthM)} km dari ${from.name} ke kawasan ini, dengan pemberhentian di dalam kawasan.`,
        headline: 'Buka rute pengumpan baru',
        points: [
          { label: 'Dari', value: from.name },
          { label: 'Panjang', value: `sekitar ${km(lengthM)} km, berhenti di dalam kawasan` },
          { label: 'Uji coba', value: `${fleet} unit, tiap ${headway} menit, blok ${blok}` },
        ],
        steps: [
          tier === 'prioritas'
            ? `Cek lapangan pada blok ${blok}: hitung calon penumpang di ${petak} ini. Sudah ada ${evidence} laporan warga sebagai dasar.`
            : `Tambah survei lapangan pada blok ${blok}. Baru ${evidence} laporan dan keramaiannya tingkat sedang, jadi pastikan dulu kebutuhannya.`,
          `Tentukan titik henti di dalam kawasan (jarak jalan kaki paling jauh 500 m) dan jalur ke ${from.name}.`,
          `Uji coba ${fleet} unit dengan bus lewat tiap ${headway} menit pada blok ${blok}. Nilai keterisian setelah 4 sampai 6 minggu.`,
        ],
        estimate: [
          {
            label: 'Armada uji coba',
            value: `${fleet} unit`,
            how: `Satu perjalanan pulang pergi kira-kira ${Math.round(cycleMin)} menit: jarak ${km(lengthM)} km pergi dan pulang dengan kecepatan 15 km/jam, ditambah 10 menit istirahat. Supaya ada bus tiap ${headway} menit, butuh ${fleet} unit.`,
          },
          {
            label: 'Perjalanan per blok',
            value: `sekitar ${tripsPerBlock}`,
            how: `Kalau bus lewat tiap ${headway} menit selama ${hours} jam untuk dua arah, jadinya sekitar ${tripsPerBlock} perjalanan.`,
          },
          {
            label: 'Panjang rute',
            value: `sekitar ${km(lengthM)} km`,
            how: 'Jarak garis lurus dari kawasan ke layanan terdekat. Jalan sebenarnya biasanya lebih panjang.',
          },
        ],
        route: { from, to: { lat, lon }, lengthM },
        caveat: 'Angka kasar untuk memulai kajian, bukan rencana operasi. Kapasitas, tarif, dan trayek final ditentukan operator dan Dishub.',
      }
      const score = cl.length * 3 + evidence
      return {
        ...base,
        proposal,
        highlights: [
          `${petak} bersebelahan tergolong ${levelWord}, paling hidup pada blok ${blok}.`,
          `Tidak ada stasiun atau halte dalam 1 km. Yang terdekat ${km(avgTransitM)} km, ke arah ${shortName(nearest)}.`,
          `${evidence} laporan warga menjadi bukti.`,
        ],
        target: 'TransJakarta / JakLingko (rute pengumpan) · Dishub',
        targetShort: 'TransJakarta' as const,
        title: `Kawasan ${levelWord} ${km(avgTransitM)} km dari layanan terdekat (arah ${shortName(nearest)})`,
        place: `Arah ${shortName(nearest)}`,
        headline: `${km(avgTransitM)} km dari stasiun atau halte terdekat`,
        body: `${petak} bersebelahan tergolong ${levelWord} (paling hidup blok ${blok}), tetapi tidak ada stasiun maupun halte dalam jarak jalan kaki 1 km. Bukti: ${evidence} laporan warga.`,
        action: `Jenis kandidat: rute pengumpan atau halte baru menuju ${nearest.name}.`,
        facts: [
          { label: 'Petak', value: `${cl.length}` },
          { label: 'Bukti', value: `${evidence}` },
          { label: 'Ke layanan', value: `${km(avgTransitM)} km` },
        ],
        score,
        rankBasis: `${cl.length} petak dan ${evidence} laporan; kawasan tak terjangkau diberi bobot lebih besar. Skor ${score}.`,
        rankParts: [`${cl.length} petak bersebelahan`, `${evidence} laporan warga`, 'Tak terjangkau diberi bobot lebih besar', `Skor ${score}`],
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
    const cycleMin = railTarget ? 120 : 90 // asumsi siklus pulang pergi rangkaian KRL / bus koridor
    const fleet = Math.max(1, Math.ceil(((extra / 2) * cycleMin) / (hours * 60)))
    const moda = railTarget ? 'kereta' : 'bus'
    const unit = railTarget ? 'rangkaian' : 'armada'
    const where = `${shortName(nearest)}${stopName && !railTarget ? ` / halte ${stopName}` : ''}`
    const proposal: Proposal = {
      summary: `Rapatkan jadwal ${moda} di ${where} pada blok ${blok}: dari sekitar ${nowDep} menjadi ${targetDep} keberangkatan, sehingga jedanya turun dari ${fmtMin(headwayNow)} ke ${fmtMin(headwayTarget)}.`,
      headline: `Rapatkan jadwal ${moda} di ${where}`,
      points: [
        { label: 'Kapan', value: `blok ${blok}` },
        { label: 'Keberangkatan', value: `sekitar ${nowDep} menjadi ${targetDep} per blok` },
        { label: 'Jeda', value: `${fmtMin(headwayNow)} menjadi ${fmtMin(headwayTarget)}` },
      ],
      steps: [
        tier === 'prioritas'
          ? `Cek keterisian ${moda} di ${where} pada blok ${blok}. Kawasan sekitarnya ramai (${evidence} laporan) tetapi skor layanan baru ${Math.round(service * 100)} dari 100.`
          : `Tambah survei di sekitar ${where} pada blok ${blok}. Keramaiannya tingkat sedang (${evidence} laporan), jadi pastikan dulu kebutuhannya.`,
        `Tambah sekitar ${extra} keberangkatan per blok (dua arah) supaya skor layanan naik ke ${Math.round(TARGET_SERVICE * 100)} dari 100.`,
        railTarget
          ? 'Kalau jalurnya sudah padat, alternatifnya perpanjang perjalanan yang ada atau tambah bus pengumpan ke stasiun lain.'
          : 'Kalau armada terbatas, dahulukan jam paling sibuk di dalam blok itu.',
      ],
      estimate: [
        {
          label: 'Tambahan keberangkatan',
          value: `${extra} per blok`,
          how: `Tempat tersibuk pada jam ini punya ${ref} keberangkatan. Kami targetkan 60 persennya, yaitu ${targetDep}. Sekarang baru ${nowDep}, jadi kurang ${extra}.`,
        },
        {
          label: `${unit[0].toUpperCase()}${unit.slice(1)} tambahan`,
          value: `sekitar ${fleet}`,
          how: `Satu perjalanan pulang pergi kami anggap ${cycleMin} menit. Untuk menambah ${extra} keberangkatan dalam ${hours} jam, butuh kira-kira ${fleet} ${unit} tambahan. Ini asumsi umum, bukan data operator.`,
        },
        {
          label: 'Jeda keberangkatan',
          value: `${fmtMin(headwayNow)} menjadi ${fmtMin(headwayTarget)}`,
          how: `Sekarang ${moda} datang tiap ${fmtMin(headwayNow)}. Kalau targetnya tercapai, jadi tiap ${fmtMin(headwayTarget)}.`,
        },
      ],
      caveat: 'Angka kasar untuk membuka pembicaraan dengan operator. Ketersediaan rangkaian, slot jalur, dan biaya tidak dihitung SIMPUL.',
    }
    const score = cl.length * 2 + evidence + (1 - service) * 5
    return {
      ...base,
      proposal,
      highlights: [
        `${petak} di sekitar ${shortName(nearest)} tergolong ${levelWord} pada blok ${blok}.`,
        `Skor layanan baru ${Math.round(service * 100)} dari 100: sekitar ${railDep} kereta dan ${busDep} bus pada blok itu.`,
        `${evidence} laporan warga menjadi bukti. Stasiun terdekat ${km(avgNodeM)} km.`,
      ],
      target: railTarget ? 'KAI Commuter / operator rel' : 'TransJakarta / JakLingko',
      targetShort: railTarget ? ('KAI Commuter' as const) : ('TransJakarta' as const),
      title: `${where}: ${levelWord} saat jadwal jarang`,
      place: where,
      headline: `Skor layanan ${Math.round(service * 100)} dari 100 saat ramai (${blok})`,
      body: `${petak} di sekitarnya tergolong ${levelWord} pada blok ${blok}, tetapi skor layanan baru ${Math.round(service * 100)} dari 100: sekitar ${railDep} keberangkatan kereta dan ${busDep} bus terjadwal pada blok itu (${km(avgNodeM)} km ke stasiun terdekat).`,
      action: `Jenis kandidat: penambahan frekuensi pada blok ${blok}.`,
      facts: [
        { label: 'Petak', value: `${cl.length}` },
        { label: 'Bukti', value: `${evidence}` },
        { label: 'Skor layanan', value: `${Math.round(service * 100)}/100` },
      ],
      score,
      rankBasis: `${cl.length} petak, ${evidence} laporan, dan layanan ${Math.round(service * 100)} dari 100; makin tipis layanan, makin tinggi urutannya. Skor ${score.toFixed(1)}.`,
      rankParts: [`${cl.length} petak bersebelahan`, `${evidence} laporan warga`, `Skor layanan ${Math.round(service * 100)} dari 100 (makin tipis, makin tinggi urutannya)`, `Skor ${score.toFixed(1)}`],
    }
  })
}

const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score

export function buildRecommendations(model: SimpulModel): Recommendation[] {
  // Prioritas: kedua jenis dijamin tampil, paling banyak 12.
  const prioritas = [...buildFor(model, 'jangkauan', 'prioritas').sort(byScore).slice(0, 8), ...buildFor(model, 'jadwal', 'prioritas').sort(byScore).slice(0, 8)]
    .sort(byScore)
    .slice(0, 12)
  // Pantau: paling banyak 10, nomornya melanjutkan nomor prioritas.
  const pantau = [...buildFor(model, 'jangkauan', 'pantau'), ...buildFor(model, 'jadwal', 'pantau')].sort(byScore).slice(0, 10)
  return [...prioritas, ...pantau]
}
