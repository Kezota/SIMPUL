/**
 * TAHAP 4-5 (Ketentuan B.3): pengolahan data tidak terstruktur + AI.
 *
 * Data Community Maps hanya punya `title`, `description`, dan link media.
 * Tidak ada satu pun kolom kategori. Modul ini yang mengubah teks bebas itu
 * menjadi atribut terstruktur yang bisa difilter, diagregasi, dan dipetakan:
 *
 *   input  : title + description (teks bebas), jumlah images/videos
 *   proses : klasifikasi tema berbasis leksikon berbobot, ekstraksi tag,
 *            deteksi nada laporan, ekstraksi indikasi harga
 *   output : theme, tags, sentiment, priceHints, mediaScore, transitRelevance
 *
 * ── CATATAN JUJUR SOAL "AI" ────────────────────────────────────────────────
 * Implementasi di bawah ini DETERMINISTIK (rule-based / bag-of-words), bukan
 * LLM. Dipakai karena: (a) jalan offline, gratis, dan instan; (b) hasilnya
 * bisa diaudit baris per baris — juri bisa diminta cek kenapa satu titik masuk
 * tema tertentu; (c) jadi baseline untuk mengukur apakah LLM benar-benar lebih
 * baik. Untuk versi kompetisi, ganti isi `classify()` dengan panggilan LLM
 * (lihat `enrichWithLLM` di bawah) dan simpan hasilnya sebagai kolom baru di
 * GeoJSON supaya WebGIS tetap ringan (inferensi dilakukan offline, sekali).
 */

import type { Enrichment, RawActivity, Sentiment, ThemeId } from './types'

export interface ThemeMeta {
  id: ThemeId
  label: string
  short: string
  color: string
  /** Bobot relevansi terhadap isu transportasi massal (0-1). */
  transitWeight: number
}

export const THEMES: ThemeMeta[] = [
  { id: 'mobilitas', label: 'Mobilitas & Lalu Lintas', short: 'Mobilitas', color: '#ef4444', transitWeight: 1.0 },
  { id: 'ekonomi', label: 'Ekonomi & Kuliner', short: 'Ekonomi', color: '#f59e0b', transitWeight: 0.8 },
  { id: 'infrastruktur', label: 'Infrastruktur & Fasilitas', short: 'Infrastruktur', color: '#8b5cf6', transitWeight: 0.75 },
  { id: 'sosial', label: 'Sosial & Komunitas', short: 'Sosial', color: '#0ea5e9', transitWeight: 0.5 },
  { id: 'lingkungan', label: 'Lingkungan', short: 'Lingkungan', color: '#22c55e', transitWeight: 0.45 },
  { id: 'rekreasi', label: 'Rekreasi & Wisata', short: 'Rekreasi', color: '#ec4899', transitWeight: 0.4 },
  { id: 'lainnya', label: 'Belum terklasifikasi', short: 'Lainnya', color: '#94a3b8', transitWeight: 0.3 },
]

export const themeMeta = (id: ThemeId): ThemeMeta =>
  THEMES.find((t) => t.id === id) ?? THEMES[THEMES.length - 1]

/**
 * Leksikon. Bobot 2 = kata kunci kuat (hampir pasti menentukan tema),
 * bobot 1 = kata pendukung. Sengaja pakai kata dasar tanpa imbuhan supaya
 * cocok dengan pencocokan substring pada teks yang sudah dinormalisasi.
 */
