# Data & Analisis

Dokumen ini menjelaskan **data apa yang dipakai**, **apa yang dilakukan terhadapnya**, dan **angka apa yang keluar**. Semua angka hasil menjalankan pipeline yang benar-benar ada di `src/lib/` dan `src/data/`, bukan perkiraan.

Empat dataset panitia dipakai **bergantian, tidak digabung** — ada tombol pemilih di header WebGIS. Alasannya ada di §4.

---

## 1. Empat dataset

| Dataset | Baris | Wilayah | Kolom kategori? | File |
|---|---|---|---|---|
| **Community Maps** | 25 | Bandung Raya | ❌ tidak ada | `Sample_Activity_WebGIS2026.geojson` |
| **Properti Go** | **590** | Kota Bandung | ✅ Kategori Properti | `Properti Go Bandung.geojson` |
| **Struk Go** | 15 | Bandung | ✅ Kategori Tempat | `Sample_StrukGo_WebGIS2026.geojson` |
| **Menu Go** | 15 | **Depok** | ✅ Jenis Tempat Makan | `Sample_MenuGo_WebGIS2026.geojson` |

Tiga hal yang paling menentukan sebelum ngoding:

**a. Cuma Properti Go yang punya jumlah baris layak.** 590 vs 15–25. Semua kesimpulan dari tiga dataset lain berstatus ilustrasi metode, bukan temuan.

**b. Menu Go tidak berada di Bandung.** Koordinatnya `-6.42..-6.40, 106.82..106.85` — itu Margonda, Depok. Membandingkannya dengan Stasiun Bandung tidak ada artinya. Karena itu WebGIS ini punya **dua kelompok simpul transit** dan otomatis berpindah mengikuti wilayah dataset aktif.

**c. Cuma Community Maps yang butuh AI untuk mengategorikan.** Tiga dataset lain sudah membawa kolom kategori dari panitia. Ini mengubah peran AI secara fundamental — lihat §3.

### 1.1 Kondisi mentah tiap dataset

**Community Maps** — `title`, `description`, `latitude`, `longitude`, `medias_all`, `images`, `videos`
- `latitude`/`longitude` di `properties` bertipe **string**, bukan angka
- `geometry.coordinates` punya tiga angka `[lon, lat, 0]`; Z-nya selalu 0
- Teks bebas bahasa Indonesia informal, penuh emoji dan hashtag. `👎` menandakan keluhan, `📈` menandakan harga naik
- ~130 foto dan 11 video — aset terbesar dataset ini

**Properti Go** — `Kategori Properti`, `Jenis Properti`, ` Tanggal`, `Alamat`, `Foto Tampak Depan`, `Foto Spanduk/Papan Promosi`, `Kontributor`, `Pengecekan`, `ID Data`
- Nama kolom tanggal punya **spasi di depan**: `" Tanggal"`
- `Pengecekan` = "Diterima" untuk 558 dari 590; 32 sisanya `null`
- 553 koordinat unik dari 590 baris — beberapa listing berbagi titik
- 1.180 foto (2 per baris)

**Struk Go** — `Nama Tempat/Merchant`, `Kategori Tempat`, `Tanggal Transaksi`, `Waktu Transaksi`, `Metode Pembayaran`, `Foto Struk/Bukti bayar`, `Kontributor`, `ID data`, + **9 kolom berakhiran "(Lama)"**
- Kesembilan kolom "(Lama)" **kosong seluruhnya** — termasuk `Total Pengeluaran (Tanpa PPN)` dan `Rating kepuasan tempat`
- `Total Pengeluran per Orang (Lama)` bernilai `0.0` untuk semua baris — bukan null, tapi nol; kalau tidak dicek bisa terhitung sebagai angka valid
- **Konsekuensinya: dataset transaksi ini tidak punya satu pun angka rupiah.** Nominalnya hanya ada di dalam foto struk

**Menu Go** — `Nama Tempat Makan`, `Jenis Tempat Makan`, `Tanggal`, `Waktu`, `Foto Tempat`, `Foto Menu 1`, `Foto Menu 2`, `Menu Utama`, `Harga Rata-rata`, `Kondisi Pembeli`, `Berkeliling`
- `Kondisi Pembeli` tersimpan sebagai kalimat panjang: `"Ramai (Terdapat antrean lebih dari 3 orang / kursi atau meja mayoritas penuh terisi)"`
- `Menu Dalam Bentuk Link Digital` kosong seluruhnya
- Satu-satunya dataset dengan **angka harga**, dan satu-satunya dengan **penilaian keramaian**

