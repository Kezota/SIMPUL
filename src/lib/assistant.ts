/**
 * Asisten aturan SIMPUL: pertanyaan bahasa biasa → jawaban + aksi peta,
 * tanpa LLM. Dipakai untuk pertanyaan rutin (instan) dan sebagai cadangan
 * ketika Gemini tidak bisa dihubungi. Semua angka dari model hitungan.
 */

import { TIME_BLOCKS, type BlockId } from './timeblocks'
import { summarizeBlocks, type SimpulModel } from './engine'
import type { Recommendation } from './recommend'

export interface SimpulAnswer {
  answer: string
  /** Kalau terisi: peta ikut pindah ke blok ini. */
  setBlock: BlockId | null
  focus: { lat: number; lon: number; zoom: number } | null
  trace: string[]
  facts: { label: string; value: string }[]
}

const blockMeta = (id: BlockId) => TIME_BLOCKS.find((b) => b.id === id)!
const KIND = { jangkauan: 'tak terjangkau', jadwal: 'frekuensi rendah' } as const

function detectBlock(q: string): BlockId | null {
  for (const b of TIME_BLOCKS) if (q.includes(b.id)) return b.id
  if (/\bmalem\b/.test(q)) return 'malam'
  if (/subuh|dini hari|tengah malam|setelah jam 22|di atas jam 22|lewat jam 22/.test(q)) return 'larut'
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

const listRecs = (rs: Recommendation[], all: Recommendation[]) =>
  rs
    .map((r) => `${all.indexOf(r) + 1}. ${r.place}${r.tier === 'pantau' ? ' (perlu dipantau)' : ''}: ${r.headline}. ${r.evidenceCount} laporan, keyakinan ${r.confidence}.`)
    .join('\n')

export function askSimpul(question: string, model: SimpulModel, recs: Recommendation[]): SimpulAnswer {
  const q = question.toLowerCase().trim()
  const trace: string[] = [`Input: "${question}"`]
  const facts: { label: string; value: string }[] = []
  let setBlock: BlockId | null = detectBlock(q)
  let focus: SimpulAnswer['focus'] = null
  const prioritas = recs.filter((r) => r.tier === 'prioritas')

  // Bandingkan dua kandidat menurut nomor: "kenapa 1 di atas 2", "bandingkan 3 dan 4".
  const pair = q.match(/(?:kandidat|nomor)?\s*(\d{1,2})\s*(?:dan|vs|di atas|dengan|&)\s*(?:kandidat|nomor)?\s*(\d{1,2})/)
  const detailNo = !pair ? q.match(/kandidat\s*(?:nomor\s*)?(\d{1,2})/) : null

  // Kata umum di nama stasiun yang bukan penanda kawasan ("Dukuh Atas", "Kota", "Bank ...").
  const STOP = new Set(['atas', 'bawah', 'baru', 'lama', 'kota', 'pusat', 'bank', 'indonesia', 'raya', 'timur', 'barat', 'utara', 'selatan', 'jaya', 'bumi', 'syariah', 'dukuh', 'jakarta', 'mandiri', 'central', 'city'])
  const node = model.nodes.find((n) => {
    const words = n.name.toLowerCase().replace(/stasiun|terminal|whoosh/g, '').trim().split(/\s+/)
    return words.some((w) => w.length > 3 && !STOP.has(w) && q.includes(w))
  })
  const wantsRail = /kai|kereta|krl|stasiun/.test(q)
  const wantsBus = /transjakarta|tj\b|bus|halte|mikrotrans|jaklingko|pengumpan|feeder/.test(q)
  const wantsCount = /berapa|jumlah/.test(q)
  const wantsConf = /keyakinan|yakin|paling kuat|paling meyakinkan/.test(q)
  const wantsBlockGap = /blok (waktu )?mana|jam (berapa|mana)/.test(q) && /kesenjangan|gap|kurang|tipis|masalah/.test(q)
  const wantsFreq = /frekuensi|tambah(an)? (kereta|bus|jadwal|keberangkatan)|jadwal (tipis|jarang)|rapatkan/.test(q)
  const wantsFeeder = /pengumpan|feeder|mikrotrans|rute baru|halte baru|jalur baru|tak terjangkau|tidak terjangkau|jauh dari/.test(q)
  const wantsRec = /rekomendasi|saran|usul|prioritas|armada|kandidat|apa yang harus/.test(q)
  const wantsGap = /kesenjangan|gap|tidak terlayani|kantong/.test(q)
  const wantsBusy = /ramai|hidup|sibuk|menyala|aktif/.test(q)
  const wantsAfterLast = /setelah kereta terakhir|kereta habis|masih hidup|masih ramai/.test(q)
  const wantsSummary = /ringkas|rangkum|gambaran|overview|kondisi|situasi/.test(q)

  trace.push(`Maksud: blok ${setBlock ?? '-'} | stasiun ${node?.name ?? '-'} | kandidat ${wantsRec} | kesenjangan ${wantsGap}`)

  const summaries = summarizeBlocks(model)
  let answer: string

  const focusOn = (r?: Recommendation) => {
    if (!r) return
    focus = r.focus
    if (r.block) setBlock = r.block
  }

  if (pair && recs[Number(pair[1]) - 1] && recs[Number(pair[2]) - 1]) {
    const a = recs[Number(pair[1]) - 1]
    const b = recs[Number(pair[2]) - 1]
    const higher = a.score >= b.score ? a : b
    const cmp = (x: number, y: number) => (x > y ? 'lebih banyak' : x < y ? 'lebih sedikit' : 'sama')
    answer =
      `Kandidat ${pair[1]} (${a.place}) skor ${a.score.toFixed(1)}, kandidat ${pair[2]} (${b.place}) skor ${b.score.toFixed(1)}. ` +
      `Yang lebih tinggi: kandidat ${higher === a ? pair[1] : pair[2]}.\n\n` +
      `Alasannya: kandidat ${pair[1]} punya ${a.cellKeys.length} petak (${cmp(a.cellKeys.length, b.cellKeys.length)} dari ${b.cellKeys.length}) dan ${a.evidenceCount} laporan warga (${cmp(a.evidenceCount, b.evidenceCount)} dari ${b.evidenceCount}); keyakinan ${a.confidence} dan ${b.confidence}` +
      (a.kind !== b.kind ? `; jenisnya berbeda (${KIND[a.kind]} dan ${KIND[b.kind]}), dan kawasan tak terjangkau diberi bobot lebih besar` : '') +
      (a.tier !== b.tier ? `; kandidat ${a.tier === 'prioritas' ? pair[1] : pair[2]} masuk tingkat prioritas, yang satunya baru perlu dipantau` : '') +
      `. Skor bukan perkiraan penumpang, hanya urutan bukti terkuat.`
    focusOn(higher)
    facts.push({ label: `Skor #${pair[1]}`, value: a.score.toFixed(1) }, { label: `Skor #${pair[2]}`, value: b.score.toFixed(1) })
    trace.push('Rute: banding dua kandidat')
  } else if (detailNo && recs[Number(detailNo[1]) - 1]) {
    const r = recs[Number(detailNo[1]) - 1]
    answer = `Kandidat ${detailNo[1]}, ${r.place} (${KIND[r.kind]}, ${r.tier === 'prioritas' ? 'prioritas' : 'perlu dipantau'}).\n\n${r.highlights.join(' ')}\n\nUsulan untuk ${r.target}: ${r.proposal.summary}\n\nKeyakinan ${r.confidence}.`
    focusOn(r)
    facts.push({ label: 'Skor', value: r.score.toFixed(1) }, { label: 'Bukti', value: `${r.evidenceCount}` })
    trace.push('Rute: detail satu kandidat')
  } else if (wantsConf && (wantsRec || /kandidat/.test(q))) {
    const top = recs.filter((r) => r.confidence === 'tinggi')
    answer = top.length
      ? `${top.length} kandidat berkeyakinan tinggi (8 laporan atau lebih di dua petak bersebelahan):\n\n${listRecs(top, recs)}`
      : `Belum ada kandidat berkeyakinan tinggi. Yang paling kuat: kandidat 1 (${recs[0]?.place ?? '-'}) dengan keyakinan ${recs[0]?.confidence ?? '-'}.`
    focusOn(top[0] ?? recs[0])
    facts.push({ label: 'Keyakinan tinggi', value: `${top.length}` })
    trace.push('Rute: kandidat menurut keyakinan')
  } else if (wantsCount && /kandidat/.test(q)) {
    const kai = prioritas.filter((r) => r.targetShort === 'KAI Commuter')
    const tj = prioritas.filter((r) => r.targetShort === 'TransJakarta')
    const pantau = recs.length - prioritas.length
    answer = `Ada ${prioritas.length} kandidat prioritas: ${kai.length} untuk KAI Commuter (frekuensi kereta) dan ${tj.length} untuk TransJakarta/JakLingko (rute pengumpan atau frekuensi bus). Di luar itu ${pantau} kawasan perlu dipantau karena keramaiannya baru tingkat sedang.`
    facts.push({ label: 'KAI', value: `${kai.length}` }, { label: 'TransJakarta', value: `${tj.length}` }, { label: 'Pantau', value: `${pantau}` })
    trace.push('Rute: jumlah kandidat per instansi')
  } else if (wantsBlockGap) {
    const s = [...summaries].sort((a, b) => b.gapJadwal + b.gapJangkauan - (a.gapJadwal + a.gapJangkauan))[0]
    answer = `Kesenjangan paling banyak pada blok ${blockMeta(s.block).label}: ${s.gapJadwal + s.gapJangkauan} petak ramai yang layanannya kurang (${s.gapJangkauan} tak terjangkau, ${s.gapJadwal} frekuensi rendah). Urutan blok: ${[...summaries]
      .sort((a, b) => b.gapJadwal + b.gapJangkauan - (a.gapJadwal + a.gapJangkauan))
      .map((x) => `${blockMeta(x.block).label} (${x.gapJadwal + x.gapJangkauan})`)
      .join(', ')}.`
    setBlock = s.block
    facts.push({ label: 'Blok', value: blockMeta(s.block).label }, { label: 'Petak', value: `${s.gapJadwal + s.gapJangkauan}` })
    trace.push('Rute: blok dengan kesenjangan terbanyak')
  } else if (wantsFreq || (wantsRec && wantsRail && !wantsFeeder)) {
    const rs = recs.filter((r) => r.kind === 'jadwal' && (wantsBus && !wantsRail ? r.targetShort === 'TransJakarta' : wantsRail ? r.targetShort === 'KAI Commuter' : true))
    const pr = rs.filter((r) => r.tier === 'prioritas')
    const pt = rs.filter((r) => r.tier === 'pantau')
    answer = rs.length
      ? `${pr.length} kawasan ramai saat jadwalnya jarang (prioritas):\n\n${listRecs(pr, recs)}` +
        (pt.length ? `\n\nDitambah ${pt.length} kawasan yang keramaiannya baru tingkat sedang, cukup dipantau: ${pt.map((r) => `${recs.indexOf(r) + 1} ${r.place}`).join(', ')}.` : '') +
        (pr[0] ? `\n\nUsulan teratas: ${pr[0].proposal.summary}` : '')
      : 'Tidak ada kawasan ramai yang jadwal layanannya jarang pada data saat ini.'
    focusOn(rs[0])
    facts.push({ label: 'Kandidat', value: `${rs.length}` })
    trace.push('Rute: kandidat frekuensi rendah')
  } else if (wantsFeeder || (wantsRec && wantsBus)) {
    const rs = recs.filter((r) => r.kind === 'jangkauan')
    const pr = rs.filter((r) => r.tier === 'prioritas')
    const pt = rs.filter((r) => r.tier === 'pantau')
    answer = rs.length
      ? `${pr.length} kawasan ramai yang tidak punya stasiun atau halte dalam 1 km, cocok untuk rute pengumpan:\n\n${listRecs(pr, recs)}` +
        (pt.length ? `\n\nDitambah ${pt.length} kawasan yang keramaiannya baru tingkat sedang, cukup dipantau: ${pt.map((r) => `${recs.indexOf(r) + 1} ${r.place}`).join(', ')}.` : '') +
        (pr[0] ? `\n\nUsulan teratas: ${pr[0].proposal.summary}` : '')
      : 'Tidak ditemukan kawasan ramai yang benar-benar di luar jangkauan pada data saat ini.'
    focusOn(rs[0])
    facts.push({ label: 'Kandidat', value: `${rs.length}` })
    trace.push('Rute: kandidat tak terjangkau')
  } else if (wantsRec) {
    const top = prioritas.slice(0, 3)
    answer = top.length
      ? `${prioritas.length} kandidat prioritas tersusun dari hitungan. Tiga teratas:\n\n${listRecs(top, recs)}\n\nUsulan untuk nomor 1: ${top[0].proposal.summary}`
      : 'Belum ada kandidat yang lolos ambang dari data saat ini.'
    focusOn(top[0])
    trace.push('Rute: daftar kandidat')
  } else if (wantsAfterLast || ((setBlock === 'malam' || setBlock === 'larut') && wantsBusy)) {
    const b: BlockId = setBlock ?? 'malam'
    const busy = model.cells.filter((c) => c.blocks[b].cls === 'ramai').sort((x, y) => y.blocks[b].total - x.blocks[b].total)
    const gaps = busy.filter((c) => c.blocks[b].gap !== null)
    answer = busy.length
      ? `Pada blok ${blockMeta(b).label} ada ${busy.length} petak yang tergolong ramai. ${gaps.length} di antaranya layanan transitnya kurang pada jam itu. Peta sudah dipindah ke blok tersebut; petak paling ramai ada di sekitar ${busy[0].nearestNode.name}.`
      : `Pada blok ${blockMeta(b).label} belum ada petak yang tergolong ramai dari data yang ada. Petak tanpa warna artinya belum ada laporan, bukan sepi.`
    if (busy[0]) focus = { ...busy[0].center, zoom: 13 }
    setBlock = b
    facts.push({ label: 'Petak ramai', value: `${busy.length}` }, { label: 'Layanan kurang', value: `${gaps.length}` })
    trace.push(`Rute: petak ramai pada blok ${b}`)
  } else if (wantsGap) {
    const rs = recs.filter((r) => r.kind === 'jangkauan')
    answer = rs.length
      ? `Ada ${rs.length} kawasan ramai yang tak terjangkau (tidak ada stasiun atau halte dalam 1 km). Terbesar: ${rs[0].place}, ${rs[0].headline}. ${rs[0].body}`
      : 'Tidak ditemukan kawasan ramai yang benar-benar di luar jangkauan pada data saat ini.'
    focusOn(rs[0])
    trace.push('Rute: kawasan tak terjangkau')
  } else if (node) {
    const near = model.cells.filter((c) => c.nearestNode.id === node.id && c.nearestNodeDistM <= 2000)
    const per = TIME_BLOCKS.map((b) => ({ b: b.id, pts: near.reduce((s, c) => s + c.blocks[b.id].total, 0) })).sort((x, y) => y.pts - x.pts)
    const peak = per[0]
    const linked = recs.filter((r) => r.nearestNode.id === node.id)
    answer =
      near.length === 0
        ? `${node.name}: belum ada laporan warga dalam 2 km dari stasiun ini, jadi belum bisa dinilai. Bukan berarti sepi.`
        : `${node.name}: ${near.length} petak kawasan dalam 2 km. Paling hidup pada blok ${blockMeta(peak.b).label}. Urutan dari yang paling hidup: ${per.map((p) => blockMeta(p.b).label).join(', ')}.` +
          (linked.length ? ` Stasiun ini jadi acuan kandidat ${linked.map((r) => `nomor ${recs.indexOf(r) + 1}`).join(' dan ')}.` : ' Tidak ada kandidat yang menunjuk ke stasiun ini.') +
          ' Peta dipindah ke blok puncaknya.'
    setBlock = peak.b
    focus = { lat: node.lat, lon: node.lon, zoom: 13.5 }
    facts.push({ label: 'Blok puncak', value: blockMeta(peak.b).label })
    trace.push('Rute: profil kawasan satu stasiun')
  } else if (wantsBusy && setBlock) {
    const b = setBlock
    const busy = model.cells.filter((c) => c.blocks[b].cls === 'ramai').sort((x, y) => y.blocks[b].total - x.blocks[b].total)
    answer = `Pada blok ${blockMeta(b).label} ada ${busy.length} petak yang tergolong ramai (seperempat teratas se-Jabodetabek). Peta sudah dipindah ke blok itu; petak merah adalah yang paling hidup${busy[0] ? `, misalnya sekitar ${busy[0].nearestNode.name}` : ''}.`
    if (busy[0]) focus = { ...busy[0].center, zoom: 13 }
    facts.push({ label: 'Petak ramai', value: `${busy.length}` })
    trace.push('Rute: petak ramai per blok')
  } else if (wantsSummary || setBlock || wantsBusy) {
    answer = summaryText(model, recs, summaries)
    const s = summaries.reduce((a, b) => (b.totalPoints > a.totalPoints ? b : a))
    facts.push({ label: 'Blok terhidup', value: blockMeta(s.block).label }, { label: 'Kandidat', value: `${prioritas.length}` })
    focusOn(prioritas[0])
    trace.push('Rute: ringkasan kota')
  } else {
    answer =
      `Pertanyaan itu belum bisa saya jawab tanpa AI, jadi ini gambaran singkatnya.\n\n${summaryText(model, recs, summaries)}\n\nYang bisa ditanyakan langsung: "kawasan mana yang ramai malam hari", "bagaimana sekitar Tanah Abang", "stasiun mana yang perlu tambahan frekuensi", "kandidat mana yang keyakinannya tinggi", atau "kenapa kandidat 1 di atas 2".`
    trace.push('Rute: jawaban umum')
  }

  trace.push(`Hasil: jawaban${setBlock ? `, pindah ke blok ${setBlock}` : ''}${focus ? ', peta digeser' : ''}`)
  return { answer, setBlock, focus, trace, facts }
}

function summaryText(model: SimpulModel, recs: Recommendation[], summaries: ReturnType<typeof summarizeBlocks>) {
  const s = summaries.reduce((a, b) => (b.totalPoints > a.totalPoints ? b : a))
  const gapTotal = summaries.reduce((a, b) => a + b.gapJadwal + b.gapJangkauan, 0)
  const prioritas = recs.filter((r) => r.tier === 'prioritas')
  const kai = prioritas.filter((r) => r.targetShort === 'KAI Commuter').length
  return (
    `Dari ${model.counts.activities.toLocaleString('id-ID')} laporan warga, blok paling hidup se-Jabodetabek adalah ${blockMeta(s.block).label}. ` +
    `Ada ${gapTotal} petak ramai yang layanannya kurang, yang dikelompokkan menjadi ${prioritas.length} kandidat prioritas (${kai} untuk KAI Commuter, ${prioritas.length - kai} untuk TransJakarta/JakLingko) dan ${recs.length - prioritas.length} kawasan yang perlu dipantau.` +
    (prioritas[0] ? ` Kandidat teratas: ${prioritas[0].place}, ${prioritas[0].headline}.` : '')
  )
}

export const SIMPUL_SUGGESTIONS = [
  'Ringkas kondisinya',
  'Kawasan mana yang masih hidup malam hari?',
  'Bagaimana sekitar Tanah Abang?',
  'Mana kawasan ramai yang tak terjangkau?',
  'Apa rekomendasinya untuk KAI?',
]
