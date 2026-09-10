/**
 * Asisten AI SIMPUL — pertanyaan bahasa biasa → jawaban + aksi peta.
 *
 * Masih rule-based (pola pertanyaan yang diantisipasi), belum LLM — tapi
 * kontraknya sudah final: versi LLM tinggal mengganti isi ask() dengan tool
 * use, dan model TIDAK pernah boleh menulis angka sendiri. Semua angka di
 * jawaban ditarik dari model hitungan.
 */

import { TIME_BLOCKS, type BlockId } from './timeblocks'
import { summarizeBlocks, type SimpulModel } from './engine'
import type { Recommendation } from './recommend'

export interface SimpulAnswer {
  answer: string
  /** Kalau terisi: slider peta ikut pindah ke blok ini. */
  setBlock: BlockId | null
  focus: { lat: number; lon: number; zoom: number } | null
  trace: string[]
  facts: { label: string; value: string }[]
}

const blockMeta = (id: BlockId) => TIME_BLOCKS.find((b) => b.id === id)!

function detectBlock(q: string): BlockId | null {
  for (const b of TIME_BLOCKS) if (q.includes(b.id)) return b.id
  if (/\bmalem\b/.test(q)) return 'malam'
  if (/subuh|dini hari|tengah malam/.test(q)) return 'larut'
  const jam = q.match(/jam\s*(\d{1,2})/)
  if (jam) {
    const h = Number(jam[1])
    if (h >= 6 && h < 10) return 'pagi'
    if (h >= 10 && h < 14) return 'siang'
    if (h >= 14 && h < 18) return 'sore'
    if (h >= 18 && h < 22) return 'malam'
    return 'larut'
  }
  return null
}

