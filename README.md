# SIMPUL 🚈

**Peta aktivitas kota & kesenjangan layanan transportasi massal — Jabodetabek (wilayah studi) · Bandung Raya (sampel).**
Prototipe WebGIS untuk MAPID WebGIS Competition 2026 (*Maps That Think! — Mass Transportation Edition*).

> Kota itu punya denyut — ramai jam sekian, sepi jam sekian. SIMPUL membacanya dari jejak kegiatan nyata warga di data MAPID (jam transaksi struk, kondisi tempat makan, cap waktu foto laporan warga, sebaran usaha), lalu menabrakkannya dengan layanan transit yang ada. Hasilnya: peta yang bisa digeser per blok waktu, kawasan "ramai tapi tak terlayani" tersorot otomatis, dan rekomendasi beralasan untuk KAI/Dishub.

## Fitur

- 🔥 **Mode Denyut** — heatmap heksagon satu bahasa warna (makin pekat = makin ramai) + slider blok waktu; geser dari pagi ke larut, kota "bernapas"
- 🚨 **Mode Kesenjangan** — satu klik, peta berganti cerita: hanya kawasan bermasalah yang berwarna (merah = ramai tapi >2 km dari semua simpul; oranye = ramai tapi jadwal menipis), stasiun menampilkan % layanan pada blok itu
- 📋 **Rekomendasi otomatis** — "tambah frekuensi di blok Malam" / "kandidat koridor feeder", tiap usulan membawa angka pendukung dan bisa diklik menuju lokasinya
- 🤖 **Asisten AI di dalam peta** — tanya bahasa biasa ("kawasan mana yang masih hidup malam hari?"), jawaban menggerakkan peta, dan tiap jawaban punya "jejak nalar" yang bisa diaudit
- 🚉 **Simpul transit nyata** — 129 stasiun KRL/MRT/LRT Jabodetabek dari relasi OpenStreetMap, lengkap dengan lintasnya; keberangkatan per blok waktu dari Gapeka 2025/2023 & headway resmi MRT/LRT
- 🚌 **Halte TransJakarta & JakLingko nyata** — 7.814 halte dengan keberangkatan per blok waktu dihitung dari GTFS resmi TransJakarta (frequencies.txt, hari kerja)
- 🛤 **Jalur rel asli** — geometri rel KRL/MRT/LRT/Whoosh dari OpenStreetMap (Jabodetabek & Bandung), bisa di-toggle
- 🗺 **Basemap MAPID MAPS** — style vektor resmi (light/dark/satellite) via `VITE_MAPID_API_KEY`; cadangan CARTO/Esri kalau key kosong
- 🌏 **Pemilih wilayah studi** — Jabodetabek (default, transit nyata) atau Bandung Raya (sampel aktivitas terlengkap)
- ♿ **Pin aksesibilitas** (bukti konsep) — titik ramah/tidak ramah akses dinilai dari foto lapangan MAPID, lengkap dengan foto + tanggal + alasan
- 🔍 **Mode Eksplorasi Data** — tampilan kedua untuk menjelajah 4 dataset MAPID mentah (Community Maps, Properti Go, Struk Go, Menu Go)

## Menjalankan

```bash
npm install
npm run dev
```

### Basemap MAPID MAPS

Salin `.env.example` ke `.env.local` dan isi `VITE_MAPID_API_KEY` dengan key dari Dashboard MAPID → **Map Services → API Keys**. Aplikasi otomatis memakai style resmi `basemap.mapid.io` (light / dark / satellite). Tanpa key, dipakai basemap cadangan CARTO/Esri.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| **[IDE-UTAMA.md](IDE-UTAMA.md)** | Ide lengkap dalam bahasa sederhana — fitur, data, alasan |
| **[PERHITUNGAN.md](PERHITUNGAN.md)** | Cara hitung langkah demi langkah + bobot yang dipakai + contoh nyata dari data sample |
| **[ARSITEKTUR.md](ARSITEKTUR.md)** | Rancangan implementasi penuh: pipeline batch, penyimpanan, serverless, diagram Mermaid siap render |
| **[DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md)** | Profil 4 dataset MAPID, cleaning, dan temuan awal (kos 0% dalam 1 km, dll.) |
| **[RESEARCH-AKSESIBILITAS.md](RESEARCH-AKSESIBILITAS.md)** | Riset penemuan masalah untuk fitur aksesibilitas: 11 temuan berlabel bukti, problem statement, panduan wawancara |
| **[PROJECT.md](PROJECT.md)** | Catatan teknis mode Eksplorasi Data (arsitektur adapter, dll.) |

## Data

- **Community Maps — live dari API MAPID kompetisi** (`POST server.mapid.io/web/competition/activities`, per bbox wilayah). Di Jabodetabek: 1.750 laporan warga ber-foto (9 Sep 2026). Endpoint menolak panggilan browser, jadi lewat backend tipis: proxy Vite saat dev (`vite.config.ts`) dan Vercel Edge Function `api/activities.ts` di produksi (set `MAPID_API_KEY` di Vercel). Kalau server tak terjangkau, snapshot `src/data/activitiesJabodetabek.json` dipakai dan topbar menulis "(snapshot)". Jam & keterangan ramai/sepi dibaca dari teks laporan dengan aturan kata kunci (`src/simpul/activityText.ts`), bukan LLM.
- **File sampel MAPID** (masih statis): Community Maps 25 titik · Properti Go 590 titik · Struk Go 15 titik (Bandung) · Menu Go 15 titik (Depok). Endpoint "Missions" untuk Struk/Menu/Properti Go belum disambungkan.
- **Data transit nyata** (`src/data/`): `stationsJabodetabek.json` (OSM, 9 Sep 2026), `tjStops.json` (GTFS resmi TransJakarta, file 24 Jul 2026), `railLines.json` (OSM). Perjalanan KRL per lintas: Gapeka 2025 (Bogor/Cikarang/Rangkasbitung) & 2023 (Tangerang/Tanjung Priok/Bandara). Detail & keterbatasan: PERHITUNGAN.md Langkah 5.
- Tidak ada perkiraan keramaian untuk sel tanpa data — ditampilkan "Tidak Ada Data" (sesuai PRD).
- Data sample tidak disebarluaskan di luar keperluan kompetisi.

## Stack

React 19 + TypeScript + Vite · MapLibre GL JS v5 · analisis spasial ditulis manual (haversine, grid heksagon, flood-fill) tanpa library GIS tambahan — supaya rumusnya terlihat dan bisa diaudit.

## Status & batasan

Prototipe untuk proposal. Data sample kecil (demo metode, bukan temuan final); profil jadwal transit masih perkiraan; klasifikasi & asisten masih rule-based dengan kontrak yang siap ditukar ke LLM. Daftar batasan lengkap + jawabannya ada di tab **Metode** dalam aplikasi dan di PERHITUNGAN.md.
