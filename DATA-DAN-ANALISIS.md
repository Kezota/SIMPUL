# Data & Analisis

Dokumen ini menjelaskan **data apa yang dipakai**, **apa yang dilakukan terhadap data itu**, dan **angka apa yang keluar**. Semua angka di sini hasil menjalankan pipeline yang benar-benar ada di `src/lib/`, bukan perkiraan.

---

## 1. Data yang tersedia

### 1.1 Data dasar panitia — Community Maps (activity)

File di repo: `src/data/activities.json` (asalnya `Sample_Activity_WebGIS2026.geojson` di `src/assets/`).

| Properti | Isi |
|---|---|
| Format | GeoJSON `FeatureCollection`, geometry `Point` |
| Jumlah | **25 fitur** |
| Cakupan | Bandung Raya — lat `-7.019` s/d `-6.819`, lon `107.428` s/d `107.616` |
| Kolom | `title`, `description`, `latitude`, `longitude`, `medias_all`, `images`, `videos` |

Panitia juga menyediakan versi `.csv`, `.shp`, `.gpkg`, `.xlsx` dari data yang sama. GeoJSON dipilih karena bisa langsung dibaca browser tanpa konversi.

**Kondisi mentahnya — hal-hal yang perlu diketahui sebelum dipakai:**

1. `latitude` dan `longitude` di dalam `properties` bertipe **string**, bukan angka. `"latitude": "-6.9679774088170126"`.
2. `geometry.coordinates` punya **tiga** angka — `[lon, lat, 0]`. Nilai Z-nya selalu 0, jadi tidak membawa informasi.
3. **Tidak ada satu pun kolom kategori.** Tidak ada tema, tidak ada jenis tempat, tidak ada tanggal. Yang ada cuma judul dan deskripsi bebas dalam bahasa Indonesia informal, penuh emoji dan hashtag.
4. `videos` sering array kosong; `medias_all` = `images` + `videos` digabung.
5. Judul dan deskripsi mengandung emoji yang bermakna (`👎` menandakan keluhan, `📈` menandakan harga naik).

Poin 3 adalah yang paling menentukan. **Data ini tidak bisa dianalisis apa-apa sebelum teksnya diubah jadi atribut terstruktur.** Di situlah tahap AI/NLP masuk, bukan sebagai tempelan.

### 1.2 Data pendukung — simpul transportasi massal

File: `src/data/transitNodes.ts` — 10 titik (stasiun KA, terminal bus, stasiun kereta cepat) di koridor Bandung–Cimahi–Padalarang.

> ⚠️ **Koordinatnya masih diketik manual sebagai perkiraan** (akurasi ± ratusan meter), supaya prototipe jalan tanpa dependensi eksternal. Untuk proposal/final wajib diganti data resmi — OpenStreetMap (`railway=station`, `amenity=bus_station`), BIG, atau data KAI — dan sumbernya dicantumkan.

### 1.3 Yang belum dipakai

Data Mission (Properti Go, Struk Go, Menu Go) belum ada sample-nya di folder ini. Kalau nanti dipakai, `Enrichment` dan `SpatialAttrs` di `src/lib/types.ts` sudah dipisah dari `RawActivity`, jadi menambah sumber data kedua tidak membongkar pipeline.

---

## 2. Pipeline pengolahan

Urutannya mengikuti kerangka B.3 di dokumen "Ketentuan Data & WebGIS".

```
activities.json
      │
      ▼
[2.1] Cleaning & standardisasi        src/lib/analysis.ts → loadActivities()
      │
      ▼
[2.2] Enrichment teks (AI/NLP)        src/lib/enrich.ts   → enrichOne()
      │
      ▼
[2.3] Analisis spasial                src/lib/analysis.ts → nearestNode(), classifyAccess()
      │
      ▼
[2.4] Agregasi & indexing             src/lib/analysis.ts → computeNodeStats()
      │
      ▼
[2.5] Insight level kota              src/lib/analysis.ts → computeInsights()
      │
      ▼
[2.6] Interface AI                    src/lib/ai.ts       → ask()
```

### 2.1 Cleaning & standardisasi

Yang dilakukan, dan alasannya:

| Tindakan | Alasan |
|---|---|
| `Number(p.latitude)` / `Number(p.longitude)` | Kolomnya string; kalau tidak dikonversi, semua perhitungan jarak jadi `NaN` |
| Buang koordinat Z | Selalu 0, tidak membawa informasi |
| Buang baris di luar bbox Indonesia (`lat -11..6`, `lon 95..141`) | Menangkap koordinat tertukar (lat/lon terbalik) atau nol |
| Buang duplikat `judul + koordinat` (5 desimal) | 5 desimal ≈ 1 meter; cukup untuk menganggap dua entri sebagai titik yang sama |
| `images ?? []`, `videos ?? []` | Menghindari `undefined.length` di hilir |
| `title` kosong → `"(tanpa judul)"` | Supaya baris tetap muncul di tabel, tidak hilang diam-diam |

**Hasil pada sample: 25 masuk, 0 dibuang.** Datanya bersih. Cleaning-nya tetap ditulis karena data survey lapangan nanti hampir pasti tidak sebersih ini, dan lebih baik saringannya sudah ada sebelum datanya datang.

### 2.2 Enrichment teks — bagian "AI"

Input: `title + description` digabung, di-lowercase, spasi dinormalkan.

**a. Klasifikasi tema.** Leksikon berbobot untuk 6 tema. Bobot 2 = kata kunci kuat, bobot 1 = kata pendukung. Skor tiap tema = jumlah bobot kata yang muncul; tema dengan skor tertinggi menang.

| Tema | Contoh kata kunci bobot 2 | Bobot relevansi transit |
|---|---|---|
| Mobilitas & Lalu Lintas | macet, bus, terminal, stasiun, kereta, angkot, tol, halte | 1.00 |
| Ekonomi & Kuliner | pasar, harga, jual, warung, kuliner, inflasi, franchise, UMKM | 0.80 |
| Infrastruktur & Fasilitas | jalan rusak, trotoar, drainase, penerangan, perpustakaan | 0.75 |
| Sosial & Komunitas | penyuluhan, warga, komunitas, seminar, pendataan, RW/RT | 0.50 |
| Lingkungan | sampah, sungai, citarum, polusi, limbah, banjir | 0.45 |
| Rekreasi & Wisata | hiking, wisata, rekreasi, olahraga, explore, libur | 0.40 |

**b. Confidence.** Menggabungkan dua hal yang berbeda:

```
margin     = (skor_tertinggi − skor_kedua) / skor_tertinggi     // seberapa tidak ambigu
evidence   = min(1, skor_tertinggi / 6)                          // seberapa tebal buktinya
confidence = 0.6 × margin + 0.4 × evidence
```

Suku `evidence` penting. Versi pertama rumus ini cuma memakai margin, dan akibatnya "Shelter Kucing Bandung" — yang cuma memicu **satu** kata kunci (skor 2 lawan 1) — dapat keyakinan **85%**. Itu keliru: menang tipis atas bukti tipis bukan keyakinan tinggi. Setelah suku `evidence` ditambahkan, angkanya turun ke 43%, dan itu jujur.

**c. Deteksi nada.** Hitung kata keluhan (`macet`, `rusak`, `sampah`, `telat`, `ngantri`, `👎`, …) vs kata apresiasi (`mantab`, `seru`, `enak`, `alhamdulillah`, …). Yang lebih banyak menang; seri → netral.

**d. Ekstraksi tag.** Hashtag eksplisit (`#hargasayur`, `#Hiking`) + kata kunci bobot 2 yang benar-benar muncul. Kalau nihil, ambil kata terpanjang non-stopword.

**e. Ekstraksi harga.** Regex untuk `44rb`, `25 ribu`, `Rp15.000`. Berguna nanti kalau digabung Menu Go / Struk Go.

**f. Skor dokumentasi.** `min(1, (jumlah_foto + 2 × jumlah_video) / 10)`. Video dihitung dua kali foto karena lebih informatif untuk verifikasi kondisi lapangan.

**g. Relevansi transit.** `bobot_tema × (0.6 + 0.4 × confidence)`. Aktivitas bertema mobilitas yang klasifikasinya yakin bernilai penuh; aktivitas rekreasi yang klasifikasinya ragu bernilai kecil.

### 2.3 Analisis spasial