const LEXICON: Record<Exclude<ThemeId, 'lainnya'>, Record<string, number>> = {
  mobilitas: {
    macet: 2, kemacetan: 2, 'lalu lintas': 2, bus: 2, terminal: 2, stasiun: 2,
    kereta: 2, angkot: 2, tol: 2, konvoi: 2, transportasi: 2, halte: 2,
    jalur: 1, rute: 1, pool: 1, ojek: 1, motor: 1, perjalanan: 1, telat: 1,
    berangkat: 1, 'jalan kaki': 1, sepedah: 1, sepeda: 1, keluar: 1, arah: 1,
  },
  ekonomi: {
    pasar: 2, harga: 2, jual: 2, beli: 2, warung: 2, kuliner: 2, inflasi: 2,
    franchise: 2, bisnis: 2, dagang: 2, merchant: 2, umkm: 2,
    makan: 1, murah: 1, kopi: 1, sushi: 1, soto: 1, donat: 1, nasi: 1,
    sayur: 1, bawang: 1, kafe: 1, cetak: 1, printer: 1, sewa: 1, rb: 1,
  },
  lingkungan: {
    sampah: 2, sungai: 2, citarum: 2, polusi: 2, limbah: 2, banjir: 2,
    sawah: 1, hijau: 1, alam: 1, pohon: 1, bakar: 1, kebun: 1, udara: 1,
  },
  infrastruktur: {
    'jalan rusak': 2, rusak: 2, 'belum dibetulin': 2, perbaikan: 2,
    trotoar: 2, drainase: 2, penerangan: 2, fasilitas: 2, perpustakaan: 2,
    shelter: 1, gubernur: 1, jalan: 1, jembatan: 1, gedung: 1, lidar: 1,
  },
  sosial: {
    penyuluhan: 2, warga: 2, komunitas: 2, seminar: 2, pendataan: 2,
    rw: 2, rt: 2, posyandu: 2, qurban: 2, relawan: 2,
    info: 1, sekolah: 1, praktikum: 1, kuliah: 1, kucing: 1, sosialisasi: 1,
  },
  rekreasi: {
    hiking: 2, wisata: 2, rekreasi: 2, olahraga: 2, 'jalan-jalan': 2,
    explore: 2, libur: 2, pameran: 1, event: 1, track: 1, weekend: 1,
    santai: 1, nongkrong: 1, baca: 1,
  },
}

const COMPLAINT_WORDS = [
  'macet', 'rusak', 'sampah', 'telat', 'masalah', 'kasian', 'belum',
  'susah', 'sulit', 'naik dari', 'mahal', 'polusi', 'bau', 'antri',
  'ngantri', 'gagal', 'kecewa', 'parah', 'banjir', '👎',
]

const PRAISE_WORDS = [
  'happy', 'mantab', 'mantap', 'seru', 'bagus', 'murah', 'nyaman', 'enak',
  'alhamdulillah', 'menarik', 'seger', 'cocok', 'rekomendasi', 'suka',
]

const STOPWORDS = new Set([
  'yang', 'untuk', 'dari', 'dengan', 'saya', 'kami', 'kalian', 'ini', 'itu',
  'ada', 'aja', 'juga', 'akan', 'pada', 'dan', 'atau', 'tapi', 'bgt', 'nih',
  'sih', 'ya', 'ga', 'nggak', 'gak', 'bisa', 'lebih', 'sudah', 'udah',
  'banyak', 'kalo', 'kalau', 'disini', 'sini', 'jadi', 'ke', 'di', 'yg',
])

const normalizeText = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/** Klasifikasi tema: jumlahkan bobot kata kunci per tema, ambil skor tertinggi. */
function classify(text: string): {
  theme: ThemeId
  confidence: number
  scores: Record<ThemeId, number>
} {
  const scores = Object.fromEntries(
    THEMES.map((t) => [t.id, 0]),
  ) as Record<ThemeId, number>

  for (const [theme, words] of Object.entries(LEXICON)) {
    for (const [word, weight] of Object.entries(words)) {
      if (text.includes(word)) scores[theme as ThemeId] += weight
    }
  }

  const ranked = (Object.entries(scores) as [ThemeId, number][])
    .filter(([id]) => id !== 'lainnya')
    .sort((a, b) => b[1] - a[1])

  const [topId, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0

  if (topScore === 0) return { theme: 'lainnya', confidence: 0, scores }

  // Confidence = seberapa jauh pemenang unggul dari runner-up.
  const confidence = Math.min(1, (topScore - secondScore) / topScore + 0.35)
  return { theme: topId, confidence, scores }
}

function detectSentiment(text: string): Sentiment {
  const complaints = COMPLAINT_WORDS.filter((w) => text.includes(w)).length
  const praise = PRAISE_WORDS.filter((w) => text.includes(w)).length
  if (complaints > praise) return 'keluhan'
  if (praise > complaints) return 'apresiasi'
  return 'netral'
}

/** Hashtag eksplisit + kata kunci leksikon yang benar-benar muncul di teks. */
function extractTags(text: string, theme: ThemeId): string[] {
  const tags = new Set<string>()

  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) tags.add(m[1])

  if (theme !== 'lainnya') {
    for (const [word, weight] of Object.entries(LEXICON[theme])) {
      if (weight === 2 && text.includes(word)) tags.add(word.replace(/[- ]/g, '_'))
    }
  }

  // Kata bermakna terpanjang sebagai cadangan kalau belum ada tag sama sekali.
  if (tags.size === 0) {
    const words = text
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w))
    for (const w of words.slice(0, 3)) tags.add(w)
  }

  return [...tags].slice(0, 6)
}

