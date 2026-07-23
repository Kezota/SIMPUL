# Denyut Simpul — prototipe WebGIS

Prototipe eksplorasi untuk **MAPID WebGIS Competition 2026** (*Maps That Think! — Mass Transportation Edition*).

> **Status: eksplorasi teknis, bukan submission.** Tujuannya membuktikan bahwa alur data mentah → analisis → insight → interface AI bisa dirakit dan berjalan, dan mencari tahu di mana bagian sulitnya. Ide lombanya sendiri belum dikunci.

Penjelasan datanya ada di **[DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md)**.

---

## 1. Yang dibangun

Sebuah WebGIS satu halaman yang membaca 25 laporan warga dari Community Maps MAPID, mengubah teks bebasnya menjadi atribut terstruktur, mengaitkannya ke 10 simpul transportasi massal di Bandung Raya, lalu menjawab satu pertanyaan:

> **Kehidupan yang direkam warga itu sebenarnya terjadi di mana relatif terhadap transit — dan simpul mana yang kawasannya "hidup" tapi tidak benar-benar terhubung?**

Jawaban singkatnya dari sample data: hanya **8%** aktivitas berada dalam jarak jalan kaki dari simpul mana pun, dan Terminal Leuwipanjang punya catchment terbesar (13 aktivitas) dengan **nol** di antaranya dalam radius 1 km.

## 2. Apa yang ada di layar

```
┌──────────────────────────────────────────────────────────────────────┐
│  Denyut Simpul                          25 laporan · 10 simpul  🌙   │
├─────────────┬────────────────────────────────────┬───────────────────┤
│  KONTROL    │            PETA                    │  Insight │ AI │…  │
│             │                                    │                   │
│  Layer      │   • titik = laporan warga          │  Angka utama      │
│  ☑ aktivitas│     (warna = tema)                 │  Indeks Denyut    │
│  ☑ heatmap  │   ◆ simpul transit + jumlah        │  Komposisi tema   │
│  ☑ simpul   │   ○ radius layanan 1 km            │  Donut akses      │
│  ☑ radius   │   ╌ garis ke simpul terdekat       │  Rekomendasi      │
│  ☐ garis    │                                    │                   │
│             │   [legenda]                        │                   │
│  Filter     │                                    │                   │
│  🔍 cari    │                                    │                   │
│  tema ●●●●  │                                    │                   │
│  akses ●●●● ├────────────────────────────────────┤                   │
│  slider     │  ▴ Tabel Atribut · 25 baris        │                   │
└─────────────┴────────────────────────────────────┴───────────────────┘
```

**Empat tab di kanan:**

| Tab | Isi |
|---|---|
| **Insight** | 4 stat utama, bar chart Indeks Denyut per simpul (bisa diklik → peta terbang ke sana), komposisi tema, donut keterjangkauan, rekomendasi bertarget stakeholder |
| **AI** | Asisten spasial — ketik pertanyaan bahasa Indonesia, dapat jawaban **dan** filter petanya ikut berubah |
| **Detail** | Atribut lengkap titik/simpul yang diklik: foto lapangan, hasil pembacaan AI, tag, jarak, tafsiran kelas akses |
| **Metode** | 8 langkah pipeline + daftar batasan yang diakui + sumber data |

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

Ketentuan lomba mewajibkan MAPID MAPS sebagai basemap utama. Style URL-nya baru didapat setelah registrasi, jadi prototipe ini sementara pakai CARTO/OSM. Begitu URL-nya ada, buat `.env.local`:

```bash
echo 'VITE_MAPID_STYLE_URL=<style url dari MAPID MAPS>' > .env.local
```

Tidak ada kode lain yang perlu diubah — `src/lib/basemap.ts` otomatis memakainya, dan catatan peringatan kuning di panel Kontrol berubah jadi hijau.

## 4. Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Peta | **MapLibre GL JS v6** | Open source, mendukung style vektor MapLibre/Mapbox — paling aman untuk basemap MAPID MAPS |
| Frontend | **React 19 + TypeScript + Vite** | Sesuai project yang sudah ada |
| Chart | **SVG + CSS murni** | Cuma butuh dua bentuk (bar & donut); tidak sepadan menambah 100 kB dependency |
| Geospasial | **Ditulis manual** (`src/lib/geo.ts`) | Haversine + buffer geodesik cukup 100 baris; turf.js akan menyembunyikan rumusnya |
| State | `useState` + `useMemo` | Skalanya belum butuh state manager |

Dependency runtime: **`maplibre-gl` saja**. Bundle 343 kB gzip, dan 90%-nya MapLibre.

## 5. Struktur file