- **Jarak**: haversine, ditulis manual di `src/lib/geo.ts` (bukan turf.js) supaya rumusnya kelihatan dan bundle-nya kecil.
- **Nearest-neighbour join**: tiap aktivitas dikaitkan ke satu simpul terdekat. Ini sekaligus membentuk **catchment ala Voronoi** — tiap simpul "memiliki" wilayah yang paling dekat kepadanya.
- **Klasifikasi keterjangkauan**:

| Kelas | Ambang | Tafsiran |
|---|---|---|
| Inti | ≤ 500 m | 5–7 menit jalan kaki |
| Dekat | 500 m – 1 km | Masih catchment pejalan kaki (ambang TOD lazim) |
| Sedang | 1 – 2 km | Butuh feeder / kendaraan lanjutan |
| Luar jangkauan | > 2 km | Praktis tidak terlayani transit |

- **Buffer geodesik**: `circlePolygon()` menghasilkan poligon lingkaran 64 sisi di sekitar tiap simpul, dipakai untuk layer radius layanan di peta.
- **Deteksi blank spot**: aktivitas berkelas "luar" — kandidat rute angkutan pengumpan.

### 2.4 Indeks Denyut Transit

Pertanyaan yang dijawab: *seberapa hidup kawasan yang bergantung pada simpul ini, menurut warga yang benar-benar ada di sana?*

```
volume     = Σ exp(−d / 1500)   atas catchment, lalu dinormalisasi 0–1
relevansi  = rata-rata transitRelevance di catchment
bukti      = rata-rata mediaScore di catchment

pulse = (0.40 × volume + 0.30 × relevansi + 0.30 × bukti) × 100
```

**Kenapa peluruhan jarak, bukan buffer 1 km?** Versi pertama memakai buffer keras 1 km. Hasilnya: **8 dari 10 simpul dapat skor 0**, dan indeksnya jadi tidak bisa membedakan apa pun. Peluruhan `exp(−d/1500)` memberi bobot ~0.51 pada 1 km, ~0.26 pada 2 km, ~0.07 pada 4 km — titik jauh tetap terhitung tapi kecil, dan tidak ada kepura-puraan bahwa titik 4 km itu "dekat". Setelah diganti, 6 dari 10 simpul punya nilai yang bisa dibandingkan.

Bobot 40/30/30 dipilih manual dan sengaja ditulis terbuka supaya bisa didebat. Di versi final sebaiknya dikalibrasi terhadap data pembanding (misalnya jumlah naik-turun penumpang) dan sensitivitasnya dilaporkan.

---

## 3. Hasil pada sample data

### 3.1 Klasifikasi 25 titik

