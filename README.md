# SIMPUL 🚈

**Peta kapan kota hidup — dan apakah transportasi massalnya hadir pada jam itu. Jabodetabek.**
Prototipe WebGIS tim COOK untuk MAPID WebGIS Competition 2026 (*Maps That Think! — Mass Transportation Edition*).

> Kota punya denyut: ramai jam sekian, sepi jam sekian. SIMPUL membacanya dari laporan lapangan warga di Community Maps MAPID, lalu menabrakkannya dengan layanan transit yang benar-benar ada — stasiun, halte, dan jadwalnya. Hasilnya: peta yang bisa digeser per blok waktu, kawasan "ramai tapi tak terlayani" tersorot otomatis, dan daftar kandidat berperingkat untuk KAI Commuter, TransJakarta, dan Dishub.

## Fitur

- 🔥 **Denyut** — heatmap → heksagon ±500 m, digeser lima blok waktu (pagi–larut)
- 🚨 **Kesenjangan** — hanya kawasan ramai yang layanannya kurang: merah = tak ada stasiun/halte dalam 1 km, oranye = frekuensi rendah; stasiun menampilkan keberangkatan terjadwal per blok
- 📋 **Kandidat berperingkat** — kantong sel bermasalah digabung, diberi bukti, jarak, blok dominan, tingkat keyakinan, dan usulan bertarget; nomor kartu = nomor di peta
- 💬 **Tanya** — pertanyaan bahasa biasa → jawaban berangka dari hitungan yang sama + peta ikut bergerak + jejak nalar
- 🧭 **Panduan "Cara pakai"** muncul di kunjungan pertama; kontrol peta berlabel (Tampilan / Lapisan)
- 🗺 **Basemap MAPID MAPS** (light / dark / satellite)

## Data (semua nyata, tidak ada dummy)

| Data | Sumber |
|---|---|
| Laporan warga Community Maps — 1.750 di Jabodetabek (9 Sep 2026) | **API kompetisi MAPID**, ditarik live per bbox lewat `/api/activities`; snapshot `src/data/activitiesJabodetabek.json` sebagai cadangan |
| 129 stasiun KRL/MRT/LRT + lintas; jalur rel | OpenStreetMap |
| Keberangkatan KRL per blok | Gapeka 2025 / 2023, dibagi per blok dengan bobot headway |
| MRT & LRT | Headway resmi operator |
| 7.814 halte TransJakarta & JakLingko + keberangkatan per blok | GTFS resmi TransJakarta |

Tidak ada perkiraan keramaian untuk kawasan tanpa laporan — ditampilkan "Tidak Ada Data" (sesuai PRD). Struk Go / Menu Go / Properti Go menyusul lewat endpoint *Missions* MAPID.

## Menjalankan

```bash
npm install
```

Salin `.env.example` → `.env.local`, isi `VITE_MAPID_API_KEY` (Dashboard MAPID → Map Services → API Keys). Key yang sama dipakai untuk basemap dan — lewat proxy dev di `vite.config.ts` — untuk API Activities.

```bash
npm run dev
```

### Deploy (Vercel)

`api/activities.ts` adalah Edge Function yang meneruskan permintaan ke server MAPID (endpoint itu menolak panggilan langsung dari browser). Set **`MAPID_API_KEY`** dan `VITE_MAPID_API_KEY` di Environment Variables proyek. `vercel.json` sudah mengecualikan `/api/` dari rewrite SPA.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| **[CARA-KERJA.md](CARA-KERJA.md)** | Dari layar ke angka: apa yang dilihat, dari mana datanya, cara membaca satu kartu kandidat, rencana AI |
| **[PERHITUNGAN.md](PERHITUNGAN.md)** | Rumus langkah demi langkah + alasan tiap bobot/ambang |
| **[ARSITEKTUR.md](ARSITEKTUR.md)** | Rancangan implementasi penuh (pipeline, PostGIS, backend, diagram) |
| **[IDE-UTAMA.md](IDE-UTAMA.md)** | Ide awal dalam bahasa sederhana |
| **[BAB5-KELAYAKAN-TEKNIS.md](BAB5-KELAYAKAN-TEKNIS.md)** | Draf bab kelayakan teknis proposal |

## Stack

React 19 + TypeScript + Vite · MapLibre GL JS v5 · analisis spasial ditulis manual (haversine, grid heksagon, flood-fill) supaya rumusnya terlihat dan bisa diaudit · Vercel Edge Function sebagai backend tipis.

## Batasan

Sebaran laporan mengikuti lokasi surveyor (bukan sampel acak); jam laporan condong 12–17 WIB; timetable KRL per stasiun belum terbuka; asisten masih berbasis aturan (rencana LLM *tool use* di CARA-KERJA.md §6). Daftar lengkap ada di tab **Metode** dalam aplikasi.