```
src/
├── data/
│   ├── activities.json        Community Maps — 25 fitur (data dasar panitia)
│   └── transitNodes.ts        10 simpul transit ⚠️ koordinat masih perkiraan
│
├── lib/                       ← semua logika, tanpa React
│   ├── types.ts               Kontrak data: RawActivity → Enrichment → Activity
│   ├── geo.ts                 haversine, buffer geodesik, median, normalisasi
│   ├── enrich.ts              AI/NLP: klasifikasi tema, nada, tag, harga
│   ├── analysis.ts            cleaning, spatial join, Indeks Denyut, insight
│   ├── ai.ts                  intent parser + narasi + rekomendasi
│   └── basemap.ts             MAPID MAPS (via env) / fallback CARTO
│
├── components/
│   ├── MapView.tsx            MapLibre: 8 layer, marker HTML, popup
│   ├── ControlPanel.tsx       layer control + filter
│   ├── InsightPanel.tsx       stat, chart, rekomendasi
│   ├── AIAssistant.tsx        chat + jejak nalar
│   ├── DetailPanel.tsx        detail titik & simpul
│   ├── DataTable.tsx          tabel atribut, sortable
│   ├── MethodPanel.tsx        metodologi & batasan
│   └── charts.tsx             BarList, Donut, Stat
│
├── App.tsx                    komposisi + state + layout responsif
└── webgis.css                 token warna, light/dark, breakpoint mobile
```

Pemisahan `lib/` dan `components/` disengaja: **seluruh analisis bisa dijalankan tanpa browser**. Itu yang membuat angka-angka di `DATA-DAN-ANALISIS.md` bisa diverifikasi dengan menjalankan pipeline-nya di Node, bukan dengan membaca layar.

## 6. Layer peta

| Layer | Tipe MapLibre | Isi |
|---|---|---|
| `act-heat` | heatmap | Kepadatan, dibobot relevansi transit; memudar saat zoom > 13 |
| `act-halo` / `act-circle` | circle | Titik laporan, warna dari tema, cincin merah = keluhan |
| `act-selected` | circle | Cincin gelap penanda seleksi |
| `radius-fill` / `radius-line` | fill + line | Buffer 1 km; opasitas isian mengikuti Indeks Denyut |
| `links-line` | line | Garis titik → simpul terdekat; merah kalau > 2 km |
| simpul transit | HTML `Marker` | Ikon + label + jumlah catchment |

Simpul dibuat sebagai marker HTML, bukan symbol layer, supaya labelnya tidak butuh font glyph dari server eksternal — satu ketergantungan jaringan lebih sedikit, dan gampang di-styling lewat CSS.

## 7. Peran AI, dan pengakuan yang harus dibaca

**Yang terjadi sekarang:** dua modul yang disebut "AI" — `enrich.ts` (klasifikasi) dan `ai.ts` (asisten) — keduanya **deterministik dan rule-based, bukan LLM.**

Itu pilihan sadar, bukan kelalaian:

- Jalan offline, gratis, instan, tanpa API key.
- Hasilnya bisa diaudit baris per baris. Kalau juri bertanya "kenapa titik ini masuk tema mobilitas?", jawabannya bisa ditunjuk ke kata mana yang memicunya.
- Jadi baseline. Nanti kalau LLM dipasang, ada pembanding untuk membuktikan LLM-nya memang lebih baik — bukan sekadar lebih mahal.

**Yang layak dipertahankan waktu pindah ke LLM:** asisten spasialnya **tidak pernah mengarang angka**. Semua angka di jawabannya ditarik dari `computeInsights()` / `computeNodeStats()` — objek yang sama yang dipetakan. Rancangan versi LLM-nya memakai *tool use*: model hanya boleh memanggil `getNodeStats()`, `setMapFilter()`, `flyTo()`, lalu merangkai kalimat dari nilai yang dikembalikan. Model tidak pernah diberi izin menulis angka sendiri. Itu yang membuat halusinasi angka nyaris mustahil, dan itu poin yang layak masuk bagian "validasi hasil AI" di proposal.

Setiap jawaban asisten juga punya tombol **"Lihat jejak nalar"** yang membuka langkah-langkah yang ditempuh: input → intent yang terdeteksi → query spasial → jumlah hasil → output. Persis empat hal yang diminta panitia (input, proses, output, validasi).

**Contoh pertanyaan yang dipahami:**

- "Ringkas kondisi keseluruhan"
- "Bagaimana kondisi Stasiun Cimahi?"
- "Mana aktivitas ekonomi dalam 1 km dari simpul?"
- "Tunjukkan titik di luar jangkauan transit"
- "Simpul mana yang paling ramai?"
- "Apa rekomendasi untuk Dinas Perhubungan?"

Di luar pola itu, dia akan bilang belum paham — dan itu memang perilaku yang benar untuk sistem rule-based, daripada mengarang.

## 8. Terhadap ketentuan lomba

