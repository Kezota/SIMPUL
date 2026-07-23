/**
 * AI INTERFACE (Ketentuan C — "AI wajib hadir di dalam interface WebGIS").
 *
 * Menerjemahkan pertanyaan bahasa alami menjadi:
 *   1. aksi peta   (filter + fly-to)  -> jawaban muncul DI PETA, bukan cuma teks
 *   2. narasi      (jawaban tertulis) -> insight yang bisa dibaca
 *   3. jejak nalar (reasoning trace)  -> supaya input/proses/output bisa diaudit
 *
 * ── INI BELUM LLM ──────────────────────────────────────────────────────────
 * Yang dipakai adalah intent parser + template narasi yang membaca hasil
 * analisis nyata. Konsekuensinya jujur: dia hanya paham pola pertanyaan yang
 * sudah diantisipasi, dan akan bilang "belum paham" kalau meleset.
 *
 * Yang justru harus dipertahankan waktu pindah ke LLM: jawabannya TIDAK PERNAH
 * mengarang angka — semuanya ditarik dari computeInsights()/computeNodeStats().
 * Rancangan versi LLM memakai tool use:
 *
 *   tools = [ setMapFilter(categories, access, onlyHighlighted, maxDistanceM),
 *             flyTo(lat, lon, zoom), getNodeStats(nodeId), getInsights() ]
 *
 * Model tidak diberi izin menulis angka bebas — ia hanya boleh memanggil tool
 * lalu merangkai kalimat dari nilai yang dikembalikan. Itu yang membuat
 * halusinasi angka nyaris mustahil, dan itu poin yang layak ditulis di bagian
 * "validasi hasil AI" pada proposal.
 */

import { categoryOf } from '../data/datasets'
import { ACCESS_META } from './analysis'
import { formatDistance } from './geo'
import type {
  AccessClass,
  DatasetDef,
  Filters,
  Insights,
  NodeStats,
  Observation,
} from './types'

export interface AIResponse {
  answer: string
  filters: Partial<Filters>
  focus: { lat: number; lon: number; zoom: number } | null
  trace: string[]
  facts: { label: string; value: string }[]
}

export interface AIContext {
  dataset: DatasetDef
  observations: Observation[]
  nodeStats: NodeStats[]
  insights: Insights
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

/* ── Intent detection ─────────────────────────────────────────────────────── */

/** Cocokkan kata di pertanyaan dengan label kategori dataset aktif. */
function detectCategories(q: string, ds: DatasetDef): string[] {
  const hits: string[] = []
  for (const c of ds.categories) {
    const words = c.label
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3)
    if (words.some((w) => q.includes(w))) hits.push(c.id)
  }
  return hits
}