| # | Judul | Tema | Conf | Nada | Simpul terdekat | Jarak | Kelas |
|---|---|---|---|---|---|---|---|
| 1 | Macet cicukang | mobilitas | 0.80 | keluhan | Leuwipanjang | 4.063 m | luar |
| 2 | Sawah Menghijau 🌾 | lingkungan | 0.40 | netral | Leuwipanjang | 10.399 m | luar |
| 3 | Inflasi Harga Sayur 📈🌶️ | ekonomi | 1.00 | netral | Leuwipanjang | 3.491 m | luar |
| 4 | Bakar Sampah 👎 | lingkungan | 0.83 | keluhan | Leuwipanjang | 5.556 m | luar |
| 5 | Ayo Naik Bus 🚍🚏 | mobilitas | 0.80 | apresiasi | Gadobangkong | 2.001 m | luar |
| 6 | nasi segala warna aya | ekonomi | 0.67 | netral | Leuwipanjang | 1.791 m | sedang |
| 7 | Shelter Kucing Bandung 🐱 | infrastruktur | 0.43 | netral | Ledeng | 1.418 m | sedang |
| 8 | Special Soto Boyolali 🍲 | ekonomi | 0.80 | apresiasi | St. Bandung | 1.869 m | sedang |
| 9 | Pameran Franchise IFBC | ekonomi | 0.13 | apresiasi | St. Bandung | 2.483 m | luar |
| 10 | Sinar Warisan | *lainnya* | 0.00 | netral | St. Bandung | 2.221 m | luar |
| 11 | Jalur Hiking KBP ⛰️ | mobilitas | 0.40 | apresiasi | Padalarang | 6.416 m | luar |
| 12 | Olahraga dulu | rekreasi | 0.80 | netral | St. Bandung | 1.717 m | sedang |
| 13 | Kuliner Fancy Kabupaten | ekonomi | 0.42 | apresiasi | Leuwipanjang | 10.366 m | luar |
| 14 | Qurban Day | sosial | 0.43 | netral | Leuwipanjang | 3.121 m | luar |
| 15 | Bobotoh PERSIB Convoy ⚽️ | sosial | 0.43 | netral | Cimindi | 2.953 m | luar |
| 16 | Modern Market Lembang | ekonomi | 1.00 | apresiasi | Ledeng | 5.077 m | luar |
| 17 | Seminar Work Abroad | sosial | 0.80 | netral | St. Bandung | **795 m** | dekat |
| 18 | Donat Ketan TKI | ekonomi | 0.73 | apresiasi | Leuwipanjang | 4.195 m | luar |
| 19 | Aktivitas Pasar 🛒 | ekonomi | 0.93 | netral | Leuwipanjang | 3.481 m | luar |
| 20 | Baca Buku Ngantri di Perpustakaan | infrastruktur | 0.43 | keluhan | Leuwipanjang | 10.531 m | luar |
| 21 | Jual Printer UV Bekas | ekonomi | 1.00 | netral | Leuwipanjang | 5.188 m | luar |
| 22 | menikmati hari libur 😊 | rekreasi | 0.42 | apresiasi | Gadobangkong | 4.209 m | luar |
| 23 | Sudah 2x Gubernur Datang, Jalan Masih Rusak 📣 | lingkungan | 0.60 | keluhan | Leuwipanjang | 5.157 m | luar |
| 24 | Praktikum LiDAR Handheld | sosial | 0.72 | apresiasi | Ledeng | **276 m** | inti |
| 25 | Penyuluhan RW 16 💭 | sosial | 1.00 | netral | Leuwipanjang | 4.926 m | luar |

### 3.2 Agregat

**Komposisi tema** — ekonomi 9 · sosial 5 · mobilitas 3 · lingkungan 3 · infrastruktur 2 · rekreasi 2 · belum terklasifikasi 1

**Keterjangkauan** — inti 1 · dekat 1 · sedang 4 · **luar jangkauan 19**

**Angka kunci:**

| Indikator | Nilai |
|---|---|
| Dalam 1 km dari simpul transit | **8%** (2 dari 25) |
| Jarak median ke simpul terdekat | **3.491 m** |
| Laporan bernada keluhan | 16% (4 dari 25) |
| Titik di luar jangkauan (> 2 km) | 19 |
| Klasifikasi berkeyakinan rendah (< 0.4) | 2 dari 25 |

### 3.3 Indeks Denyut Transit per simpul

| Simpul | Denyut | Catchment | Dalam radius 1 km | Jarak rata-rata | Tema dominan |
|---|---|---|---|---|---|
| Terminal Ledeng | 69 | 3 | 1 | 2.257 m | ekonomi |
| Stasiun Bandung | 67 | 5 | 1 | 1.817 m | ekonomi |
| Terminal Leuwipanjang | 54 | **13** | **0** | 5.559 m | ekonomi |
| Stasiun Padalarang | 53 | 1 | 0 | 6.416 m | mobilitas |
| Stasiun Gadobangkong | 52 | 2 | 0 | 3.105 m | mobilitas |
| Stasiun Cimindi | 33 | 1 | 0 | 2.953 m | sosial |
| Stasiun Kiaracondong | 0 | 0 | 0 | — | — |
| Stasiun Cimahi | 0 | 0 | 0 | — | — |
| Stasiun Whoosh Padalarang | 0 | 0 | 0 | — | — |
| Terminal Cicaheum | 0 | 0 | 0 | — | — |

---

## 4. Temuan

**a. Hanya 8% aktivitas warga berada dalam jarak jalan kaki dari transit.** Jarak median 3,5 km. Dengan kata lain: kehidupan sehari-hari yang tercatat di data ini terjadi di tempat yang tidak bisa dijangkau dengan kaki dari stasiun atau terminal mana pun.

**b. Terminal Leuwipanjang adalah kasus paling menarik.** Catchment-nya terbesar (13 dari 25 aktivitas paling dekat ke sana) tapi **tidak satu pun** berada dalam radius 1 km, dan jarak rata-ratanya 5,5 km. Ini pola "bergantung tapi tidak terhubung" — kawasan Cimahi Selatan / Margaasih secara geografis mengarah ke Leuwipanjang, tapi terlalu jauh untuk berjalan kaki. Persis profil wilayah yang butuh angkutan pengumpan, bukan simpul baru.