| Ketentuan | Status | Catatan |
|---|---|---|
| Peta interaktif sebagai elemen utama | ✅ | Peta mengisi kolom tengah, panel mengelilinginya |
| Zoom, klik objek, filter, tabel lokasi, tabel atribut, layer control | ✅ | Semua ada |
| **Basemap MAPID MAPS** | ⚠️ | Slot env sudah disiapkan; sekarang masih CARTO/OSM |
| Visualisasi layer + chart/tabel | ✅ | 6 layer, 3 jenis chart, tabel sortable |
| **AI di dalam interface** | ✅ | Tab AI + hasil klasifikasi tampil di popup, tabel, dan filter |
| Output AI bisa dipetakan | ✅ | Tema hasil klasifikasi jadi warna titik; jawaban AI mengubah filter peta |
| Ada analisis & insight, bukan cuma tampil data | ✅ | Spatial join, indexing, 4 temuan, rekomendasi bertarget |
| Responsif desktop & mobile | ✅ | < 980 px: rail berubah jadi bottom sheet bertab |
| Loading wajar | ✅ | 343 kB gzip, data lokal, tanpa request API |
| Deploy publik | ⛔ | Belum — Vite + Vercel, tinggal `vercel deploy` |
| Analisis pakai tools open-source | ⚠️ | Sekarang di TypeScript; rencana network analysis lewat QGIS |
| Survey activities | ⛔ | Baru relevan setelah lolos 50 besar |

## 9. Keputusan desain yang perlu dijelaskan

**a. Kenapa nearest-neighbour (Voronoi), bukan buffer 1 km, untuk catchment?**
Versi pertama pakai buffer keras 1 km. Hasilnya 8 dari 10 simpul dapat skor 0 dan indeksnya tidak bisa membedakan apa pun. Nearest-neighbour + peluruhan jarak `exp(−d/1500)` membuat setiap simpul punya wilayah, tapi titik jauh tetap dihitung kecil. Buffer 1 km-nya masih dipakai — sebagai layer visual dan sebagai kolom "dalam radius", supaya kedua sudut pandang tetap terlihat berdampingan.

**b. Kenapa bobot indeks ditulis terbuka di UI?**
Karena indeks komposit apa pun adalah opini yang menyamar jadi angka. Menyembunyikan bobotnya bikin angkanya terasa objektif padahal tidak. Menuliskannya membuat juri bisa mendebat bobotnya — dan itu percakapan yang lebih baik daripada mereka diam-diam curiga.

**c. Kenapa panel Metode memuat daftar batasan?**
Prototipe ini punya lima kelemahan nyata (n kecil, rule-based, koordinat perkiraan, haversine bukan network, foto belum dipakai). Semuanya akan ketahuan kalau ada yang melihat kodenya. Menuliskannya duluan lebih murah daripada ketahuan belakangan.

## 10. Yang belum dikerjakan

| Prioritas | Item |
|---|---|
| Tinggi | Basemap MAPID MAPS (butuh akses) |
| Tinggi | Klasifikasi foto — 25 laporan membawa ~130 foto yang belum disentuh sama sekali |
| Tinggi | Validasi klasifikasi: label manual → hitung akurasi & Cohen's kappa |
| Sedang | Ganti koordinat simpul dengan OSM/BIG |
| Sedang | Network analysis di atas jaringan jalan (QGIS), ganti haversine |
| Sedang | Deploy ke Vercel |
| Sedang | Ganti `ask()` ke LLM dengan tool use |
| Rendah | Dimensi waktu (butuh Struk Go) |
| Rendah | Code splitting — MapLibre bisa di-lazy-load |
| Rendah | Uji aksesibilitas (kontras, navigasi keyboard, screen reader) |

## 11. Catatan untuk keputusan ide lomba

Prototipe ini sengaja dibuat **agnostik terhadap ide**. Yang dibangun adalah rangkanya: cleaning → enrichment teks → spatial join → indexing → insight → AI interface. Empat kandidat ide di brief (*Pilihan Semu*, *Jam-Jam Yatim*, *Kos yang Menipu*, *Sisi Rel yang Salah*) semuanya memakai rangka yang sama; yang berubah cuma leksikon, data pendukung, dan rumus indeksnya.

Dua hal yang berguna untuk pengambilan keputusan, dari hasil mengolah datanya:

1. **Data Community Maps sangat bergantung pada teks bebas dan foto.** Ide yang inti solusinya justru di dua hal itu (seperti *Pilihan Semu*, yang bertumpu pada foto tampak depan) punya keunggulan struktural — datanya benar-benar dipakai, bukan ditempel.
2. **Sebaran kontributor tidak merata dan itu bias yang nyata.** Empat simpul tidak punya data sama sekali. Ide apa pun yang dipilih perlu punya jawaban untuk "bagaimana kalau kawasan X tidak ada datanya" — dan jawaban paling kuat adalah menjadikan titik buta itu sebagai output, bukan menyembunyikannya.
