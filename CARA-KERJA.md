# Cara kerja SIMPUL — dijelaskan dari layar ke angka

> Dokumen ini untuk siapa pun yang ingin tahu **apa yang dilihat di layar, dari mana datanya, dan bagaimana angkanya dihitung** — tanpa harus membaca kode. Rumus lengkap beserta alasan tiap ambang ada di [PERHITUNGAN.md](PERHITUNGAN.md).

---

## 1. Pertanyaan yang dijawab

SIMPUL menjawab dua pertanyaan untuk Jabodetabek:

1. **Kapan sebuah kawasan hidup?** — pagi, siang, sore, malam, atau larut.
2. **Pada jam ramai itu, apakah transportasi massalnya hadir?** — ada stasiun/halte dalam jarak jalan kaki, dan jadwalnya cukup sering?

Kawasan yang ramai **tetapi** layanannya kurang = **kesenjangan**. Itulah yang dikumpulkan menjadi daftar kandidat di panel kanan.

## 2. Yang ada di layar

| Bagian | Fungsi |
|---|---|
| **Tampilan → 🔥 Denyut** | Peta panas: makin pekat, makin banyak kegiatan terekam pada blok waktu yang dipilih. Perbesar peta → berubah jadi sel heksagon yang bisa diklik. |
| **Tampilan → 🚨 Kesenjangan** | Hanya kawasan bermasalah yang berwarna. Merah = ramai tapi tak ada stasiun/halte dalam 1 km. Oranye = ramai tapi frekuensi layanan rendah. Nomor di peta = nomor kandidat di panel. Stasiun menampilkan `N×` = keberangkatan terjadwal pada blok itu. |
| **Lapisan** | 🚌 Halte bus (7.814 halte TransJakarta & JakLingko), 🛤 Jalur rel, 🛰 Citra satelit. Klik halte → keberangkatan per blok. |
| **Penggeser waktu** (bawah) | Lima blok: Pagi 06–10, Siang 10–14, Sore 14–18, Malam 18–22, Larut 22–06. Tombol ▶ memutar otomatis. |
| **Panel Kandidat** | Grafik "kapan kota hidup" + daftar kandidat berperingkat. |
| **Panel Tanya** | Pertanyaan bahasa biasa → jawaban berangka + peta ikut bergerak + "jejak nalar". |
| **Panel Metode** | Sumber data yang benar-benar dipakai, cara hitung ringkas, dan batasan yang jujur. |
| **Titik status** di topbar | Hijau "live" = laporan warga ditarik langsung dari API MAPID saat halaman dibuka; kuning "snapshot" = server tak terjangkau, dipakai unduhan 9 Sep 2026. |

Tanpa warna = **Tidak Ada Data**. SIMPUL tidak pernah menebak keramaian kawasan yang tidak punya laporan (ketentuan PRD).

## 3. Data yang dipakai

| Data | Sumber | Cara masuk |
|---|---|---|
| **Laporan warga Community Maps** (1.750 di Jabodetabek per 9 Sep 2026; judul, deskripsi, foto, titik, waktu) | API kompetisi MAPID `POST server.mapid.io/web/competition/activities` | Ditarik live per bbox Jabodetabek melalui backend tipis (`/api/activities`), karena server MAPID menolak panggilan langsung dari browser. Fallback: `src/data/activitiesJabodetabek.json`. |
| **129 stasiun** KRL / MRT / LRT Jakarta / LRT Jabodebek + kode lintas | OpenStreetMap (relasi rute) | `src/data/stationsJabodetabek.json` |
| **Keberangkatan KRL per lintas per hari** | Gapeka 2025 (Bogor, Cikarang, Rangkasbitung) & 2023 (Tangerang, Tanjung Priok, Bandara) | Dibagi ke 5 blok memakai bobot headway sibuk/non-sibuk (`transitData.ts`) |
| **MRT & LRT** | Headway resmi operator | idem |
| **7.814 halte TransJakarta & JakLingko** + keberangkatan per blok | GTFS resmi TransJakarta (`frequencies.txt`, hari kerja) | `src/data/tjStops.json` |
| **Jalur rel** | OpenStreetMap | `src/data/railLines.json` |
| **Basemap** | MAPID MAPS (light / dark / satellite) | key `VITE_MAPID_API_KEY` |

