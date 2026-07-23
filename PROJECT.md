# Denyut Simpul — prototipe WebGIS

Prototipe eksplorasi untuk **MAPID WebGIS Competition 2026** (*Maps That Think! — Mass Transportation Edition*).

> **Status: eksplorasi teknis, bukan submission.** Tujuannya membuktikan bahwa alur data mentah → analisis → insight → interface AI bisa dirakit dan berjalan, dan mencari tahu di mana bagian sulitnya. Ide lombanya sendiri belum dikunci.

Penjelasan datanya ada di **[DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md)**.

---

## 1. Yang dibangun

WebGIS satu halaman yang membaca **keempat dataset panitia secara bergantian**, menormalkan skemanya yang berbeda-beda jadi satu bentuk, mengaitkannya ke simpul transportasi massal, lalu menjawab satu pertanyaan:

> **Kehidupan yang terekam di data lapangan itu terjadi di mana relatif terhadap transit — dan simpul mana yang kawasannya "hidup" tapi tidak benar-benar terhubung?**

Temuan paling tajam dari sample: dari 29 listing **kos** di Properti Go, **tidak satu pun** berada dalam 1 km dari stasiun atau terminal — padahal Retail 50% dan Ruko 27%. Transit menarik perdagangan, bukan tempat tinggal.

## 2. Apa yang ada di layar

```
┌──────────────────────────────────────────────────────────────────────┐
│ Denyut Simpul   [Community|Properti Go|Struk Go|Menu Go]   590 titik │
├─────────────┬────────────────────────────────────┬───────────────────┤
│  KONTROL    │            PETA                    │  Insight │AI│…    │
│             │                                    │                   │
│  Layer      │   • titik data (warna = kategori)  │  Angka utama      │
│  ☑ titik    │   ◆ simpul transit + catchment     │  Indeks Denyut    │
│  ☑ heatmap  │   ○ radius layanan 1 km            │  Komposisi        │
│  ☑ simpul   │   ╌ garis ke simpul terdekat       │  Donut akses      │
│  ☑ radius   │                                    │  Rekomendasi      │
│  ☐ garis    │   [legenda]                        │                   │
│             │                                    │                   │
│  Filter     │                                    │                   │
│  🔍 cari    │                                    │                   │
│  kategori   ├────────────────────────────────────┤                   │
│  akses      │  ▴ Tabel Atribut · 590 baris       │                   │
└─────────────┴────────────────────────────────────┴───────────────────┘
```

**Tombol dataset di header** mengganti seluruh isi aplikasi: titik peta, palet kategori, kolom tabel, metrik, simpul transit acuan, dan pertanyaan contoh untuk AI. Peta ikut *fit* ke sebaran data yang baru — termasuk pindah kota saat memilih Menu Go.

**Empat tab di kanan:**

| Tab | Isi |
|---|---|
| **Insight** | 4 stat utama, bar chart Indeks Denyut per simpul (klik → peta terbang), komposisi kategori, donut keterjangkauan, rekomendasi bertarget stakeholder |
| **AI** | Asisten spasial — ketik pertanyaan bahasa Indonesia, dapat jawaban **dan** filter petanya ikut berubah |
| **Detail** | Atribut lengkap titik/simpul yang diklik: foto lapangan, kolom khas dataset, hasil pembacaan AI, jarak, tafsiran kelas akses |
| **Metode** | Alur pipeline, catatan cleaning **spesifik dataset aktif**, peran AI di dataset itu, daftar batasan |

## 3. Cara menjalankan

```bash
npm install
```

```bash
npm run dev
```

Build produksi:

```bash
npm run build
```

### Mengganti basemap ke MAPID MAPS

Ketentuan lomba mewajibkan MAPID MAPS. Style URL-nya baru didapat setelah registrasi, jadi prototipe ini sementara pakai CARTO/OSM. Begitu URL-nya ada, buat `.env.local`:

```bash
echo 'VITE_MAPID_STYLE_URL=<style url dari MAPID MAPS>' > .env.local
```

Tidak ada kode lain yang perlu diubah — `src/lib/basemap.ts` otomatis memakainya, dan catatan peringatan kuning di panel Kontrol berubah jadi hijau.

## 4. Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Peta | **MapLibre GL JS v5** | Open source, mendukung style vektor — paling aman untuk basemap MAPID MAPS. Soal kenapa v5 dan bukan v6, lihat §7 |
| Frontend | **React 19 + TypeScript + Vite** | Sesuai project yang sudah ada |
| Chart | **SVG + CSS murni** | Cuma butuh dua bentuk (bar & donut); tidak sepadan menambah dependency |
| Geospasial | **Ditulis manual** (`src/lib/geo.ts`) | Haversine + buffer geodesik cukup 100 baris; turf.js akan menyembunyikan rumusnya |
| State | `useState` + `useMemo` | Skalanya belum butuh state manager |

