/**
 * AI INTERFACE (Ketentuan C — "AI wajib hadir di dalam interface WebGIS").
 *
 * Modul ini menerjemahkan pertanyaan bahasa alami menjadi:
 *   1. aksi peta   (filter + fly-to)  -> jawaban muncul DI PETA, bukan cuma teks
 *   2. narasi      (jawaban tertulis) -> insight yang bisa dibaca
 *   3. jejak nalar (reasoning trace)  -> supaya input/proses/output bisa diaudit
 *
 * ── LAGI-LAGI: INI BELUM LLM ───────────────────────────────────────────────
 * Yang dipakai di sini adalah intent parser + template narasi yang membaca
 * hasil analisis nyata. Konsekuensinya jujur: dia hanya paham pola pertanyaan
 * yang sudah diantisipasi, dan akan bilang "belum paham" kalau meleset.
 *
 * Kenapa tetap ditulis begini dulu:
 *   - jawabannya TIDAK PERNAH mengarang angka; semua angka ditarik dari
 *     computeInsights()/computeNodeStats(). Ini bagian yang justru harus
 *     dipertahankan waktu nanti pindah ke LLM.
 *   - kontraknya (`AIResponse`) sudah final, jadi swap ke LLM = ganti isi
 *     `ask()` saja, komponen UI tidak berubah.
 *
 * Rencana versi LLM (function calling / tool use):
 *   tools = [ setMapFilter(themes, access, onlyComplaints, maxDistanceM),
 *             flyTo(lat, lon, zoom),
 *             getNodeStats(nodeId), getInsights() ]
 *   Model TIDAK diberi akses menulis angka bebas — dia hanya boleh memanggil
 *   tool lalu merangkai kalimat dari nilai yang dikembalikan tool. Itu yang
 *   membuat halusinasi angka nyaris mustahil, dan itu poin yang layak ditulis
 *   di bagian "validasi hasil AI" pada proposal.
 */

import { ACCESS_META } from './analysis'
import { THEMES, themeMeta } from './enrich'
import { formatDistance } from './geo'
import type { AccessClass, Activity, Filters, Insights, NodeStats, ThemeId } from './types'