---

## 2. Arsitektur: satu mesin, empat adapter

```
community.json ─┐
propertigo.json ─┤   ┌──────────┐    ┌─────────────┐   ┌──────────────┐
strukgo.json   ─┼──▶ │ adapter  │──▶ │ Observation │──▶│ analisis     │
menugo.json    ─┘   └──────────┘    │ (seragam)   │   │ spasial      │
                     per dataset     └─────────────┘   └──────────────┘
```

`Observation` (di `src/lib/types.ts`) hanya mensyaratkan: **lokasi, judul, kategori, bukti visual** — plus slot opsional untuk kolom khas (`price`, `when`, `attributes`).

Karena bentuknya seragam, nearest-node join, kelas keterjangkauan, Indeks Denyut, dan asisten AI **tidak punya satu pun percabangan per dataset**. Menambah dataset kelima berarti menulis satu adapter, bukan menyentuh mesin analisisnya.

### 2.1 Cleaning

Yang berlaku untuk semua dataset:

| Tindakan | Alasan |
|---|---|
| Konversi tipe koordinat ke `number` | Community Maps menyimpannya sebagai string; tanpa konversi semua jarak jadi `NaN` |
| Validasi bbox Indonesia (`lat -11..6`, `lon 95..141`) | Menangkap lat/lon tertukar atau koordinat nol |
| Dedupe pakai ID resmi kalau ada | `ID Data` / `ID data`; jatuh ke `judul+koordinat` kalau tidak ada |
| Buang kolom yang kosong seluruhnya | 9 kolom "(Lama)" di Struk Go, `Menu Link Digital` di Menu Go |
| Normalisasi kategorikal kalimat panjang | `"Ramai (Terdapat antrean…)"` → `ramai` |
| Baca `" Tanggal"` **dan** `"Tanggal"` | Nama kolom Properti Go punya spasi di depan |

**Dedupe Properti Go sengaja pakai `ID Data`, bukan koordinat.** Kalau pakai koordinat, 37 listing akan terbuang — padahal dua ruko berbeda di gedung yang sama memang boleh berbagi titik.

**Hasil: 0 baris dibuang dari keempat dataset.** Datanya bersih. Saringannya tetap ditulis karena data survey lapangan nanti tidak akan sebersih ini.

---

## 3. Peran AI berbeda per dataset

Ini bagian yang paling sering disamaratakan orang, padahal bedanya besar.

| Dataset | Peran AI sekarang | Peran AI berikutnya |
|---|---|---|
| **Community Maps** | **Menciptakan kategori dari nol.** Tidak ada kolom tema; tanpa klasifikasi teks datanya tidak bisa difilter maupun diagregasi | LLM menggantikan leksikon |
| **Properti Go** | Merapikan alamat jadi tag | **Klasifikasi visual "Foto Tampak Depan"** — kondisi bangunan, ada tidaknya undakan/ramp. Persis contoh yang panitia tulis di tabel C.2 |
| **Struk Go** | Tag dari kategori + metode bayar | **OCR foto struk** — satu-satunya jalan mendapat angka rupiah, karena kolom totalnya kosong |
| **Menu Go** | Menarik jenis masakan dari teks "Menu Utama" | Normalisasi nama menu jadi taksonomi yang konsisten |

Karena itu tiap observasi membawa `categorySource: 'data' | 'ai'`, dan **UI menampilkannya sebagai badge**. Angka yang berasal dari kolom asli panitia tidak boleh terlihat sama meyakinkannya dengan angka hasil tebakan model.

### 3.1 Klasifikasi teks Community Maps

Leksikon berbobot untuk 6 tema. Bobot 2 = kata kunci kuat, bobot 1 = pendukung.

```
margin     = (skor_tertinggi − skor_kedua) / skor_tertinggi   // seberapa tidak ambigu
evidence   = min(1, skor_tertinggi / 6)                        // seberapa tebal buktinya
confidence = 0.6 × margin + 0.4 × evidence
```

Suku `evidence` penting. Versi pertama rumus ini hanya memakai margin, dan akibatnya *"Shelter Kucing Bandung"* — yang cuma memicu **satu** kata kunci (skor 2 lawan 1) — dapat keyakinan **85%**. Itu keliru: menang tipis atas bukti tipis bukan keyakinan tinggi. Setelah `evidence` ditambahkan, angkanya turun ke 43%.

**Kesalahan yang diakui** (dari 25 titik):