Dependency runtime: **`maplibre-gl` saja**. Bundle 430 kB gzip — 80%-nya MapLibre, sisanya sebagian besar data Properti Go yang di-inline.

## 5. Struktur file

```
src/
├── data/
│   ├── community.json         25 baris   ← Community Maps
│   ├── propertigo.json        590 baris  ← Properti Go Bandung
│   ├── strukgo.json           15 baris   ← Struk Go
│   ├── menugo.json            15 baris   ← Menu Go (Depok)
│   ├── datasets.ts            registry + 4 adapter  ⭐ inti arsitekturnya
│   └── transitNodes.ts        17 simpul, 2 wilayah ⚠️ koordinat perkiraan
│
├── lib/                       ← semua logika, tanpa React
│   ├── types.ts               Observation, DatasetDef, NodeStats, Insights
│   ├── geo.ts                 haversine, buffer geodesik, median, normalisasi
│   ├── enrich.ts              klasifikasi teks, tag, harga, skor bukti
│   ├── analysis.ts            spatial join, Indeks Denyut, insight, filter
│   ├── ai.ts                  intent parser + narasi + rekomendasi
│   └── basemap.ts             MAPID MAPS (via env) / fallback CARTO
│
├── components/
│   ├── MapView.tsx            MapLibre: 8 layer, marker HTML, popup, fitBounds
│   ├── ControlPanel.tsx       layer control + filter (kategori ikut dataset)
│   ├── InsightPanel.tsx       stat, chart, rekomendasi
│   ├── AIAssistant.tsx        chat + jejak nalar
│   ├── DetailPanel.tsx        detail titik & simpul
│   ├── DataTable.tsx          tabel atribut — kolom ikut dataset
│   ├── MethodPanel.tsx        metodologi & batasan
│   └── charts.tsx             BarList, Donut, Stat
│
├── App.tsx                    dataset switcher + state + layout responsif
└── webgis.css                 token warna, light/dark, breakpoint mobile
```

`src/assets/data/` menyimpan berkas asli panitia dalam semua format (SHP, GPKG, CSV, XLSX). `src/data/*.json` adalah salinan GeoJSON yang benar-benar dibaca aplikasi.

Pemisahan `lib/` dan `components/` disengaja: **seluruh analisis bisa dijalankan tanpa browser.** Itu yang membuat angka-angka di `DATA-DAN-ANALISIS.md` bisa diverifikasi dengan menjalankan pipeline-nya di Node, bukan dengan membaca layar.

## 6. Arsitektur adapter

Ini keputusan desain paling penting di project ini.

Empat dataset punya skema yang **sama sekali berbeda** — tidak ada satu pun nama kolom yang sama antara Community Maps dan Properti Go. Alih-alih menulis empat versi analisis, tiap dataset punya adapter yang menormalkannya jadi satu `Observation`:

```ts
interface Observation {
  lat, lon, title, subtitle, description
  categoryId, categorySource: 'data' | 'ai'
  images[], videos[]
  price?, when?, attributes[]        // slot untuk kolom khas dataset
  ...enrichment                       // tags, mediaScore, transitRelevance
  ...spatial                          // nearestNode, distanceM, accessClass
}
```

Akibatnya, `computeNodeStats()`, `computeInsights()`, `applyFilters()`, dan `ask()` **tidak punya satu pun `if (datasetId === ...)`**. Menambah dataset kelima = menulis satu adapter.

Dua hal yang sengaja dibuat berbeda per dataset lewat konfigurasi, bukan percabangan:

- **`highlight`** — metrik sekunder. Keluhan untuk Community Maps, kos untuk Properti Go, non-tunai untuk Struk Go, ramai untuk Menu Go. Ini menggantikan "rasio keluhan" yang hanya masuk akal untuk satu dataset.
- **`categoryWeight`** — bobot relevansi transit. E-commerce di Struk Go diberi 0,2 karena struk belanja online direkam di mana pun pembelinya berada; titiknya tidak menyatakan aktivitas di lokasi itu.

## 7. Dua bug yang memakan waktu paling lama

Keduanya layak dicatat karena akan terulang di project WebGIS mana pun dengan stack ini.