function detectNode(q: string, nodes: NodeStats[]): NodeStats | null {
  let best: NodeStats | null = null
  let bestLen = 0
  for (const n of nodes) {
    const words = n.node.name
      .toLowerCase()
      .replace(/stasiun|terminal|whoosh|universitas/g, '')
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

export function describeNode(n: NodeStats, ds: DatasetDef): string {
  if (n.count === 0) {
    return `${n.node.name} tidak menjadi simpul terdekat bagi satu pun titik di dataset ${ds.label}. Simpul ini "sunyi": bukan berarti kawasannya mati, tapi berarti belum ada data yang merekamnya — itu sendiri sudah temuan, dan jadi kandidat prioritas survey lapangan.`
  }

  const dom = n.dominantCategory ? categoryOf(ds, n.dominantCategory).label : '—'
  const mix = n.categoryMix
    .slice(0, 3)
    .map((c) => `${categoryOf(ds, c.categoryId).label} (${c.count})`)
    .join(', ')

  const walkable =
    n.withinRadius > 0
      ? `${n.withinRadius} di antaranya benar-benar dalam radius jalan kaki ${formatDistance(n.node.serviceRadiusM)}`
      : `tidak satu pun berada dalam radius jalan kaki ${formatDistance(n.node.serviceRadiusM)} — kawasannya bergantung pada simpul ini tapi tidak bisa mencapainya dengan kaki`

  const hl =
    n.highlightCount > 0
      ? ` ${n.highlightCount} dari ${n.count} masuk kategori "${ds.highlight.label}" (${pct(n.highlightRatio)}).`
      : ` Tidak ada yang masuk kategori "${ds.highlight.label}" di sini.`

  const price = n.medianPrice !== null ? ` Harga median ${rupiah(n.medianPrice)}.` : ''

  return `${n.node.name} punya Indeks Denyut Transit ${n.pulseIndex}/100. Ada ${n.count} titik yang simpul terdekatnya adalah tempat ini, dan ${walkable}. Kategori dominan: ${dom}. Komposisi: ${mix}.${hl}${price} Jarak rata-rata ${formatDistance(n.avgDistanceM)}.`
}

export function buildRecommendations(
  insights: Insights,
  nodeStats: NodeStats[],
  ds: DatasetDef,
): { title: string; body: string; target: string }[] {
  const recs: { title: string; body: string; target: string }[] = []

  const silent = nodeStats.filter((n) => n.count === 0)
  if (silent.length) {
    recs.push({
      title: `Prioritaskan survey di ${silent.length} simpul sunyi`,
      body: `${silent
        .map((n) => n.node.name)
        .join(', ')} belum menjadi simpul terdekat bagi satu pun titik ${ds.label}. Ini titik buta data, bukan bukti kawasan sepi. Survey activities MAPID APPS sebaiknya diarahkan ke sini lebih dulu supaya indeksnya tidak bias ke wilayah yang kebetulan ramai kontributor.`,
      target: 'Tim survey / panitia',
    })
  }

  if (insights.topNode) {
    const dom = insights.topNode.dominantCategory
      ? categoryOf(ds, insights.topNode.dominantCategory).label.toLowerCase()
      : '—'
    recs.push({
      title: `${insights.topNode.node.name} adalah kandidat kuat pengembangan kawasan`,
      body: `Denyut tertinggi (${insights.topNode.pulseIndex}/100) dengan kategori dominan ${dom}. Aktivitas yang sudah tumbuh sendiri di sekitar simpul adalah modal awal — intervensi yang masuk akal bukan membangun dari nol, tapi merapikan: jalur pejalan kaki dari pintu keluar, penataan pedagang, dan informasi jadwal di titik keramaian.`,
      target: 'Operator stasiun / Pemda',
    })
  }

  if (insights.blankSpots.length) {
    const far = insights.blankSpots[0]
    recs.push({
      title: `${insights.blankSpots.length} titik berada di luar jangkauan semua simpul`,
      body: `Terjauh: "${far.title}" di ${formatDistance(far.distanceM)} dari ${far.nearestNodeName}. Kelompok ini kandidat rute feeder / angkutan pengumpan. Analisis lanjutannya: clustering titik luar jangkauan, lalu tarik rute yang menyentuh cluster terbesar menuju simpul terdekat.`,
      target: 'Dinas Perhubungan',
    })
  }

  const hotspots = nodeStats
    .filter((n) => n.count >= 2 && n.highlightRatio >= 0.4)
    .slice(0, 2)
  for (const n of hotspots) {
    recs.push({
      title: `Konsentrasi "${ds.highlight.label}" di sekitar ${n.node.name}`,
      body: `${pct(n.highlightRatio)} titik di catchment simpul ini masuk kategori tersebut (${ds.highlight.hint}). Karena setiap baris ${ds.label} membawa foto, temuan ini bisa diverifikasi visual sebelum ditindaklanjuti — itu yang membedakannya dari data tabular biasa.`,
      target: 'Pemda / operator',
    })
  }

  return recs
}

/* ── Entry point ──────────────────────────────────────────────────────────── */

export function ask(question: string, ctx: AIContext): AIResponse {
  const q = question.toLowerCase().trim()
  const ds = ctx.dataset
  const trace: string[] = [`Input: "${question}"`, `Dataset aktif: ${ds.label}`]
  const facts: { label: string; value: string }[] = []
  const filters: Partial<Filters> = {}
  let focus: AIResponse['focus'] = null

  const categories = detectCategories(q, ds)
  const node = detectNode(q, ctx.nodeStats)
  const radiusM = detectRadiusM(q)
  const wantsHighlight =
    /keluhan|masalah|aduan|rusak|ramai|non-?tunai|qris|cashless|kos\b/.test(q) ||
    q.includes(ds.highlight.label.toLowerCase())
  const wantsBlank = /blank|luar jangkauan|tidak terlayani|jauh dari|terpencil/.test(q)
  const wantsCompare = /banding|vs|dibanding|lebih ramai|paling/.test(q)
  const wantsRecommend = /rekomendasi|saran|usul|harus|prioritas/.test(q)
  const wantsPrice = /harga|murah|mahal|rupiah|biaya/.test(q)

  trace.push(
    `Ekstraksi intent → kategori: ${categories.length ? categories.join(', ') : '-'} | simpul: ${
      node?.node.name ?? '-'
    } | radius: ${radiusM ? formatDistance(radiusM) : '-'} | highlight: ${wantsHighlight}`,
  )

  if (categories.length) filters.categories = categories
  if (wantsHighlight) filters.onlyHighlighted = true
  if (radiusM) filters.maxDistanceM = radiusM
  if (node) {
    filters.nodeId = node.node.id
    focus = { lat: node.node.lat, lon: node.node.lon, zoom: 14 }
  }
  if (wantsBlank) {
    filters.access = ['luar'] as AccessClass[]
    filters.maxDistanceM = 40000
  }

  const subset = ctx.observations.filter((o) => {
    if (filters.categories?.length && !filters.categories.includes(o.categoryId)) return false
    if (filters.onlyHighlighted && !o.highlighted) return false
    if (filters.access?.length && !filters.access.includes(o.accessClass)) return false
    if (filters.maxDistanceM != null && o.distanceM > filters.maxDistanceM) return false
    if (filters.nodeId && o.nearestNodeId !== filters.nodeId) return false
    return true
  })
  trace.push(`Query spasial → ${subset.length} dari ${ctx.observations.length} titik cocok`)

  let answer: string

  if (wantsRecommend) {
    const recs = buildRecommendations(ctx.insights, ctx.nodeStats, ds)
    answer = recs.length
      ? `${recs.length} rekomendasi tersusun dari hasil analisis ${ds.label}:\n\n` +
        recs.map((r, i) => `${i + 1}. ${r.title} — ${r.body}`).join('\n\n')
      : 'Belum ada rekomendasi yang bisa disusun dari subset data saat ini.'
    trace.push('Rute: penyusunan rekomendasi dari insight level kota')
  } else if (wantsCompare && !node) {
    const top = ctx.insights.topNode
    const weak = ctx.insights.weakestNode
    answer = top
      ? `Simpul dengan denyut tertinggi adalah ${top.node.name} (${top.pulseIndex}/100, ${top.count} titik).${
          weak
            ? ` Yang terendah di antara simpul yang punya data adalah ${weak.node.name} (${weak.pulseIndex}/100, ${weak.count} titik).`
            : ''
        } Selisihnya bukan sekadar soal ramai — Indeks Denyut menimbang volume yang diluruhkan terhadap jarak, relevansi kategori, dan kelengkapan bukti visual.`
      : 'Belum ada simpul dengan data yang cukup untuk dibandingkan.'
    if (top) {
      focus = { lat: top.node.lat, lon: top.node.lon, zoom: 12 }
      facts.push({ label: 'Denyut tertinggi', value: `${top.pulseIndex}/100` })
    }
    trace.push('Rute: perbandingan antar simpul')
  } else if (node) {
    answer = describeNode(node, ds)
    if (subset.length && (categories.length || wantsHighlight)) {
      answer += `\n\nDengan filter yang kamu minta, tersisa ${subset.length} titik: ${subset
        .slice(0, 5)
        .map((o) => `"${o.title}"`)
        .join(', ')}${subset.length > 5 ? ', …' : ''}.`
    }
    facts.push(
      { label: 'Indeks Denyut', value: `${node.pulseIndex}/100` },
      { label: 'Titik di catchment', value: `${node.count}` },
      { label: ds.highlight.label, value: pct(node.highlightRatio) },
    )
    trace.push('Rute: profil satu simpul + agregasi catchment')
  } else if (wantsBlank) {
    const bs = ctx.insights.blankSpots
    answer = bs.length
      ? `Ada ${bs.length} titik yang berjarak lebih dari 2 km dari simpul transit mana pun — praktis tidak terlayani. Terjauh: "${
          bs[0].title
        }" (${formatDistance(bs[0].distanceM)} dari ${bs[0].nearestNodeName}). Ini kelompok yang paling butuh angkutan pengumpan.`
      : `Semua titik ${ds.label} berada dalam 2 km dari sebuah simpul transit.`
    if (bs.length) focus = { lat: bs[0].lat, lon: bs[0].lon, zoom: 12 }
    facts.push({ label: 'Titik luar jangkauan', value: `${bs.length}` })
    trace.push('Rute: deteksi blank spot berdasarkan kelas akses')
  } else if (wantsPrice && ctx.insights.medianPrice !== null) {
    const sorted = [...ctx.observations]
      .filter((o) => o.price !== null)
      .sort((a, b) => a.price! - b.price!)
    answer = `Harga median di dataset ${ds.label} adalah ${rupiah(
      ctx.insights.medianPrice,
    )}. Termurah: "${sorted[0].title}" (${rupiah(sorted[0].price!)}), termahal: "${
      sorted[sorted.length - 1].title
    }" (${rupiah(sorted[sorted.length - 1].price!)}). Perlu dicatat: harga ini harga rata-rata per porsi yang diisi surveyor, bukan hasil pembacaan struk.`
    facts.push({ label: 'Harga median', value: rupiah(ctx.insights.medianPrice) })
    focus = { lat: sorted[0].lat, lon: sorted[0].lon, zoom: 13 }
    trace.push('Rute: statistik harga')
  } else if (categories.length || wantsHighlight || radiusM) {
    const walk = subset.filter(
      (o) => o.accessClass === 'inti' || o.accessClass === 'dekat',
    ).length
    const label =
      categories.map((c) => categoryOf(ds, c).label.toLowerCase()).join(' & ') ||
      'sesuai filter'
    answer = subset.length
      ? `Ketemu ${subset.length} titik ${label}${
          wantsHighlight ? ` yang masuk kategori "${ds.highlight.label}"` : ''
        }${radiusM ? ` dalam ${formatDistance(radiusM)} dari simpul terdekat` : ''}. ${walk} di antaranya (${pct(
          subset.length ? walk / subset.length : 0,
        )}) berada dalam catchment pejalan kaki 1 km. Titiknya sudah disorot di peta.`
      : 'Tidak ada titik yang cocok dengan kombinasi filter itu. Coba longgarkan salah satu syaratnya.'
    if (subset.length) {
      focus = { lat: subset[0].lat, lon: subset[0].lon, zoom: 12 }
      facts.push({ label: 'Hasil', value: `${subset.length} titik` })
    }
    trace.push('Rute: pencarian atribut + spasial')
  } else if (/ringkas|rangkum|summary|overview|jelaskan|kondisi|gambaran/.test(q)) {
    const i = ctx.insights
    answer = `Dataset ${ds.label} berisi ${i.total} titik. ${
      i.withinServiceArea
    } (${pct(i.coverageRatio)}) berada dalam 1 km dari stasiun atau terminal, dengan jarak median ${formatDistance(
      i.medianDistanceM,
    )}. Kategori terbanyak: ${i.categoryCounts
      .slice(0, 3)
      .map((c) => `${categoryOf(ds, c.categoryId).label} (${c.count})`)
      .join(', ')}. ${pct(i.highlightRatio)} masuk kategori "${ds.highlight.label}".${
      i.medianPrice !== null ? ` Harga median ${rupiah(i.medianPrice)}.` : ''
    }${i.topNode ? ` Simpul paling "hidup": ${i.topNode.node.name} (${i.topNode.pulseIndex}/100).` : ''}`
    facts.push(
      { label: 'Cakupan 1 km', value: pct(i.coverageRatio) },
      { label: 'Jarak median', value: formatDistance(i.medianDistanceM) },
      { label: ds.highlight.label, value: pct(i.highlightRatio) },
    )
    trace.push('Rute: ringkasan level kota')
  } else {
    answer = `Belum paham maksud pertanyaannya. Yang bisa aku jawab untuk dataset ${
      ds.label
    }: ringkasan kondisi keseluruhan, profil satu stasiun/terminal (sebut namanya), pencarian per kategori (${ds.categories
      .slice(0, 3)
      .map((c) => c.label.toLowerCase())
      .join(', ')}), titik di luar jangkauan transit, perbandingan antar simpul, dan rekomendasi.`
    trace.push('Rute: fallback — intent tidak dikenali')
  }

  trace.push(`Output: narasi + ${Object.keys(filters).length} perubahan filter peta`)
  return { answer, filters, focus, trace, facts }
}

/** Pertanyaan contoh — ikut menyesuaikan dataset yang sedang aktif. */
export function suggestedQuestions(ds: DatasetDef, nodeStats: NodeStats[]): string[] {
  const busiest = nodeStats.find((n) => n.count > 0)?.node.name ?? 'Stasiun Bandung'
  const cat = ds.categories[0]?.label ?? 'ekonomi'
  const base = [
    'Ringkas kondisi keseluruhan',
    `Bagaimana kondisi ${busiest}?`,
    `Mana ${cat.toLowerCase()} dalam 1 km dari simpul?`,
    'Tunjukkan titik di luar jangkauan transit',
    'Simpul mana yang paling ramai?',
    'Apa rekomendasi untuk Dinas Perhubungan?',
  ]
  if (ds.extraColumns.some((c) => c.key === 'price')) base.push('Berapa harga median di sini?')
  return base
}

export { ACCESS_META as ACCESS_LABELS }
