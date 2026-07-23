/**
 * TAHAP 4-5 (Ketentuan B.3): pengolahan data tidak terstruktur + AI.
 *
 * ── PERAN AI BERBEDA PER DATASET ───────────────────────────────────────────
 * Ini poin yang paling sering disamaratakan, padahal bedanya besar:
 *
 *   Community Maps  — TIDAK ADA kolom kategori sama sekali. AI di sini
 *                     *menciptakan* atribut dari nol lewat klasifikasi teks.
 *                     Tanpa itu, datanya tidak bisa difilter atau diagregasi.
 *
 *   Menu Go /       — kategori SUDAH ADA di data mentah (Jenis Tempat Makan,
 *   Struk Go /        Kategori Tempat, Kategori Properti). Mengklasifikasi
 *   Properti Go       ulang dengan AI cuma akan menambah kesalahan. Nilai AI
 *                     pindah ke pekerjaan lain: merapikan teks bebas (menu
 *                     andalan, alamat), menarik indikasi harga, meringkas, dan
 *                     — tahap berikutnya — membaca fotonya.
 *
 * Karena itu tiap observasi membawa `categorySource: 'data' | 'ai'`, dan UI
 * menampilkannya. Angka yang berasal dari kolom asli panitia tidak boleh
 * terlihat sama meyakinkannya dengan angka hasil tebakan model.
 */

import type { Category, Enrichment } from './types'

/* ── Kategori Community Maps (hasil klasifikasi, bukan kolom asli) ───────── */

export interface CommunityCategory extends Category {
  /** Bobot relevansi terhadap isu transportasi massal (0-1). */
  transitWeight: number
}

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  { id: 'mobilitas', label: 'Mobilitas & Lalu Lintas', color: '#ef4444', transitWeight: 1.0 },
  { id: 'ekonomi', label: 'Ekonomi & Kuliner', color: '#f59e0b', transitWeight: 0.8 },
  { id: 'infrastruktur', label: 'Infrastruktur & Fasilitas', color: '#8b5cf6', transitWeight: 0.75 },
  { id: 'sosial', label: 'Sosial & Komunitas', color: '#0ea5e9', transitWeight: 0.5 },
  { id: 'lingkungan', label: 'Lingkungan', color: '#22c55e', transitWeight: 0.45 },
  { id: 'rekreasi', label: 'Rekreasi & Wisata', color: '#ec4899', transitWeight: 0.4 },
  { id: 'lainnya', label: 'Belum terklasifikasi', color: '#94a3b8', transitWeight: 0.3 },
]

/**
 * Leksikon. Bobot 2 = kata kunci kuat, bobot 1 = kata pendukung. Sengaja pakai
 * kata dasar tanpa imbuhan supaya cocok dengan pencocokan substring.
 */
const LEXICON: Record<string, Record<string, number>> = {
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

export const COMPLAINT_WORDS = [
  'macet', 'rusak', 'sampah', 'telat', 'masalah', 'kasian', 'belum',
  'susah', 'sulit', 'mahal', 'polusi', 'bau', 'antri', 'ngantri',
  'gagal', 'kecewa', 'parah', 'banjir', '👎',
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
  'jalan', 'indonesia', 'kota', 'kabupaten',
])

export const normalizeText = (s: string) =>
  (s || '').toLowerCase().replace(/[‘’“”]/g, "'").replace(/\s+/g, ' ').trim()

export const isComplaint = (text: string) => {
  const t = normalizeText(text)
  const bad = COMPLAINT_WORDS.filter((w) => t.includes(w)).length
  const good = PRAISE_WORDS.filter((w) => t.includes(w)).length
  return bad > good
}