export function askSimpul(
  question: string,
  model: SimpulModel,
  recs: Recommendation[],
): SimpulAnswer {
  const q = question.toLowerCase().trim()
  const trace: string[] = [`Input: "${question}"`]
  const facts: { label: string; value: string }[] = []
  let setBlock: BlockId | null = detectBlock(q)
  let focus: SimpulAnswer['focus'] = null

  // Bandingkan dua kandidat menurut nomor: "kenapa 1 di atas 2", "bandingkan 3 dan 4".
  const pair = q.match(/(?:kandidat|nomor)?\s*(\d{1,2})\s*(?:dan|vs|di atas|dengan|&)\s*(?:kandidat|nomor)?\s*(\d{1,2})/)
  const detailNo = !pair ? q.match(/kandidat\s*(?:nomor\s*)?(\d{1,2})/) : null

  // Kata umum di nama stasiun yang bukan penanda kawasan ("Dukuh Atas", "Kota", "Bank ...").
  const STOP = new Set(['atas', 'bawah', 'baru', 'lama', 'kota', 'pusat', 'bank', 'indonesia', 'raya', 'timur', 'barat', 'utara', 'selatan', 'jaya', 'bumi', 'syariah', 'dukuh', 'jakarta', 'mandiri', 'central', 'city'])
  const node = model.nodes.find((n) => {
    const words = n.name.toLowerCase().replace(/stasiun|terminal|whoosh/g, '').trim().split(/\s+/)
    return words.some((w) => w.length > 3 && !STOP.has(w) && q.includes(w))
  })
  const wantsRec = /rekomendasi|saran|usul|prioritas|feeder|armada|frekuensi|jalur baru/.test(q)
  const wantsGap = /kesenjangan|gap|tak terjangkau|tidak terlayani|kantong/.test(q)
  const wantsBusy = /ramai|hidup|sibuk|menyala|aktif/.test(q)
  const wantsAfterLast = /setelah kereta terakhir|kereta habis|masih hidup/.test(q)

  trace.push(
    `Intent → blok: ${setBlock ?? '-'} | simpul: ${node?.name ?? '-'} | rekomendasi: ${wantsRec} | gap: ${wantsGap}`,
  )

  const summaries = summarizeBlocks(model)
  let answer: string

  if (pair && recs[Number(pair[1]) - 1] && recs[Number(pair[2]) - 1]) {
    const a = recs[Number(pair[1]) - 1]
    const b = recs[Number(pair[2]) - 1]
    const higher = a.score >= b.score ? a : b
    const cmp = (x: number, y: number) => (x > y ? 'lebih banyak' : x < y ? 'lebih sedikit' : 'sama')
    answer =
      `Kandidat ${pair[1]} (${a.place}) skor ${a.score.toFixed(1)}, kandidat ${pair[2]} (${b.place}) skor ${b.score.toFixed(1)}. ` +
      `Yang lebih tinggi: kandidat ${higher === a ? pair[1] : pair[2]}.\n\n` +
      `Alasannya: kandidat ${pair[1]} punya ${a.cellKeys.length} sel ramai (${cmp(a.cellKeys.length, b.cellKeys.length)} dari ${b.cellKeys.length}) dan ${a.evidenceCount} laporan warga (${cmp(a.evidenceCount, b.evidenceCount)} dari ${b.evidenceCount}); keyakinan ${a.confidence} vs ${b.confidence}` +
      (a.kind !== b.kind ? `; jenisnya berbeda (${a.kind === 'jangkauan' ? 'tak terjangkau' : 'frekuensi rendah'} vs ${b.kind === 'jangkauan' ? 'tak terjangkau' : 'frekuensi rendah'}), dan kantong tak terjangkau diberi bobot lebih besar` : '') +
      `. Skor bukan perkiraan penumpang — hanya urutan bukti terkuat.`
    focus = higher.focus
    if (higher.block) setBlock = higher.block
    facts.push({ label: `Skor #${pair[1]}`, value: a.score.toFixed(1) }, { label: `Skor #${pair[2]}`, value: b.score.toFixed(1) })
    trace.push('Rute: banding dua kandidat (rumus peringkat terbuka)')
  } else if (detailNo && recs[Number(detailNo[1]) - 1]) {
    const r = recs[Number(detailNo[1]) - 1]
    answer = `Kandidat ${detailNo[1]} — ${r.place}: ${r.body}\n\nKeyakinan ${r.confidence}, skor peringkat ${r.score.toFixed(1)}. Usulan untuk ${r.target}: ${r.action.replace(/^Jenis kandidat: /, '')}`
    focus = r.focus
    if (r.block) setBlock = r.block
    facts.push({ label: 'Skor', value: r.score.toFixed(1) }, { label: 'Bukti', value: `${r.evidenceCount}` })
    trace.push('Rute: detail satu kandidat')
  } else if (wantsRec) {
    const top = recs.slice(0, 3)
    answer = top.length
      ? `${recs.length} rekomendasi tersusun dari hitungan. Tiga teratas:\n\n` +
        top.map((r, i) => `${i + 1}. ${r.title} — ${r.body}`).join('\n\n')
      : 'Belum ada rekomendasi yang lolos ambang dari data saat ini.'
    if (top[0]) {
      focus = top[0].focus
      if (top[0].block) setBlock = top[0].block
    }
    trace.push('Rute: daftar rekomendasi (aturan deterministik, bukan karangan)')
  } else if (wantsAfterLast || (setBlock === 'malam' && wantsBusy) || (setBlock === 'larut' && wantsBusy)) {
    const b: BlockId = setBlock ?? 'malam'
    const busy = model.cells
      .filter((c) => c.blocks[b].cls === 'ramai')
      .sort((x, y) => y.blocks[b].total - x.blocks[b].total)
    const gaps = busy.filter((c) => c.blocks[b].gap !== null)
    answer = busy.length
      ? `Pada blok ${blockMeta(b).label} ada ${busy.length} sel kawasan kelas RAMAI. ${gaps.length} di antaranya layanan transitnya rendah pada jam itu — inilah "kawasan yang masih hidup ketika layanan menipis". Peta sudah dipindah ke blok tersebut.`
      : `Pada blok ${blockMeta(b).label} tidak ada sel yang masuk kelas RAMAI dari data yang ada. Ingat: sel abu-abu artinya "tidak ada data", bukan "sepi".`
    if (busy[0]) focus = { ...busy[0].center, zoom: 13 }
    setBlock = b
    facts.push({ label: 'Sel ramai', value: `${busy.length}` }, { label: 'Ber-gap', value: `${gaps.length}` })
    trace.push(`Rute: sel ramai pada blok ${b}`)
  } else if (wantsGap) {
    const jangkauan = recs.filter((r) => r.kind === 'jangkauan')
    answer = jangkauan.length
      ? `Ada ${jangkauan.length} kantong "ramai tapi tak terjangkau" (tidak ada stasiun/halte dalam 1 km). Terbesar: ${jangkauan[0].title.toLowerCase()}. ${jangkauan[0].body}`
      : 'Tidak ditemukan kantong ramai yang benar-benar di luar jangkauan pada data saat ini.'
    if (jangkauan[0]) {
      focus = jangkauan[0].focus
      if (jangkauan[0].block) setBlock = jangkauan[0].block
    }
    trace.push('Rute: kantong kesenjangan jangkauan')
  } else if (node) {
    const near = model.cells.filter((c) => c.nearestNode.id === node.id && c.nearestNodeDistM <= 2000)
    const per = TIME_BLOCKS.map((b) => ({
      b: b.id,
      pts: near.reduce((s, c) => s + c.blocks[b.id].total, 0),
    })).sort((x, y) => y.pts - x.pts)
    const peak = per[0]
    answer = `${node.name}: ${near.length} sel kawasan dalam 2 km. Kegiatan paling tinggi pada blok ${blockMeta(
      peak.b,
    ).label} dengan ${peak.pts.toFixed(1)} poin. Urutan blok dari yang paling hidup: ${per
      .map((p) => blockMeta(p.b).label)
      .join(' → ')}. Peta dipindah ke blok puncaknya.`
    setBlock = peak.b
    focus = { lat: node.lat, lon: node.lon, zoom: 13.5 }
    facts.push({ label: 'Blok puncak', value: blockMeta(peak.b).label })
    trace.push('Rute: profil kawasan satu simpul')
  } else if (wantsBusy && setBlock) {
    const busy = model.cells
      .filter((c) => c.blocks[setBlock!].cls === 'ramai')
      .sort((x, y) => y.blocks[setBlock!].total - x.blocks[setBlock!].total)
    answer = `Pada blok ${blockMeta(setBlock).label} ada ${busy.length} sel kelas RAMAI (25% teratas se-kota). Peta sudah dipindah ke blok itu — sel merah adalah yang paling hidup.`
    if (busy[0]) focus = { ...busy[0].center, zoom: 13 }
    facts.push({ label: 'Sel ramai', value: `${busy.length}` })
    trace.push('Rute: sel ramai per blok')
  } else if (/ringkas|rangkum|gambaran|overview|kondisi/.test(q) || setBlock) {
    const s = summaries.reduce((a, b) => (b.totalPoints > a.totalPoints ? b : a))
    const gapTotal = summaries.reduce((a, b) => a + b.gapJadwal + b.gapJangkauan, 0)
    answer = `Dari ${model.counts.activities.toLocaleString('id-ID')} laporan warga Community Maps: blok paling hidup se-kota adalah ${blockMeta(
      s.block,
    ).label}. Total ${gapTotal} sel×blok menunjukkan kesenjangan (ramai tapi layanan rendah). Geser slider untuk melihat kota "bernapas", atau tanya "rekomendasinya apa".`
    facts.push(
      { label: 'Blok terhidup', value: blockMeta(s.block).label },
      { label: 'Sel ber-gap', value: `${gapTotal}` },
    )
    trace.push('Rute: ringkasan kota')
  } else {
    answer =
      'Belum paham maksudnya (mode aturan). Yang bisa dijawab: "kawasan mana yang ramai malam hari", "bagaimana sekitar Tanah Abang", "mana kantong yang tak terjangkau", "apa rekomendasinya", "kenapa kandidat 1 di atas 2", atau "ringkas kondisinya".'
    trace.push('Rute: fallback')
  }

  trace.push(`Output: narasi + ${setBlock ? `pindah blok ${setBlock}` : 'tanpa pindah blok'}${focus ? ' + fly-to' : ''}`)
  return { answer, setBlock, focus, trace, facts }
}

export const SIMPUL_SUGGESTIONS = [
  'Ringkas kondisinya',
  'Kawasan mana yang masih hidup malam hari?',
  'Bagaimana sekitar Tanah Abang?',
  'Mana kantong ramai yang tak terjangkau?',
  'Apa rekomendasinya untuk KAI?',
]