| Judul | Hasil | Seharusnya |
|---|---|---|
| Jalur Hiking KBP | mobilitas | rekreasi — terpicu kata "rute" & "jalur" |
| Sinar Warisan | tidak terklasifikasi | deskripsinya cuma "Sop Kornet" |
| Pameran Franchise IFBC | ekonomi (conf 0.13) | hampir seri dengan rekreasi |
| Sudah 2x Gubernur Datang, Jalan Masih Rusak | lingkungan | **benar** — judulnya soal jalan, tapi deskripsinya mengungkap lokasi itu TPA |

Akurasi kasar 23/25 ≈ **92%**, dengan catatan penilaian dilakukan oleh orang yang menulis leksikonnya sendiri, jadi bias. Pelabelan oleh anggota tim lain akan lebih dipercaya.

---

## 4. Kenapa tidak digabung

Menumpuk 590 titik properti dengan 15 struk membuat agregat apa pun didominasi properti. "Rasio walkable" gabungan akan 97% menceritakan Properti Go dan menyembunyikan tiga dataset lain.

Lebih jauh: **metrik sekundernya tidak sepadan**. Tiap dataset punya satu kolom yang paling bermakna untuk cerita transit, dan kolomnya berbeda:

| Dataset | Metrik sekunder (`highlight`) | Kenapa itu |
|---|---|---|
| Community Maps | Bernada keluhan | Satu-satunya sinyal masalah yang ada |
| Properti Go | Properti kos | Hunian sewa paling terikat pada jarak ke transit harian |
| Struk Go | Pembayaran non-tunai | Indikasi kesiapan digital merchant |
| Menu Go | Kondisi ramai | Penilaian keramaian langsung dari surveyor |

Jadi perbandingan antar dataset dilakukan dengan **berpindah**, bukan menumpuk. Tombolnya ada di header.

---

## 5. Analisis spasial

- **Jarak**: haversine, ditulis manual di `src/lib/geo.ts` supaya rumusnya kelihatan
- **Nearest-neighbour join**: tiap titik dikaitkan ke satu simpul terdekat, sekaligus membentuk **catchment ala Voronoi**
- **Simpul transit**: 17 titik di dua wilayah — 11 di Bandung Raya, 6 di koridor KRL Depok. Yang dipakai mengikuti wilayah dataset aktif
- **Kelas keterjangkauan**:

| Kelas | Ambang | Tafsiran |
|---|---|---|
| Inti | ≤ 500 m | 5–7 menit jalan kaki |
| Dekat | 500 m – 1 km | Masih catchment pejalan kaki (ambang TOD lazim) |
| Sedang | 1 – 2 km | Butuh feeder |
| Luar jangkauan | > 2 km | Praktis tidak terlayani |

### 5.1 Indeks Denyut Transit

```
volume     = Σ exp(−d / 1500)   atas catchment, dinormalisasi 0–1
relevansi  = rata-rata transitRelevance
bukti      = rata-rata mediaScore

pulse = (0.40 × volume + 0.30 × relevansi + 0.30 × bukti) × 100
```

**Kenapa peluruhan jarak, bukan buffer 1 km?** Versi pertama memakai buffer keras. Hasilnya 8 dari 10 simpul dapat skor 0 dan indeksnya tidak membedakan apa pun. `exp(−d/1500)` memberi bobot ~0.51 pada 1 km, ~0.26 pada 2 km, ~0.07 pada 4 km — titik jauh tetap terhitung tapi kecil, tanpa kepura-puraan bahwa titik 4 km itu "dekat".

**`relevansi` didefinisikan berbeda per dataset**, dan ini yang membuat indeksnya tidak degenerate:

| Dataset | Sumber relevansi |
|---|---|
| Community Maps | Bobot tema (mobilitas 1,0 → rekreasi 0,4) |
| Properti Go | Bobot kategori (Kos 1,0 · Ruko 0,9 · Gudang 0,35 · Tanah 0,3) |
| Struk Go | Bobot kategori — **E-commerce 0,2** |
| Menu Go | Kondisi keramaian (Ramai 1,0 · Sedang 0,6 · Sepi 0,3) |

E-commerce sengaja dibuat sangat rendah: struk belanja online direkam di mana pun pembelinya berada, jadi titiknya tidak menyatakan apa-apa tentang aktivitas di lokasi itu. Dari 15 struk, 3 di antaranya e-commerce — dua bahkan di koordinat yang persis sama.

---

## 6. Hasil