Belum dipakai: **Struk Go, Menu Go, Properti Go** — menunggu endpoint *Missions* MAPID. Begitu tersedia, masuk sebagai bukti tambahan di langkah 4.1 dengan bobotnya sendiri.

## 4. Langkah hitung (persis seperti di kode)

### 4.1 Setiap laporan jadi "bukti kegiatan" — `engine.ts › readActivities`

Satu laporan → satu titik + **jam** + **bobot**.

- **Jam**: kalau surveyor menulis "pukul 15.30" / "jam 7 pagi" di deskripsi, itu yang dipakai (637 dari 1.750 laporan). Kalau tidak, jam unggah dikonversi ke WIB.
- **Bobot**: dari kata yang ditulis surveyor sendiri (`activityText.ts`, aturan kata kunci — bukan LLM):

| Teks laporan | Bobot | Alasan |
|---|---|---|
| menyebut *ramai / padat / antre / macet / penuh* | **2** | surveyor menyaksikan keramaian |
| tanpa keterangan | **1** | ada kegiatan, intensitas tak disebut |
| menyebut *sepi / lengang / kosong* | **0,5** | tetap pengamatan (bukan "tidak ada data"), tapi kegiatannya rendah |

### 4.2 Kelompokkan per kawasan per waktu — `hexgrid.ts`, `timeblocks.ts`

Kota dibagi **sel heksagon ±500 m** (radius nyaman jalan kaki) dan hari dibagi **5 blok**. Poin sel × blok = jumlah bobot laporan yang jatuh di situ. Laporan tanpa jam dibagi rata tipis ke lima blok.

### 4.3 Kelas keramaian = peringkat, bukan angka mutlak

Semua (sel × blok) yang punya poin diurutkan. **Persentil ≥ 75 → RAMAI**, 50–75 → SEDANG, sisanya → SEPI. Tanpa poin → **Tidak Ada Data**. Karena peringkat, "ramai" selalu berarti *relatif terhadap Jabodetabek sendiri pada data yang ada*.

### 4.4 Skor layanan transit per sel per blok

```
faktor jarak : ≤ 1 km → 1 · 1–2 km → 0,6 · > 2 km → 0
skor rel     = faktor jarak(stasiun terdekat) × min(1, keberangkatan stasiun pada blok ÷ P90 se-wilayah)
skor bus     = faktor jarak(halte terdekat)   × min(1, keberangkatan halte pada blok   ÷ P90 se-wilayah)
skor layanan = maks(skor rel, skor bus)           → 0 … 1
```

P90 = persentil-90 keberangkatan semua stasiun (atau semua halte) pada blok itu — jadi "layanan penuh" diukur terhadap yang terbaik di Jabodetabek, bukan angka karangan.

### 4.5 Kesenjangan

Untuk sel × blok yang **RAMAI** dan **skor layanan < 0,35**:

- jarak ke stasiun/halte terdekat **> 1 km** → **tak terjangkau** (merah)
- selain itu → **frekuensi rendah** (oranye)

### 4.6 Kandidat berperingkat — `recommend.ts`

Sel ber-gap yang **bersebelahan** digabung jadi satu kantong (flood-fill di grid heksagon). Untuk tiap kantong dihitung: jumlah sel, jumlah laporan (bukti), blok dominan (blok dengan poin terbesar), jarak rata-rata ke layanan, skor layanan rata-rata, stasiun terdekat.

- **Peringkat**: tak terjangkau = `3×sel + bukti`; frekuensi rendah = `2×sel + bukti + 5×(1 − skor layanan)`.
- **Keyakinan** (PRD): *tinggi* ≥ 8 laporan di ≥ 2 sel; *sedang* 3–7 laporan; *rendah* < 3.
- Delapan teratas dari tiap jenis digabung, maksimal 12 kartu.

## 5. Membaca satu kartu kandidat

Contoh kartu nyata (data live 9 Sep 2026):

> **1 · TAK TERJANGKAU · keyakinan tinggi**
> **Kawasan ramai 1.5 km dari layanan terdekat (arah Lebak Bulus Bank Syariah Indonesia)**
> `2 Sel ramai` · `13 Bukti` · `1.5 km Ke layanan`
> 2 sel bersebelahan tergolong ramai (paling hidup blok Sore (14–18)), tetapi tidak ada stasiun maupun halte dalam jarak jalan kaki 1 km. Bukti: 13 laporan lapangan.
> **Usulan · untuk Dishub / operator feeder** — rute pengumpan / halte baru menuju Stasiun MRT Lebak Bulus Bank Syariah Indonesia.