/** Klasifikasi tema Community Maps: jumlahkan bobot kata kunci, ambil tertinggi. */
export function classifyCommunityText(text: string): {
  categoryId: string
  confidence: number
} {
  const t = normalizeText(text)
  const scores: Record<string, number> = {}
  for (const [cat, words] of Object.entries(LEXICON)) {
    scores[cat] = 0
    for (const [word, weight] of Object.entries(words)) {
      if (t.includes(word)) scores[cat] += weight
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topId, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0
  if (topScore === 0) return { categoryId: 'lainnya', confidence: 0 }

  // Confidence menggabungkan dua hal yang berbeda, dan keduanya perlu:
  //   margin   — seberapa jauh pemenang unggul dari runner-up (ambiguitas)
  //   evidence — seberapa banyak kata kunci ketemu (kekuatan bukti)
  // Tanpa suku `evidence`, teks yang cuma memicu satu kata (skor 2 lawan 1)
  // ikut dapat keyakinan tinggi padahal buktinya tipis.
  const margin = (topScore - secondScore) / topScore
  const evidence = Math.min(1, topScore / 6)
  return { categoryId: topId, confidence: 0.6 * margin + 0.4 * evidence }
}

/* ── Helper generik, dipakai semua dataset ───────────────────────────────── */

/** Hashtag eksplisit + kata bermakna terpanjang sebagai cadangan. */
export function extractTags(text: string, extra: string[] = []): string[] {
  const t = normalizeText(text)
  const tags = new Set<string>(extra.filter(Boolean).map((e) => e.toLowerCase()))
  for (const m of t.matchAll(/#([\p{L}\p{N}_]+)/gu)) tags.add(m[1])
  if (tags.size === 0) {
    const words = t
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w))
    for (const w of words.slice(0, 3)) tags.add(w)
  }
  return [...tags].slice(0, 6)
}

/** "44rb", "25 ribu", "Rp15.000" -> indikasi level harga di lokasi tersebut. */
export function extractPrices(text: string): string[] {
  const t = normalizeText(text)
  const out = new Set<string>()
  for (const m of t.matchAll(/(?:rp\s?)?(\d{1,3}(?:[.,]\d{3})+|\d{1,4})\s?(rb|ribu|k)\b/gi))
    out.add(m[0].trim())
  for (const m of t.matchAll(/rp\s?\d{1,3}(?:[.,]\d{3})+/gi)) out.add(m[0].trim())
  return [...out].slice(0, 4)
}

/**
 * Skor kelengkapan bukti visual. Video dihitung 2x foto: dokumentasi bergerak
 * lebih informatif untuk verifikasi kondisi lapangan. Dinormalisasi pada 6
 * "unit media" — dataset mission umumnya membawa 2-3 foto per baris, jadi
 * ambang 10 (seperti versi pertama) membuat hampir semuanya bernilai rendah.
 */
export const mediaScore = (nImages: number, nVideos: number) =>
  Math.min(1, (nImages + nVideos * 2) / 6)

export interface EnrichInput {
  title: string
  description: string
  images: string[]
  videos: string[]
  /** Bobot relevansi transit dari kategori (0-1). */
  categoryWeight: number
  categoryConfidence: number
  categoryLabel: string
  extraTags?: string[]
  /** Teks tambahan yang ikut dipindai untuk harga & tag. */
  extraText?: string
}

export function enrich(input: EnrichInput): Enrichment {
  const text = `${input.title} ${input.description} ${input.extraText ?? ''}`
  const tags = extractTags(text, input.extraTags ?? [])
  const priceHints = extractPrices(text)
  const media = mediaScore(input.images.length, input.videos.length)

  const transitRelevance = Math.min(
    1,
    input.categoryWeight * (0.6 + 0.4 * input.categoryConfidence),
  )

  const tagStr = tags.length ? ` Kata kunci: ${tags.slice(0, 3).join(', ')}.` : ''
  const priceStr = priceHints.length ? ` Indikasi harga: ${priceHints.join(', ')}.` : ''

  return {
    tags,
    priceHints,
    mediaScore: Number(media.toFixed(2)),
    transitRelevance: Number(transitRelevance.toFixed(2)),
    categoryConfidence: Number(input.categoryConfidence.toFixed(2)),
    aiSummary: `Kategori ${input.categoryLabel.toLowerCase()}.${tagStr}${priceStr}`,
  }
}

/* ───────────────────────────────────────────────────────────────────────────
 * TITIK GANTI KE LLM SUNGGUHAN
 *
 * Jalankan skrip offline (Node/Python) yang memanggil model, lalu tulis
 * hasilnya kembali ke GeoJSON sebagai kolom baru — supaya WebGIS tetap ringan
 * (inferensi sekali di luar, bukan tiap kali halaman dibuka).
 *
 *   Community Maps → klasifikasi tema dari judul + deskripsi
 *   Menu Go        → normalisasi "Menu Utama" jadi jenis masakan yang konsisten
 *   Properti Go    → parsing "Alamat" jadi kelurahan/kecamatan terstruktur
 *   Semua          → model multimodal atas kolom foto: kondisi bangunan, ada
 *                    tidaknya undakan/ramp, keramaian — persis contoh yang
 *                    panitia tulis di tabel C.2.
 *
 * Validasi: ambil sampel acak ±30 baris, beri label manual, hitung akurasi &
 * Cohen's kappa terhadap output model. Angka itu yang dilaporkan di proposal.
 * ─────────────────────────────────────────────────────────────────────────── */