**a. Worker MapLibre v6 gagal senyap.** Peta tampil, basemap tampil, tapi **tidak ada satu pun layer GeoJSON yang muncul** — dan console bersih, tanpa error. Penyebabnya: MapLibre v6 menurunkan lokasi file worker-nya dari `import.meta.url` saat runtime, dengan asumsi file itu duduk bersebelahan dengan library-nya. Asumsi itu gugur begitu ada bundler — file worker tidak ikut ter-emit, URL-nya 404, worker mati, dan semua parsing GeoJSON (yang memang terjadi di worker) tidak pernah selesai. Basemap raster tetap tampil karena decoding-nya di main thread. **Ini terjadi di dev maupun di build produksi.** Solusinya: turun ke **v5**, yang mem-bundle worker-nya sebagai blob dan karena itu self-contained.

**b. `installLayers` bergantung pada event yang salah.** Awalnya layer dipasang di `map.on('load')`. Event itu baru menyala setelah **seluruh tile awal** selesai dimuat — jadi kalau basemap lambat, diblokir, atau offline, layer datanya ikut tidak pernah terpasang. Gate yang benar adalah `'style.load'`, yang menyala begitu spesifikasi style selesai di-parse, tidak peduli tile-nya sudah masuk atau belum. (`isStyleLoaded()` juga salah — sama-sama menunggu tile.)

Bonus kecil: container peta berubah ukuran tiap rail dibuka/ditutup, dan tanpa `ResizeObserver` → `map.resize()`, MapLibre tetap meminta tile untuk area lama sehingga ada pita kosong di tepi peta.

## 8. Peran AI, dan pengakuan yang harus dibaca

**Yang terjadi sekarang:** dua modul yang disebut "AI" — `enrich.ts` (klasifikasi) dan `ai.ts` (asisten) — keduanya **deterministik dan rule-based, bukan LLM.**

Itu pilihan sadar:

- Jalan offline, gratis, instan, tanpa API key.
- Hasilnya bisa diaudit baris per baris. Kalau juri bertanya "kenapa titik ini masuk tema mobilitas?", jawabannya bisa ditunjuk ke kata mana yang memicunya.
- Jadi baseline. Nanti kalau LLM dipasang, ada pembanding untuk membuktikan LLM-nya memang lebih baik — bukan sekadar lebih mahal.

**Yang layak dipertahankan waktu pindah ke LLM:** asisten spasialnya **tidak pernah mengarang angka**. Semua angka di jawabannya ditarik dari `computeInsights()` / `computeNodeStats()` — objek yang sama yang dipetakan. Rancangan versi LLM memakai *tool use*: model hanya boleh memanggil `getNodeStats()`, `setMapFilter()`, `flyTo()`, lalu merangkai kalimat dari nilai yang dikembalikan. Model tidak pernah diberi izin menulis angka sendiri. Itu yang membuat halusinasi angka nyaris mustahil, dan itu poin yang layak masuk bagian "validasi hasil AI" di proposal.

Setiap jawaban punya tombol **"Lihat jejak nalar"** yang membuka langkah yang ditempuh: input → dataset aktif → intent terdeteksi → query spasial → jumlah hasil → output. Persis empat hal yang diminta panitia (input, proses, output, validasi).

**Peran AI berbeda per dataset**, dan panel Metode menampilkannya:

| Dataset | Peran AI |
|---|---|
| Community Maps | **Menciptakan kategori dari nol** — tidak ada kolom tema sama sekali |
| Properti Go | Berikutnya: klasifikasi visual "Foto Tampak Depan" (kondisi bangunan, undakan/ramp) |
| Struk Go | Berikutnya: OCR foto struk — satu-satunya jalan mendapat angka rupiah |
| Menu Go | Normalisasi teks "Menu Utama" jadi taksonomi konsisten |

Tiap titik membawa `categorySource`, dan UI menampilkannya sebagai badge hijau (kolom asli data) atau ungu (hasil AI). Angka dari kolom panitia tidak boleh terlihat sama meyakinkannya dengan tebakan model.

## 9. Terhadap ketentuan lomba

| Ketentuan | Status | Catatan |
|---|---|---|
| Peta interaktif sebagai elemen utama | ✅ | Peta mengisi kolom tengah, panel mengelilinginya |
| Zoom, klik objek, filter, tabel lokasi, tabel atribut, layer control | ✅ | Semua ada |
| **Basemap MAPID MAPS** | ⚠️ | Slot env sudah disiapkan; sekarang masih CARTO/OSM |
| Visualisasi layer + chart/tabel | ✅ | 6 layer, 3 jenis chart, tabel sortable |
| **AI di dalam interface** | ✅ | Tab AI + hasil klasifikasi tampil di popup, tabel, dan filter |
| Output AI bisa dipetakan | ✅ | Kategori jadi warna titik; jawaban AI mengubah filter peta |
| Ada analisis & insight | ✅ | Spatial join, indexing, 7 temuan, rekomendasi bertarget |
| Pakai data dasar panitia | ✅ | Keempatnya, bergantian |
| Responsif desktop & mobile | ✅ | < 980 px: rail berubah jadi bottom sheet bertab |
| Loading wajar | ✅ | 430 kB gzip, data lokal, tanpa request API |
| Deploy publik | ⛔ | Belum — Vite + Vercel, tinggal `vercel deploy` |
| Analisis pakai tools open-source | ⚠️ | Sekarang di TypeScript; rencana network analysis lewat QGIS |
| Survey activities | ⛔ | Baru relevan setelah lolos 50 besar |