| Bagian kartu | Dari mana |
|---|---|
| **1** | urutan skor peringkat (4.6); nomor yang sama muncul di peta mode Kesenjangan |
| **TAK TERJANGKAU** | jenis gap (4.5): jarak ke layanan terdekat > 1 km |
| **keyakinan tinggi** | 13 laporan di 2 sel → memenuhi "≥ 8 laporan di ≥ 2 sel" |
| **1.5 km** | rata-rata `nearestTransitM` sel-sel dalam kantong |
| **arah Lebak Bulus…** | stasiun terdekat dari sel pertama kantong |
| **2 Sel ramai** | jumlah sel dalam kantong yang RAMAI dan ber-gap |
| **13 Bukti** | jumlah laporan warga di sel-sel itu |
| **blok Sore (14–18)** | blok dominan — poin kegiatan terbesar di antara blok ber-gap |
| **Usulan** | template menurut jenis gap: tak terjangkau → rute pengumpan/halte baru; frekuensi rendah → penambahan frekuensi pada blok dominan. Target: Dishub/feeder untuk jangkauan; KAI Commuter atau TransJakarta/JakLingko untuk frekuensi, dipilih dari mana yang lebih banyak keberangkatannya |

Tidak ada bagian kartu yang ditulis oleh AI. Semua teks adalah template + angka dari hitungan; itu sebabnya panel menulis "disusun otomatis dari hitungan — bukan karangan".

## 6. Asisten "Tanya AI"

Sesuai PRD §7 (*AI Integration*): **LLM hanya mengolah bahasa; seluruh angka dari algoritma spasial.** Implementasinya:

1. Browser mengirim pertanyaan + konteks (peran, blok waktu, tampilan) + daftar **alat** langsung ke Gemini API (`gemini-3.6-flash`, free tier; kunci `VITE_GEMINI_API_KEY`). Alat (`src/lib/aiTools.ts`): `ringkasan_kota`, `sel_ramai(blok)`, `daftar_kandidat(jenis, target)`, `detail_kandidat(nomor)`, `bandingkan_kandidat(a, b)`, `profil_kawasan(nama)`, `tampilkan_di_peta(...)`.
2. Gemini memilih alat (*function calling*).
3. **Alatnya dijalankan di browser** (`src/lib/aiRun.ts`) terhadap model hitungan yang sedang tampil — fungsi yang sama dengan yang menggambar peta dan menyusun kartu — lalu hasilnya (angka) dikirim kembali. Diulang sampai model selesai merangkai kalimat.
4. `tampilkan_di_peta` menggerakkan peta: pindah blok, ganti tampilan, sorot kandidat, terbang ke lokasi.
5. Panel menampilkan "alat yang dipakai" (jejak) di tiap jawaban. Tanpa kunci, atau kalau kuota/jaringan gagal, panel jatuh ke asisten berbasis aturan (`src/lib/assistant.ts`) dan menandainya sebagai *mode aturan*.

Pertanyaan di luar cakupan ditolak singkat; pertanyaan soal jumlah armada/investasi dijawab bahwa itu di luar lingkup SIMPUL (PRD *out-of-scope*).

### Login berbasis peran

Layar masuk (dummy, tanpa kata sandi) memilih satu dari empat peran: Perencana KAI Commuter, Analis Jaringan TransJakarta, Regulator Dishub, Tamu — tiga yang pertama = persona PRD §4. Peran mengubah **tampilan awal** (mode & lapisan), **kandidat mana yang tampil lebih dulu** (KAI: frekuensi kereta; TransJakarta: jangkauan/pengumpan & frekuensi bus; Dishub/Tamu: semua), contoh pertanyaan, dan sudut pandang asisten. Hitungan dan nomor kandidat sama untuk semua peran (`src/lib/roles.ts`).

### Peringkat berdasarkan apa?

