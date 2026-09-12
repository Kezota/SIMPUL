/**
 * Kontrak alat (tool) asisten SIMPUL untuk Gemini function calling.
 *
 * Implementasi PRD §7 "AI Integration": LLM hanya mengolah bahasa; semua
 * angka datang dari mesin hitung (engine.ts / recommend.ts) lewat alat-alat
 * ini, yang dijalankan di browser (aiRun.ts). Skema memakai subset OpenAPI
 * yang diterima Gemini (tanpa additionalProperties / anyOf).
 */

export interface GeminiFunctionDecl {
  name: string
  description: string
  parameters?: {
    type: 'OBJECT'
    properties: Record<string, unknown>
    required?: string[]
  }
}

const BLOK = {
  type: 'STRING',
  enum: ['pagi', 'siang', 'sore', 'malam', 'larut'],
  description: 'Blok waktu: pagi 06–10, siang 10–14, sore 14–18, malam 18–22, larut 22–06.',
}

export const SIMPUL_TOOLS: GeminiFunctionDecl[] = [
  {
    name: 'ringkasan_kota',
    description:
      'Gambaran umum se-Jabodetabek: jumlah laporan warga, poin kegiatan per blok waktu, jumlah sel ramai per blok, jumlah sel×blok yang mengalami kesenjangan (jadwal dan jangkauan), jumlah kandidat, dan status sumber data. Panggil untuk pertanyaan "ringkas", "gambaran", "kondisi".',
  },
  {
    name: 'sel_ramai',
    description:
      'Daftar sel heksagon kelas RAMAI pada satu blok waktu, diurutkan dari poin kegiatan terbesar, beserta stasiun terdekat, jarak ke layanan, dan jenis kesenjangannya. Untuk "kawasan mana yang ramai/hidup pada jam X".',
    parameters: {
      type: 'OBJECT',
      properties: {
        blok: BLOK,
        limit: { type: 'INTEGER', description: 'Jumlah sel teratas (default 8, maks 20).' },
      },
      required: ['blok'],
    },
  },
  {
    name: 'daftar_kandidat',
    description:
      'Daftar kandidat berperingkat. Nomor kandidat = nomor kartu di panel dan nomor di peta. Tiap kandidat punya tingkat: prioritas (ramai + layanan kurang) atau perlu dipantau. Bisa disaring menurut jenis (jadwal = frekuensi rendah, jangkauan = tak terjangkau) dan instansi target (kai / transjakarta).',
    parameters: {
      type: 'OBJECT',
      properties: {
        jenis: { type: 'STRING', enum: ['semua', 'jadwal', 'jangkauan'] },
        target: { type: 'STRING', enum: ['semua', 'kai', 'transjakarta'] },
      },
    },
  },
  {
    name: 'detail_kandidat',
    description:
      'Detail satu kandidat menurut nomornya: judul, jenis, keyakinan + alasannya, dasar peringkat, blok dominan, jumlah sel, bukti, jarak, skor layanan, keberangkatan rel/bus, stasiun terdekat, usulan.',
    parameters: {
      type: 'OBJECT',
      properties: { nomor: { type: 'INTEGER', description: 'Nomor kandidat (1 = peringkat tertinggi).' } },
      required: ['nomor'],
    },
  },
  {
    name: 'bandingkan_kandidat',
    description: 'Bandingkan dua kandidat menurut nomor: skor peringkat dan dasarnya, bukti, sel, keyakinan, skor layanan, jarak. Untuk "kenapa A di atas B".',
    parameters: {
      type: 'OBJECT',
      properties: { nomor_a: { type: 'INTEGER' }, nomor_b: { type: 'INTEGER' } },
      required: ['nomor_a', 'nomor_b'],
    },
  },
  {
    name: 'profil_kawasan',
    description:
      'Profil kawasan di sekitar satu stasiun (KRL/MRT/LRT) menurut nama: sel dalam 2 km, poin kegiatan per blok, blok puncak, keberangkatan terjadwal per blok, sel ber-gap. Nama boleh sebagian: "Tanah Abang", "Blok M", "Serpong".',
    parameters: {
      type: 'OBJECT',
      properties: { nama: { type: 'STRING', description: 'Nama stasiun atau kawasan.' } },
      required: ['nama'],
    },
  },
  {
    name: 'tampilkan_di_peta',
    description:
      'Menggerakkan peta pengguna: pindah blok waktu, ganti tampilan (denyut = aktivitas warga, gap = kesenjangan), sorot kandidat bernomor, dan/atau terbang ke koordinat. Panggil SETELAH mendapat angka dari alat lain. Isi hanya yang perlu diubah.',
    parameters: {
      type: 'OBJECT',
      properties: {
        blok: BLOK,
        mode: { type: 'STRING', enum: ['denyut', 'gap'] },
        kandidat: { type: 'INTEGER', description: 'Nomor kandidat yang disorot.' },
        lat: { type: 'NUMBER' },
        lon: { type: 'NUMBER' },
      },
    },
  },
]