**c. Empat simpul sunyi.** Kiaracondong, Cimahi, Whoosh Padalarang, dan Cicaheum tidak menjadi simpul terdekat bagi satu pun laporan. Ini **bukan** bukti kawasannya mati — ini titik buta data. Yang terjadi: kontributor Community Maps kebetulan terkonsentrasi di barat daya. Temuan ini justru yang paling operasional: survey activities MAPID APPS sebaiknya diarahkan ke empat simpul itu dulu supaya indeksnya tidak bias.

**d. Ekonomi mendominasi (9 dari 25).** Isi laporan warga di sekitar simpul lebih banyak soal harga, pasar, warung, dan kuliner daripada soal transportasi itu sendiri. Kalau arah idenya nanti soal ekosistem ekonomi sekitar stasiun, data dasarnya mendukung.

---

## 5. Batasan yang harus diakui

1. **n = 25.** Semua angka di atas sah secara perhitungan tapi lemah secara statistik. Ini prototipe metode, bukan temuan final.
2. **Klasifikasi masih rule-based**, bukan LLM. Konsekuensinya nyata dan terlihat di tabel:
   - *"Pameran Franchise IFBC"* → confidence 0.13, hampir seri antara ekonomi dan rekreasi.
   - *"Jalur Hiking KBP"* → masuk **mobilitas** karena kata "rute" dan "jalur", padahal jelas rekreasi. Ini salah.
   - *"Sinar Warisan"* → tidak terklasifikasi sama sekali; deskripsinya cuma "Sop Kornet".
   - *"Sudah 2x Gubernur Datang, Jalan Masih Rusak"* → masuk **lingkungan**, bukan infrastruktur. Ini sebetulnya **benar**: judulnya soal jalan rusak, tapi deskripsinya mengungkap lokasi itu adalah TPA. Contoh bagus kenapa deskripsi harus dibaca, bukan cuma judul.
3. **Jarak masih garis lurus (haversine)**, belum network analysis di atas jaringan jalan. Artinya semua angka jarak **terlalu optimistis** — jarak berjalan kaki yang sebenarnya selalu lebih panjang, apalagi kalau terpotong rel atau sungai.
4. **Koordinat simpul transit adalah perkiraan manual.**
5. **Foto belum dianalisis.** Padahal 25 laporan ini membawa ~130 foto dan beberapa video, dan itu aset terbesar dataset ini yang belum disentuh.

---

## 6. Rencana peningkatan

| Sekarang | Berikutnya | Kenapa |
|---|---|---|
| Klasifikasi leksikon | LLM (`enrich.ts` sudah menyediakan titik ganti + rancangan prompt) | Menangkap konteks, bukan cuma kata kunci — kasus "Jalur Hiking" tidak akan salah |
| Foto tidak dipakai | Model multimodal → kategori kondisi fasilitas | Ini persis contoh yang panitia tulis sendiri di tabel C.2 |
| Simpul perkiraan | OSM / BIG / KAI | Akurasi + sumber bisa dicantumkan |
| Haversine | Network analysis (OSM pedestrian network via QGIS) | Jarak realistis, bukan garis lurus |
| Tanpa validasi | Label manual ±30 titik → hitung akurasi & Cohen's kappa | Yang dilaporkan ke juri angka akurasinya, bukan klaim "pakai AI" |
| Tanpa dimensi waktu | Gabung Struk Go (ada tanggal & jam transaksi) | Membuka analisis "kapan kawasan hidup vs kapan transit jalan" |

Soal validasi: dengan n=25 sekarang, cara paling cepat adalah melabeli sendiri ke-25 titik itu secara manual lalu membandingkan dengan output classifier. Dari tabel di §3.1, minimal 1 jelas salah (Jalur Hiking) dan 1 tidak terklasifikasi — jadi akurasi kasarnya sekitar 23/25 ≈ **92%**, dengan catatan penilaian itu dilakukan oleh orang yang menulis leksikonnya sendiri, jadi bias. Pelabelan oleh anggota tim lain akan lebih dipercaya.