### 6.1 Ringkasan lintas dataset

| | Community | Properti Go | Struk Go | Menu Go |
|---|---|---|---|---|
| n | 25 | 590 | 15 | 15 |
| Wilayah | Bandung | Bandung | Bandung | Depok |
| **Dalam 1 km simpul** | 8% | **15%** | **0%** | 13% |
| **Jarak median** | 3.491 m | 2.162 m | 4.560 m | **1.210 m** |
| Luar jangkauan (>2 km) | 19 (76%) | 336 (57%) | 12 (80%) | 4 (27%) |
| Metrik sekunder | keluhan 16% | kos 5% | non-tunai 93% | ramai 33% |
| Harga median | — | — | — | Rp20.000 |

### 6.2 Properti Go (n=590) — satu-satunya yang layak secara statistik

**Jarak ke simpul menurut kategori properti:**

| Kategori | n | Median | Dalam 1 km |
|---|---|---|---|
| Retail | 14 | 1.213 m | **50%** |
| Ruko | 186 | 1.831 m | 27% |
| Kantor | 20 | 1.449 m | 20% |
| Gudang | 12 | 2.018 m | 17% |
| Tanah | 42 | 2.461 m | 12% |
| Rumah | 278 | 2.424 m | 8% |
| **Kos** | **29** | **2.165 m** | **0%** |

**Rasio walkable per simpul** (titik dalam 1 km ÷ catchment):

| Simpul | Catchment | Dalam 1 km | Rasio |
|---|---|---|---|
| Stasiun Bandung | 107 | 35 | **33%** |
| Stasiun Cikudapateuh | 58 | 10 | 17% |
| Terminal Leuwipanjang | **183** | 23 | 13% |
| Terminal Cicaheum | 161 | 17 | 11% |
| Terminal Ledeng | 29 | 3 | 10% |
| Stasiun Kiaracondong | 30 | 1 | 3% |
| Stasiun Cimindi | 22 | 0 | **0%** |
| Cimahi, Gadobangkong, Padalarang, Whoosh | 0 | 0 | — |

### 6.3 Community Maps (n=25)

Komposisi tema: Ekonomi 9 · Sosial 5 · Mobilitas 3 · Lingkungan 3 · Infrastruktur 2 · Rekreasi 2 · tak terklasifikasi 1

Keterjangkauan: inti 1 · dekat 1 · sedang 4 · **luar 19**

Denyut tertinggi: Terminal Ledeng 84 (3 titik) · Stasiun Bandung 78 (4) · Terminal Leuwipanjang 65 (13, **0 dalam radius**)

### 6.4 Struk Go (n=15)

**Nol transaksi dalam 1 km dari simpul mana pun.** Yang terdekat 1.195 m (Sop Burtok). Jarak median 4.560 m.

14 dari 15 non-tunai (QRIS 12, e-wallet 2, tunai 1). Tiga di antaranya e-commerce — dua di koordinat identik, yang menegaskan bahwa titik e-commerce tidak menyatakan lokasi aktivitas.

### 6.5 Menu Go (n=15, Depok)

Jarak median **1.210 m** — terbaik dari keempat dataset. Hanya 4 titik di luar 2 km.

Lima tempat berstatus "Ramai": DOPAMINE (268 m, Rp35.000), CALF (1.172 m, Rp20.000), Bubur Ayam Cianjur (1.172 m, Rp13.000), Ubi Cilembu (2.061 m, Rp10.000), mie ayam alim (2.830 m, Rp14.000).

Rentang harga Rp5.000 – Rp35.000. Yang paling dekat ke transit (268 m) juga yang paling mahal.

---

## 7. Temuan

**a. Kos adalah anomali paling tajam di seluruh data.** 29 listing kos, **tidak satu pun** dalam 1 km dari stasiun atau terminal — padahal setiap kategori properti lain punya setidaknya beberapa. Median 2,2 km. Ini kelompok yang secara ekonomi paling bergantung pada transportasi murah (penyewa, bukan pemilik), tapi justru paling jauh darinya. Kalau ada satu angka untuk dibawa ke juri, ini kandidatnya.

**b. Ekonomi menempel ke transit, hunian tidak.** Retail 50% dan Ruko 27% berada dalam jarak jalan kaki; Rumah cuma 8% dan Kos 0%. Polanya konsisten: **simpul transit menarik perdagangan, bukan tempat tinggal.** Konsekuensi kebijakannya berbeda — kalau yang tumbuh di sekitar stasiun cuma toko, orang tetap harus datang dari jauh untuk mencapainya.