export interface AIResponse {
  answer: string
  /** Perubahan filter yang langsung diterapkan ke peta. */
  filters: Partial<Filters>
  focus: { lat: number; lon: number; zoom: number } | null
  /** Langkah yang ditempuh — ditampilkan sebagai "jejak nalar" di UI. */
  trace: string[]
  /** Angka pendukung yang ditampilkan sebagai chip di bawah jawaban. */
  facts: { label: string; value: string }[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/* ── Intent detection ─────────────────────────────────────────────────────── */

function detectThemes(q: string): ThemeId[] {
  const hits: ThemeId[] = []
  const alias: Record<string, ThemeId> = {
    macet: 'mobilitas', transportasi: 'mobilitas', mobilitas: 'mobilitas',
    'lalu lintas': 'mobilitas', angkutan: 'mobilitas', kereta: 'mobilitas',
    ekonomi: 'ekonomi', kuliner: 'ekonomi', makan: 'ekonomi', pasar: 'ekonomi',
    harga: 'ekonomi', warung: 'ekonomi', dagang: 'ekonomi', umkm: 'ekonomi',
    lingkungan: 'lingkungan', sampah: 'lingkungan', sungai: 'lingkungan',
    infrastruktur: 'infrastruktur', jalan: 'infrastruktur', fasilitas: 'infrastruktur',
    sosial: 'sosial', warga: 'sosial', komunitas: 'sosial',
    rekreasi: 'rekreasi', wisata: 'rekreasi', olahraga: 'rekreasi',
  }
  for (const [word, theme] of Object.entries(alias)) {
    if (q.includes(word) && !hits.includes(theme)) hits.push(theme)
  }
  return hits
}

function detectNode(q: string, nodes: NodeStats[]): NodeStats | null {
  let best: NodeStats | null = null
  let bestLen = 0
  for (const n of nodes) {
    // Cocokkan kata inti nama simpul: "kiaracondong", "padalarang", "cimahi".
    const words = n.node.name
      .toLowerCase()
      .replace(/stasiun|terminal|whoosh/g, '')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 3)
    for (const w of words) {
      if (q.includes(w) && w.length > bestLen) {
        best = n
        bestLen = w.length
      }
    }
  }
  return best
}

function detectRadiusM(q: string): number | null {
  const km = q.match(/(\d+(?:[.,]\d+)?)\s*km/)
  if (km) return Number(km[1].replace(',', '.')) * 1000
  const m = q.match(/(\d{3,5})\s*m(?:eter)?\b/)
  if (m) return Number(m[1])
  if (/\bjalan kaki\b|\bpejalan kaki\b|\bwalkable\b/.test(q)) return 1000
  if (/\bdekat\b|\bsekitar\b/.test(q)) return 1000
  return null
}

/* ── Narasi ───────────────────────────────────────────────────────────────── */

export function describeNode(n: NodeStats): string {
  if (n.count === 0) {
    return `${n.node.name} tidak punya satu pun laporan warga dalam radius ${formatDistance(
      n.node.serviceRadiusM,
    )}. Dalam dataset ini simpul tersebut "sunyi": bukan berarti kawasannya mati, tapi berarti tidak ada mata warga yang merekamnya — itu sendiri sudah temuan, dan jadi kandidat prioritas survey lapangan.`
  }
  const dom = n.dominantTheme ? themeMeta(n.dominantTheme).short.toLowerCase() : '-'
  const mix = n.themeMix
    .slice(0, 3)
    .map((t) => `${themeMeta(t.theme).short} (${t.count})`)
    .join(', ')
  const keluhan =
    n.complaintCount > 0
      ? ` ${n.complaintCount} dari ${n.count} laporan bernada keluhan (${pct(n.complaintRatio)}).`
      : ' Tidak ada laporan bernada keluhan di sini.'
  return `${n.node.name} punya Indeks Denyut Transit ${n.pulseIndex}/100 dari ${n.count} laporan warga dalam radius ${formatDistance(
    n.node.serviceRadiusM,
  )}. Tema dominan: ${dom}. Komposisi: ${mix}.${keluhan} Rata-rata laporan berjarak ${formatDistance(
    n.avgDistanceM,
  )} dari simpul.`
}

export function buildRecommendations(
  insights: Insights,
  nodeStats: NodeStats[],
): { title: string; body: string; target: string }[] {
  const recs: { title: string; body: string; target: string }[] = []

  const silent = nodeStats.filter((n) => n.count === 0)
  if (silent.length) {
    recs.push({
      title: `Prioritaskan survey di ${silent.length} simpul sunyi`,
      body: `${silent
        .map((n) => n.node.name)
        .join(', ')} belum punya satu pun laporan warga dalam radius layanannya. Ini titik buta data, bukan bukti kawasan sepi. Survey activities MAPID APPS sebaiknya diarahkan ke sini lebih dulu supaya indeks tidak bias ke wilayah yang kebetulan ramai kontributor.`,
      target: 'Tim survey / panitia',
    })
  }

  if (insights.topNode) {
    recs.push({
      title: `${insights.topNode.node.name} adalah kandidat kuat pengembangan kawasan`,
      body: `Denyut tertinggi (${insights.topNode.pulseIndex}/100) dengan tema dominan ${
        insights.topNode.dominantTheme
          ? themeMeta(insights.topNode.dominantTheme).short.toLowerCase()
          : '-'
      }. Aktivitas ekonomi yang sudah tumbuh sendiri di sekitar simpul adalah modal awal — intervensi yang masuk akal di sini bukan membangun dari nol, tapi merapikan: penataan pedagang, jalur pejalan kaki dari pintu keluar, dan informasi jadwal di titik keramaian.`,
      target: 'Operator stasiun / Pemda',
    })
  }

  if (insights.blankSpots.length) {
    const far = insights.blankSpots[0]
    recs.push({
      title: `${insights.blankSpots.length} aktivitas berada di luar jangkauan semua simpul`,
      body: `Terjauh: "${far.title}" di ${formatDistance(
        far.distanceM,
      )} dari ${far.nearestNodeName}. Kelompok titik ini kandidat rute feeder / angkutan pengumpan. Analisis lanjutannya: clustering titik-titik luar jangkauan, lalu tarik rute yang menyentuh cluster terbesar menuju simpul terdekat.`,
      target: 'Dinas Perhubungan',
    })
  }

  const complaintNodes = nodeStats
    .filter((n) => n.count >= 2 && n.complaintRatio >= 0.3)
    .slice(0, 2)
  for (const n of complaintNodes) {
    recs.push({
      title: `Konsentrasi keluhan di sekitar ${n.node.name}`,
      body: `${pct(n.complaintRatio)} laporan di radius simpul ini bernada keluhan. Karena setiap laporan Community Maps membawa foto, tiap keluhan bisa diverifikasi visual sebelum ditindaklanjuti — ini yang membedakannya dari kanal aduan berbasis teks.`,
      target: 'Pemda / operator',
    })
  }

  return recs
}

/* ── Entry point ──────────────────────────────────────────────────────────── */

export function ask(
  question: string,
  ctx: { activities: Activity[]; nodeStats: NodeStats[]; insights: Insights },
): AIResponse {
  const q = question.toLowerCase().trim()
  const trace: string[] = [`Input: "${question}"`]
  const facts: { label: string; value: string }[] = []
  const filters: Partial<Filters> = {}
  let focus: AIResponse['focus'] = null

  const themes = detectThemes(q)
  const node = detectNode(q, ctx.nodeStats)
  const radiusM = detectRadiusM(q)
  const wantsComplaints = /keluhan|masalah|aduan|rusak|mengeluh|negatif/.test(q)
  const wantsBlank = /blank|luar jangkauan|tidak terlayani|jauh dari|terpencil/.test(q)
  const wantsCompare = /banding|vs|dibanding|lebih ramai|paling/.test(q)
  const wantsRecommend = /rekomendasi|saran|usul|harus|prioritas/.test(q)

  trace.push(
    `Ekstraksi intent → tema: ${themes.length ? themes.join(', ') : '-'} | simpul: ${
      node?.node.name ?? '-'
    } | radius: ${radiusM ? formatDistance(radiusM) : '-'} | keluhan: ${wantsComplaints}`,
  )

  // Terapkan filter yang terdeteksi ke peta.
  if (themes.length) filters.themes = themes
  if (wantsComplaints) filters.onlyComplaints = true
  if (radiusM) filters.maxDistanceM = radiusM
  if (node) {
    filters.nodeId = node.node.id
    focus = { lat: node.node.lat, lon: node.node.lon, zoom: 14 }
  }
  if (wantsBlank) {
    filters.access = ['luar'] as AccessClass[]
    filters.maxDistanceM = 20000
  }

  // Hitung subset yang cocok, supaya narasi memakai angka nyata.
  const subset = ctx.activities.filter((a) => {
    if (filters.themes?.length && !filters.themes.includes(a.theme)) return false
    if (filters.onlyComplaints && a.sentiment !== 'keluhan') return false
    if (filters.access?.length && !filters.access.includes(a.accessClass)) return false
    if (filters.maxDistanceM != null && a.distanceM > filters.maxDistanceM) return false
    if (filters.nodeId && a.nearestNodeId !== filters.nodeId) return false
    return true
  })
  trace.push(`Query spasial → ${subset.length} dari ${ctx.activities.length} titik cocok`)

  let answer: string

  if (wantsRecommend) {
    const recs = buildRecommendations(ctx.insights, ctx.nodeStats)
    answer =
      recs.length > 0
        ? `${recs.length} rekomendasi tersusun dari hasil analisis:\n\n` +
          recs.map((r, i) => `${i + 1}. ${r.title} — ${r.body}`).join('\n\n')
        : 'Belum ada rekomendasi yang bisa disusun dari subset data saat ini.'
    trace.push('Rute: penyusunan rekomendasi dari insight level kota')
  } else if (wantsCompare && !node) {
    const top = ctx.insights.topNode
    const weak = ctx.insights.weakestNode
    answer = top
      ? `Simpul dengan denyut tertinggi adalah ${top.node.name} (${top.pulseIndex}/100, ${
          top.count
        } laporan).${
          weak
            ? ` Yang terendah di antara simpul yang punya data adalah ${weak.node.name} (${weak.pulseIndex}/100, ${weak.count} laporan).`
            : ''
        } Selisihnya bukan sekadar soal ramai — Indeks Denyut menimbang volume laporan, relevansi temanya terhadap isu transit, dan kelengkapan buktinya.`
      : 'Belum ada simpul dengan data yang cukup untuk dibandingkan.'
    if (top) {
      focus = { lat: top.node.lat, lon: top.node.lon, zoom: 13 }
      facts.push({ label: 'Denyut tertinggi', value: `${top.pulseIndex}/100` })
    }
    trace.push('Rute: perbandingan antar simpul')
  } else if (node) {
    answer = describeNode(node)
    if (subset.length && (themes.length || wantsComplaints)) {
      answer += `\n\nDengan filter yang kamu minta, tersisa ${subset.length} titik: ${subset
        .slice(0, 5)
        .map((a) => `"${a.title}"`)
        .join(', ')}${subset.length > 5 ? ', …' : ''}.`
    }
    facts.push(
      { label: 'Indeks Denyut', value: `${node.pulseIndex}/100` },
      { label: 'Laporan', value: `${node.count}` },
      { label: 'Rasio keluhan', value: pct(node.complaintRatio) },
    )
    trace.push('Rute: profil satu simpul + agregasi radius layanan')
  } else if (wantsBlank) {
    const bs = ctx.insights.blankSpots
    answer = bs.length
      ? `Ada ${bs.length} aktivitas yang berjarak lebih dari 2 km dari simpul transit mana pun — praktis tidak terlayani. Terjauh: "${
          bs[0].title
        }" (${formatDistance(bs[0].distanceM)} dari ${bs[0].nearestNodeName}). Ini kelompok yang paling butuh angkutan pengumpan.`
      : 'Semua aktivitas dalam dataset ini berada dalam 2 km dari sebuah simpul transit.'
    if (bs.length) focus = { lat: bs[0].lat, lon: bs[0].lon, zoom: 12 }
    facts.push({ label: 'Titik luar jangkauan', value: `${bs.length}` })
    trace.push('Rute: deteksi blank spot berdasarkan kelas akses')
  } else if (themes.length || wantsComplaints || radiusM) {
    const inti = subset.filter((a) => a.accessClass === 'inti' || a.accessClass === 'dekat').length
    const label = themes.map((t) => themeMeta(t).short.toLowerCase()).join(' & ') || 'sesuai filter'
    answer = subset.length
      ? `Ketemu ${subset.length} aktivitas ${label}${
          wantsComplaints ? ' bernada keluhan' : ''
        }${radiusM ? ` dalam ${formatDistance(radiusM)} dari simpul terdekat` : ''}. ${inti} di antaranya (${pct(
          subset.length ? inti / subset.length : 0,
        )}) berada dalam catchment pejalan kaki 1 km. Titik-titiknya sudah disorot di peta.`
      : `Tidak ada aktivitas yang cocok dengan kombinasi filter itu. Coba longgarkan salah satu syaratnya.`
    if (subset.length) {
      focus = { lat: subset[0].lat, lon: subset[0].lon, zoom: 12 }
      facts.push({ label: 'Hasil', value: `${subset.length} titik` })
    }
    trace.push('Rute: pencarian atribut + spasial')
  } else if (/ringkas|rangkum|summary|overview|jelaskan|kondisi|gambaran/.test(q)) {
    const i = ctx.insights
    answer = `Dari ${i.total} laporan warga di koridor Bandung Raya, ${
      i.withinServiceArea
    } (${pct(i.coverageRatio)}) berada dalam 1 km dari stasiun atau terminal. Jarak median ke simpul terdekat ${formatDistance(
      i.medianDistanceM,
    )}. Tema terbanyak: ${i.themeCounts
      .slice(0, 3)
      .map((t) => `${themeMeta(t.theme).short} (${t.count})`)
      .join(', ')}. ${pct(i.complaintRatio)} laporan bernada keluhan.${
      i.topNode ? ` Simpul paling "hidup": ${i.topNode.node.name} (${i.topNode.pulseIndex}/100).` : ''
    }`
    facts.push(
      { label: 'Cakupan 1 km', value: pct(i.coverageRatio) },
      { label: 'Jarak median', value: formatDistance(i.medianDistanceM) },
      { label: 'Rasio keluhan', value: pct(i.complaintRatio) },
    )
    trace.push('Rute: ringkasan level kota')
  } else {
    answer = `Belum paham maksud pertanyaannya. Yang bisa aku jawab sekarang: ringkasan kondisi keseluruhan, profil satu stasiun/terminal (sebut namanya), pencarian per tema (${THEMES.slice(
      0,
      4,
    )
      .map((t) => t.short.toLowerCase())
      .join(', ')}), titik di luar jangkauan transit, perbandingan antar simpul, dan rekomendasi.`
    trace.push('Rute: fallback — intent tidak dikenali')
  }

  trace.push(`Output: narasi + ${Object.keys(filters).length} perubahan filter peta`)
  return { answer, filters, focus, trace, facts }
}

export const SUGGESTED_QUESTIONS = [
  'Ringkas kondisi keseluruhan',
  'Bagaimana kondisi Stasiun Cimahi?',
  'Mana aktivitas ekonomi dalam 1 km dari simpul?',
  'Tunjukkan titik di luar jangkauan transit',
  'Simpul mana yang paling ramai?',
  'Apa rekomendasi untuk Dinas Perhubungan?',
  'Di mana keluhan warga menumpuk?',
]

export const ACCESS_LABELS = ACCESS_META