Rumusnya (tab Metode & data): tak terjangkau = `3 × sel + bukti`; frekuensi rendah = `2 × sel + bukti + 5 × (1 − skor layanan)`. Ini urutan *bukti terkuat untuk ditinjau dulu*, bukan urutan investasi; angka rumusnya sengaja tidak ditampilkan di kartu supaya panel tetap ringkas. Panel juga bisa diurutkan menurut bukti terbanyak atau keyakinan tertinggi; nomor kandidat tetap mengikuti skor supaya sama dengan nomor di peta.


### Usulan tindakan & angka indikatif

Tiap kandidat membawa `proposal` (`src/lib/recommend.ts`): satu kalimat usulan, langkah konkret, dan angka indikatif yang cara hitungnya ditulis di tombol "i":

- **Frekuensi rendah** — target skor layanan 60/100 dari acuan simpul tersibuk pada blok itu → tambahan keberangkatan = ⌈0,6 × acuan⌉ − yang ada. Headway = jam blok × 60 ÷ (keberangkatan ÷ 2 arah). Rangkaian/armada tambahan ≈ (tambahan ÷ 2) × siklus PP (asumsi 120 menit kereta, 90 menit bus) ÷ menit dalam blok, dibulatkan ke atas.
- **Tak terjangkau** — usulan rute pengumpan dari layanan terdekat (halte bila lebih dekat dari stasiun) ke pusat kantong, digambar putus-putus di peta. Headway uji coba 15 menit; siklus PP = 2 × panjang ÷ 15 km/jam + 10 menit layover; armada = ⌈siklus ÷ headway⌉.

Semua angka itu **indikatif** untuk membuka kajian, bukan rencana operasi — kapasitas rangkaian, slot jalur, dan biaya tidak dihitung SIMPUL.

### Jalur di peta

- Jalur rel = relasi rute OpenStreetMap (KAI Commuter B/C/R/T/TP/A/LW, MRT, LRT Jakarta, LRT Jabodebek, Whoosh), diunduh 10 Sep 2026, satu warna per lintas mengikuti warna resmi operator → `src/data/railLines.json`.
- Koridor BRT TransJakarta 1–14 = `shapes.txt` GTFS resmi (satu shape terbanyak per arah, disederhanakan ±12 m) dengan `route_color` resmi → `src/data/tjRoutes.json`. Ikut toggle "TransJakarta".

## 7. Batasan yang perlu diketahui pembaca

- **Sebaran laporan mengikuti tempat surveyor bekerja** (sebagian besar Agustus 2026, tim-tim peserta lomba), bukan sampel acak. Kawasan tanpa laporan tidak berarti sepi.
- **Jam laporan condong 12–17 WIB** — blok pagi & larut lebih tipis.
- **Timetable KRL per stasiun tidak terbuka**; angka per blok = total trip lintas dibagi bobot headway.
- **Headway GTFS TransJakarta hampir rata sepanjang hari**, jadi variasi antar-blok untuk bus kecil.
- Ini **bukan ramalan penumpang**; ini peta "kawasan hidup" vs "layanan ada".

## 8. Peta berkas

```
api/activities.ts            backend tipis (Vercel Edge) → API MAPID Activities
vite.config.ts               proxy /api/activities saat dev
src/
  main.tsx                   titik masuk
  App.tsx                    kerangka halaman: topbar, kontrol peta, panel kanan, panduan
  App.css                    seluruh gaya
  components/
    MapView.tsx              MapLibre: heatmap/heksagon, halte, rel, marker stasiun & kandidat
    TimeSlider.tsx           penggeser blok waktu
    RecPanel.tsx             panel Kandidat
    AssistantPanel.tsx       panel Tanya
    MethodPanel.tsx          panel Metode
    Guide.tsx                panduan "Cara pakai"
    BarList.tsx              grafik batang sederhana
  lib/
    engine.ts                langkah 4.1–4.5 (bukti → sel × blok → kelas → layanan → gap)
    recommend.ts             langkah 4.6 (kantong → kandidat berperingkat)
    assistant.ts             asisten berbasis aturan
    mapidApi.ts              pemanggilan API MAPID + snapshot
    activityText.ts          aturan kata kunci (ramai/sepi, "pukul …")
    transitData.ts           stasiun, keberangkatan per blok, halte GTFS
    hexgrid.ts, timeblocks.ts, geo.ts, basemap.ts, types.ts, guideStorage.ts
  data/
    stationsJabodetabek.json, tjStops.json, railLines.json,
    activitiesJabodetabek.json (snapshot cadangan)
```