**c. Terminal Leuwipanjang: bergantung tapi tidak terhubung.** Catchment terbesar di dua dataset — 183 properti dan 13 laporan warga — tapi rasio walkable-nya cuma 13%, dan di Community Maps **0%** dengan jarak rata-rata 5,5 km. Kawasan barat daya Bandung secara geografis mengarah ke sana, tapi terlalu jauh untuk berjalan. Ini profil wilayah yang butuh **angkutan pengumpan**, bukan simpul baru.

**d. Stasiun Bandung satu-satunya yang benar-benar walkable.** 33% catchment-nya dalam 1 km — lebih dari dua kali lipat simpul mana pun. Kalau mencari contoh TOD yang sudah setengah jalan di Bandung, itu Stasiun Bandung, dan bukan yang lain.

**e. Koridor KRL Depok punya profil berbeda.** Jarak median 1,2 km vs 2,2–4,6 km di semua dataset Bandung. Ini bukan perbandingan yang adil (n=15, terkonsentrasi di Margonda), tapi arahnya konsisten dengan yang diketahui umum: koridor KRL Jabodetabek punya kepadatan komersial pejalan kaki yang tidak dimiliki jalur KA Bandung.

**f. Empat simpul sunyi di Bandung.** Cimahi, Gadobangkong, Padalarang, dan Whoosh Padalarang mendapat **nol** catchment di Properti Go maupun Struk Go. Ini **bukan** bukti kawasannya mati — ini titik buta data: kontributor MAPID terkonsentrasi di pusat kota. Temuan ini paling operasional: survey activities sebaiknya diarahkan ke sana dulu supaya indeksnya tidak bias.

**g. Struk Go menunjukkan batas datanya sendiri.** Nol transaksi dalam 1 km transit, tapi n=15 dan 3 di antaranya e-commerce. Yang lebih berguna dari angkanya: 93% non-tunai. Kalau angka itu bertahan di sampel besar, itu sinyal kuat kesiapan digital merchant kecil di Bandung.

---

## 8. Batasan yang harus diakui

1. **Tiga dari empat dataset hanya 15–25 baris.** Sah secara perhitungan, lemah secara statistik. Hanya Properti Go (590) yang temuannya layak dikutip.
2. **Jarak masih garis lurus (haversine)**, belum network analysis di atas jaringan jalan. Semua angka jarak **terlalu optimistis** — jarak berjalan kaki sebenarnya selalu lebih panjang, apalagi kalau terpotong rel atau sungai. Angka "0% kos dalam 1 km" kemungkinan besar bahkan lebih buruk kalau diukur lewat jalan.
3. **Koordinat 17 simpul transit adalah perkiraan manual**, bukan data resmi.
4. **Klasifikasi masih rule-based**, bukan LLM. Kesalahannya nyata dan sudah dicatat di §3.1.
5. **Foto belum dianalisis sama sekali** — padahal keempat dataset membawa total >1.300 foto, dan itu aset terbesar yang belum disentuh.
6. **Sebaran kontributor tidak merata.** Semua angka di dokumen ini sebenarnya berbunyi "menurut orang yang kebetulan membuka MAPID APPS", bukan "menurut kota Bandung".
7. **Menu Go tidak sebanding dengan tiga dataset lain** karena beda kota dan beda jaringan transit.

---

## 9. Rencana peningkatan

| Sekarang | Berikutnya | Kenapa |
|---|---|---|
| Klasifikasi leksikon | LLM (titik ganti sudah disiapkan di `enrich.ts`) | Menangkap konteks, bukan cuma kata kunci |
| Foto tidak dipakai | Model multimodal atas `Foto Tampak Depan` | Kategori kondisi fasilitas / aksesibilitas — contoh eksplisit panitia |
| Struk tanpa nominal | OCR foto struk | Satu-satunya jalan mendapat angka rupiah |
| Simpul perkiraan | OSM / BIG / KAI | Akurasi + sumber bisa dicantumkan |
| Haversine | Network analysis (OSM pedestrian, via QGIS) | Jarak realistis |
| Tanpa validasi | Label manual ±30 baris → akurasi & Cohen's kappa | Yang dilaporkan ke juri angkanya, bukan klaim "pakai AI" |
| Tanpa dimensi waktu | Manfaatkan `Tanggal`+`Waktu` di Struk Go & Menu Go | Membuka analisis "kapan kawasan hidup vs kapan transit jalan" |
