# SIMPUL 🚈

**Peta aktivitas kota & kesenjangan layanan transportasi massal — Bandung Raya.**
Prototipe WebGIS untuk MAPID WebGIS Competition 2026 (*Maps That Think! — Mass Transportation Edition*).

> Kota itu punya denyut — ramai jam sekian, sepi jam sekian. SIMPUL membacanya dari jejak kegiatan nyata warga di data MAPID (jam transaksi struk, kondisi tempat makan, cap waktu foto laporan warga, sebaran usaha), lalu menabrakkannya dengan layanan transit yang ada. Hasilnya: peta yang bisa digeser per blok waktu, kawasan "ramai tapi tak terlayani" tersorot otomatis, dan rekomendasi beralasan untuk KAI/Dishub.

## Fitur

- 🔥 **Mode Denyut** — heatmap heksagon satu bahasa warna (makin pekat = makin ramai) + slider blok waktu; geser dari pagi ke larut, kota "bernapas"
- 🚨 **Mode Kesenjangan** — satu klik, peta berganti cerita: hanya kawasan bermasalah yang berwarna (merah = ramai tapi >2 km dari semua simpul; oranye = ramai tapi jadwal menipis), stasiun menampilkan % layanan pada blok itu
- 📋 **Rekomendasi otomatis** — "tambah frekuensi di blok Malam" / "kandidat koridor feeder", tiap usulan membawa angka pendukung dan bisa diklik menuju lokasinya
- 🤖 **Asisten AI di dalam peta** — tanya bahasa biasa ("kawasan mana yang masih hidup malam hari?"), jawaban menggerakkan peta, dan tiap jawaban punya "jejak nalar" yang bisa diaudit
- 🛤 **Jalur rel asli** — geometri rel KA & Whoosh diambil dari OpenStreetMap (bukan garis kira-kira), bisa di-toggle
- 🛰 **Citra satelit** — satu klik ganti basemap ke Esri World Imagery
- ♿ **Pin aksesibilitas** (bukti konsep) — titik ramah/tidak ramah akses dinilai dari foto lapangan MAPID, lengkap dengan foto + tanggal + alasan
- 🔍 **Mode Eksplorasi Data** — tampilan kedua untuk menjelajah 4 dataset MAPID mentah (Community Maps, Properti Go, Struk Go, Menu Go)

## Menjalankan

```bash
npm install
npm run dev
```

### Basemap MAPID MAPS

Kompetisi mewajibkan MAPID MAPS. Sementara memakai CARTO/OSM. Begitu style URL tersedia:

```bash
echo 'VITE_MAPID_STYLE_URL=<style url MAPID MAPS>' > .env.local
```

Tidak ada kode lain yang perlu diubah.

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

- **Data wajib** (sample MAPID WebGIS Competition 2026): Community Maps 25 titik · Properti Go 590 titik · Struk Go 15 titik · Menu Go 15 titik. Semua diolah sebagai inti hitungan — lihat PERHITUNGAN.md.
- **Data pendukung**: geometri jalur rel dari © OpenStreetMap contributors (ODbL); titik simpul transit sementara perkiraan manual (akan diganti OSM/BIG/Gapeka); citra satelit Esri World Imagery.
- Data sample tidak disebarluaskan di luar keperluan kompetisi.

## Stack

React 19 + TypeScript + Vite · MapLibre GL JS v5 · analisis spasial ditulis manual (haversine, grid heksagon, flood-fill) tanpa library GIS tambahan — supaya rumusnya terlihat dan bisa diaudit.

## Status & batasan

Prototipe untuk proposal. Data sample kecil (demo metode, bukan temuan final); profil jadwal transit masih perkiraan; klasifikasi & asisten masih rule-based dengan kontrak yang siap ditukar ke LLM. Daftar batasan lengkap + jawabannya ada di tab **Metode** dalam aplikasi dan di PERHITUNGAN.md.