## 10. Keputusan desain yang perlu dijelaskan

**a. Kenapa dataset tidak digabung?** Menumpuk 590 properti dengan 15 struk membuat agregat apa pun didominasi properti. Selain itu metrik sekundernya tidak sepadan — keluhan, kos, non-tunai, dan keramaian bukan hal yang bisa dijumlahkan. Perbandingan dilakukan dengan berpindah dataset.

**b. Kenapa nearest-neighbour (Voronoi), bukan buffer 1 km, untuk catchment?** Versi pertama pakai buffer keras 1 km. Hasilnya 8 dari 10 simpul dapat skor 0 dan indeksnya tidak membedakan apa pun. Nearest-neighbour + peluruhan `exp(−d/1500)` membuat setiap simpul punya wilayah, tapi titik jauh tetap dihitung kecil. Buffer 1 km-nya masih dipakai — sebagai layer visual dan sebagai kolom "dalam radius", supaya kedua sudut pandang terlihat berdampingan.

**c. Kenapa bobot indeks ditulis terbuka di UI?** Karena indeks komposit apa pun adalah opini yang menyamar jadi angka. Menyembunyikan bobotnya bikin angkanya terasa objektif padahal tidak. Menuliskannya membuat juri bisa mendebat bobotnya — percakapan yang lebih baik daripada mereka diam-diam curiga.

**d. Kenapa panel Metode memuat daftar batasan?** Prototipe ini punya enam kelemahan nyata (n kecil di tiga dataset, rule-based, koordinat perkiraan, haversine bukan network, foto belum dipakai, bias kontributor). Semuanya akan ketahuan kalau ada yang melihat kodenya. Menuliskannya duluan lebih murah daripada ketahuan belakangan.

## 11. Yang belum dikerjakan

| Prioritas | Item |
|---|---|
| Tinggi | Basemap MAPID MAPS (butuh akses) |
| Tinggi | Klasifikasi foto — >1.300 foto belum disentuh sama sekali |
| Tinggi | OCR struk — tanpa itu Struk Go tidak punya angka rupiah |
| Tinggi | Validasi klasifikasi: label manual → akurasi & Cohen's kappa |
| Sedang | Ganti koordinat 17 simpul dengan OSM/BIG/KAI |
| Sedang | Network analysis di atas jaringan jalan (QGIS), ganti haversine |
| Sedang | Deploy ke Vercel |
| Sedang | Ganti `ask()` ke LLM dengan tool use |
| Sedang | Dimensi waktu — `Tanggal`+`Waktu` sudah ada di Struk Go & Menu Go tapi belum dianalisis |
| Rendah | Code splitting — MapLibre + data Properti Go bisa di-lazy-load |
| Rendah | Uji aksesibilitas (kontras, navigasi keyboard, screen reader) |

## 12. Catatan untuk keputusan ide lomba

Prototipe ini sengaja dibuat **agnostik terhadap ide**. Yang dibangun adalah rangkanya: adapter → cleaning → enrichment → spatial join → indexing → insight → AI interface. Empat kandidat ide di brief semuanya memakai rangka yang sama; yang berubah cuma leksikon, data pendukung, dan rumus indeksnya.

Tiga hal yang berguna untuk pengambilan keputusan, dari hasil benar-benar mengolah datanya:

1. **Properti Go adalah satu-satunya dataset yang layak jadi tulang punggung analisis.** 590 baris vs 15–25. Ide apa pun yang bertumpu pada Community Maps, Struk Go, atau Menu Go saja akan sulit dipertahankan di depan juri yang menanyakan ukuran sampel.

2. **Foto tampak depan Properti Go adalah aset paling kuat yang belum dipakai siapa pun.** 1.180 foto bangunan, terkait koordinat, siap diklasifikasi. Kandidat ide "Pilihan Semu" di brief bertumpu persis pada ini — dan sekarang jelas datanya memang ada dan memang banyak.

3. **Temuan "kos 0% dalam 1 km" sudah jadi hook yang siap pakai.** Satu angka, mudah diingat, langsung terhubung ke isu transportasi massal, dan berasal dari dataset yang cukup besar untuk dipertahankan. Ide apa pun yang dipilih sebaiknya bisa menjelaskan angka ini.