export const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''
export const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.6-flash'
/** Model cadangan kalau model utama gagal (kuota/sibuk). Kosong = tidak ada. */
export const GEMINI_FALLBACK_MODEL = (import.meta.env.VITE_GEMINI_FALLBACK_MODEL as string | undefined) || ''

/** Konteks yang dikirim tiap giliran (bukan angka, hanya sudut pandang). */
export interface AssistantContext {
  roleLabel: string
  roleOrg: string
  blok: string
  mode: 'denyut' | 'gap'
}

export function buildSystemPrompt(ctx: AssistantContext): string {
  return `Kamu adalah asisten SIMPUL, WebGIS yang memetakan kawasan ramai (dari laporan lapangan warga di Community Maps MAPID, Jabodetabek) dan membandingkannya dengan layanan transit nyata (stasiun KRL/MRT/LRT, halte TransJakarta/JakLingko, dan jadwalnya) per blok waktu, lalu menyusun daftar kandidat kawasan yang ramai tetapi layanannya kurang.

ATURAN MUTLAK
1. Kamu TIDAK PERNAH menghitung atau mengarang angka, skor, peringkat, atau klasifikasi. Setiap angka dalam jawabanmu HARUS berasal dari hasil alat (function). Kalau belum memanggil alat, panggil dulu.
2. Jawab dalam bahasa Indonesia yang ringkas, jelas, dan tidak teknis. Maksimal sekitar 100 kata kecuali diminta rinci. Boleh pakai daftar bernomor pendek. Jangan pakai heading markdown, tabel, rumus, atau tanda pisah panjang (em dash).
3. Sebut nomor kandidat persis seperti dari alat (nomor = nomor kartu dan nomor di peta).
4. Setelah mendapat angka yang relevan, panggil tampilkan_di_peta agar peta menunjukkan hal yang dibahas. Cukup sekali per jawaban.
5. Pertanyaan di luar cakupan (bukan soal aktivitas kawasan, transit, kandidat, atau data SIMPUL) dijawab dengan penolakan singkat dan contoh yang bisa dijawab.
6. Kalau ditanya soal armada atau tindakan, pakai usulan dan perkiraan dari alat detail_kandidat, dan sebut bahwa angkanya indikatif; keputusan akhir di tangan operator/regulator.
7. Sebut keterbatasan data bila relevan: sebaran laporan mengikuti lokasi surveyor; kawasan tanpa laporan = "tidak ada data", bukan sepi.

KONTEKS PENGGUNA SAAT INI
- Peran: ${ctx.roleLabel} (${ctx.roleOrg}). Perencana KAI peduli frekuensi kereta di stasiun; analis TransJakarta peduli rute pengumpan/halte dan frekuensi bus; regulator Dishub peduli gambaran lintas moda; tamu peduli gambaran umum.
- Blok waktu yang sedang tampil: ${ctx.blok}. Tampilan peta: ${ctx.mode === 'gap' ? 'kesenjangan' : 'aktivitas warga'}.

ISTILAH
- Blok waktu: pagi 06–10, siang 10–14, sore 14–18, malam 18–22, larut 22–06.
- Kelas RAMAI = 25% sel teratas se-wilayah pada blok itu (relatif, bukan absolut).
- Kesenjangan "jangkauan" = ramai tetapi tidak ada stasiun/halte dalam 1 km. Kesenjangan "jadwal" = ramai tetapi skor layanan < 35/100 (frekuensi rendah).
- Keyakinan: tinggi 8 laporan atau lebih di 2 sel; sedang 3 sampai 7 laporan; rendah kurang dari 3.
- Tingkat kandidat: "prioritas" = ramai dan layanan kurang; "perlu dipantau" = keramaian tingkat sedang dan layanan tipis (belum mendesak).`
}