/** "44rb", "25 ribu", "Rp15.000" -> indikasi level harga di lokasi tersebut. */
function extractPrices(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:rp\s?)?(\d{1,3}(?:[.,]\d{3})+|\d{1,4})\s?(rb|ribu|k)\b/gi))
    out.add(m[0].trim())
  for (const m of text.matchAll(/rp\s?\d{1,3}(?:[.,]\d{3})+/gi)) out.add(m[0].trim())
  return [...out].slice(0, 4)
}

function buildSummary(
  theme: ThemeId,
  sentiment: Sentiment,
  tags: string[],
  prices: string[],
): string {
  const t = themeMeta(theme).short.toLowerCase()
  const nada =
    sentiment === 'keluhan'
      ? 'dilaporkan sebagai keluhan warga'
      : sentiment === 'apresiasi'
        ? 'dilaporkan dengan nada positif'
        : 'dilaporkan sebagai catatan netral'
  const tagStr = tags.length ? ` Kata kunci: ${tags.slice(0, 3).join(', ')}.` : ''
  const priceStr = prices.length ? ` Indikasi harga: ${prices.join(', ')}.` : ''
  return `Aktivitas bertema ${t}, ${nada}.${tagStr}${priceStr}`
}

/** Pipeline enrichment untuk satu record. */
export function enrichOne(raw: RawActivity): Enrichment {
  const text = normalizeText(`${raw.title} ${raw.description}`)
  const { theme, confidence, scores } = classify(text)
  const sentiment = detectSentiment(text)
  const tags = extractTags(text, theme)
  const priceHints = extractPrices(text)

  const nImg = raw.images?.length ?? 0
  const nVid = raw.videos?.length ?? 0
  // Video dihitung 2x foto: dokumentasi bergerak lebih informatif untuk
  // verifikasi kondisi lapangan. Dinormalisasi kasar pada 10 "unit media".
  const mediaScore = Math.min(1, (nImg + nVid * 2) / 10)

  const transitRelevance = Math.min(
    1,
    themeMeta(theme).transitWeight * (0.6 + 0.4 * confidence),
  )

  return {
    theme,
    themeConfidence: Number(confidence.toFixed(2)),
    themeScores: scores,
    tags,
    sentiment,
    priceHints,
    mediaScore: Number(mediaScore.toFixed(2)),
    transitRelevance: Number(transitRelevance.toFixed(2)),
    aiSummary: buildSummary(theme, sentiment, tags, priceHints),
  }
}

/* ───────────────────────────────────────────────────────────────────────────
 * TITIK GANTI KE LLM SUNGGUHAN
 *
 * Untuk versi kompetisi, jalankan skrip offline (Node/Python) yang memanggil
 * model dengan prompt kira-kira seperti ini, lalu tulis hasilnya kembali ke
 * GeoJSON sebagai kolom `theme`, `tags`, `sentiment`, `aiSummary`:
 *
 *   System: Kamu adalah pengklasifikasi laporan warga berbasis lokasi.
 *   User:   Judul: "{title}". Deskripsi: "{description}".
 *           Kembalikan JSON: { theme: one of [...], tags: string[],
 *           sentiment: "keluhan"|"netral"|"apresiasi", summary: string }
 *
 * Kolom `images` juga bisa dikirim ke model multimodal untuk klasifikasi
 * visual (contoh yang panitia sebut sendiri di tabel C.2: foto fasilitas ->
 * kategori kondisi fasilitas). Validasinya: ambil sampel acak ±30 titik,
 * beri label manual, hitung akurasi & Cohen's kappa terhadap output model —
 * angka itu yang dilaporkan di proposal, bukan klaim "pakai AI" saja.
 * ─────────────────────────────────────────────────────────────────────────── */
