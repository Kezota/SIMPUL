# PERHITUNGAN.md — Cara SIMPUL Menghitung

> **Pembaruan 9 Sep 2026:** poin perkiraan dihapus (PRD), skor layanan kini dari data transit nyata (OSM + Gapeka + GTFS TransJakarta), wilayah studi utama Jabodetabek. Contoh & tabel hasil di bagian bawah masih dari sampel Bandung dan akan diperbarui saat data aktivitas Jabodetabek tersedia.

> Dokumen ini menjelaskan **persis** apa yang dihitung aplikasi, langkah demi langkah, dengan angka bobot yang benar-benar dipakai di kode (`src/simpul/engine.ts`, `serviceProfiles.ts`, `recommend.ts`). Semua angka contoh di bagian akhir adalah **hasil nyata** dari menjalankan mesinnya atas data sample — bukan karangan.

---

## Gambaran besar

```
4 dataset MAPID                                       jadwal transit (perkiraan)
      │                                                        │
      ▼                                                        ▼
[1] Bukti kegiatan ──▶ [2] Sel heksagon ──▶ [3] Poin per ──▶ [5] Skor layanan
    (titik + jam +         ±500 m ×             sel per          per sel per blok
     bobot)                5 blok waktu         blok             │
                                                 │               │
                                                 ▼               ▼
                                          [4] Kelas RAMAI/   [6] KESENJANGAN
                                              SEDANG/SEPI        (jadwal / jangkauan)
                                              (ranking persentil)     │
                                                                      ▼
                                                              [7] REKOMENDASI
```

---

## Langkah 1 — Setiap baris data jadi "bukti kegiatan"

Satu bukti = satu titik (lat/lon) + jam kejadian + bobot. Bobotnya:

| Sumber | Jam diambil dari | Bobot | Alasan |
|---|---|---|---|
| Struk Go | kolom `Waktu Transaksi` | **1** | Bukti transaksi beneran terjadi di situ, jam segitu |
| Struk Go kategori E-commerce | — | **0 (dibuang)** | Belanja online tercatat di mana pun pembelinya berada — titiknya tidak menyatakan keramaian lokasi |
| **Community Maps — API MAPID kompetisi** (`POST server.mapid.io/web/competition/activities`, ditarik live per wilayah) | **"pukul …" yang ditulis surveyor** di deskripsi; kalau tidak ada, `created_at` (jam unggah) dikonversi ke WIB | **2 / 1 / 0,5** | Bobot mengikuti keterangan keramaian yang ditulis surveyor sendiri: menyebut *ramai/padat/antre* → 2, tanpa keterangan → 1, menyebut *sepi/lengang* → 0,5 (tetap pengamatan, bukan "Tidak Ada Data"). Dibaca dengan **aturan kata kunci** (`src/simpul/activityText.ts`), bukan LLM — sesuai PRD. Endpoint menolak permintaan dari browser (403 bila ada header `Origin`), jadi dipanggil lewat backend tipis: proxy Vite saat dev, Vercel Edge Function `api/activities.ts` di produksi; bila gagal, snapshot 9 Sep 2026 dipakai dan statusnya ditulis "snapshot" di topbar |
| Community Maps — file sampel lama | cap waktu di nama file foto (epoch ms → WIB) | **0,5** | Sampel Bandung 25 titik; kolom jam tidak ada, ditemukan di nama file media dan diverifikasi cocok dengan cap di fotonya |
| Menu Go "Ramai" | kolom `Waktu` | **3** | Pengamatan keramaian langsung oleh surveyor — bukti terkuat |
| Menu Go "Sedang" | | **2** | |
| Menu Go "Sepi" | | **1** | Tetap bukti tempatnya buka |
| Properti Go | tidak punya jam | — | Tidak jadi bukti ber-jam; perannya di Langkah 3 |

Catatan Menu Go: sample-nya berlokasi di Depok (di luar peta Bandung), jadi titiknya **tidak digambar di peta** — perannya menyumbang "kurva jam kota" di Langkah 3 dan menjadi bahan latihan AI di versi penuh.

**Hasil nyata di data sample (Bandung):** 12 transaksi dipakai (3 e-commerce dibuang), 25 laporan warga semuanya berhasil diberi jam dari cap foto, 15 pengamatan Menu Go masuk kurva.

**Hasil nyata di Jabodetabek (API MAPID, 9 Sep 2026):** 1.750 laporan warga (Des 2025–Sep 2026; 1.457 di antaranya Agustus 2026), 1.748 ber-foto; 376 menyebut ramai, 98 menyebut sepi; 637 jamnya terbaca dari teks "pukul …", sisanya dari jam unggah. Puncak jam pengamatan 12–17 WIB. Perlu diingat: sebarannya mengikuti lokasi tim-tim peserta bekerja (hashtag = nama tim), bukan sampel acak se-Jabodetabek.

## Langkah 2 — Kota dibagi sel heksagon ±500 m, hari dibagi 5 blok

- **Sel heksagon** selebar ±500 m (jarak nyaman jalan kaki). Kenapa sel, bukan per-titik? Satu struk di satu warung bukan cerita; sepuluh struk dalam satu sel baru cerita.
- **5 blok waktu**: Pagi 06–10, Siang 10–14, Sore 14–18, Malam 18–22, Larut 22–06. Kenapa blok 4 jam, bukan per jam? Karena data sample tipis — dipecah per jam, tiap sel isinya 0–1 pengamatan dan kesimpulannya bohong. Blok dipersempit setelah data penuh (API) tersedia.

**Hasil nyata:** 204 sel terbentuk; 31 di antaranya punya pengamatan ber-jam, sisanya hanya berisi titik usaha (→ perkiraan).

## Langkah 3 — Poin per sel per blok = jumlah bobot pengamatan (TANPA perkiraan)

**Poin pengamatan**: jumlahkan bobot semua bukti yang jatuh di sel itu pada blok itu. Itu saja.

Versi awal prototipe pernah menambahkan "poin perkiraan" untuk sel yang punya usaha tapi belum diamati. **Itu sudah dihapus** — PRD menyatakan eksplisit bahwa prediksi/estimasi keramaian pada kawasan tanpa data berada di luar cakupan. Sel tanpa pengamatan sekarang **selalu** "Tidak Ada Data". Jumlah titik Properti Go di sel hanya ditampilkan sebagai konteks ("potensi kawasan"), tidak pernah masuk skor.

```
total(sel, blok) = pengamatan(sel, blok)
```

## Langkah 4 — "Ramai" = ranking, bukan angka mutlak

Jawaban untuk pertanyaan "standar ramai itu berapa?": **tidak ada angka mutlak yang jujur** dari data sebesar ini. Yang dipakai perbandingan relatif:

1. Kumpulkan nilai `total` semua pasangan (sel × blok) yang nilainya > 0.
2. Ranking. Sel-blok di **persentil ≥ 75** (25% teratas se-kota) = **RAMAI**. Persentil 50–75 = **SEDANG**. Sisanya = **SEPI**.
3. Sel tanpa data sama sekali = **abu-abu, "TIDAK ADA DATA"** — bukan dianggap sepi. Ini prinsip kejujuran peta: blok Larut misalnya kosong total di sample (tidak ada satu pun pengamatan jam 22–06), dan petanya memang menampilkan itu apa adanya.

Kalibrasi ke angka mutlak (misal "ramai = X penumpang") menunggu data naik-turun penumpang KAI — sistem sudah menyediakan slot integrasinya.

## Langkah 5 — Skor layanan per sel per blok, dari data transit NYATA

```
rel(sel, blok)  = faktor_jarak(stasiun terdekat) × min(1, keberangkatan_stasiun(blok) ÷ P90_rel(blok))
bus(sel, blok)  = faktor_jarak(halte terdekat)   × min(1, keberangkatan_halte(blok)   ÷ P90_bus(blok))
layanan         = maks(rel, bus)
```

- **faktor_jarak**: ≤1 km = 1 · 1–2 km = 0,6 · >2 km = 0 (PRD: catchment 1 km dan 2 km).
- **keberangkatan_stasiun(blok)** — Jabodetabek: dihitung dari perjalanan harian per lintas (**Gapeka 2025** untuk Bogor 392, Cikarang 281, Rangkasbitung 204; **Gapeka 2023** untuk Tangerang 124, Tanjung Priok 86, Bandara 56; MRT & LRT dari headway resmi) yang dibagi ke blok waktu memakai bobot 1/headway (jam sibuk 06–09 & 16–19 lebih berat) di dalam jam operasi resmi lintas itu. Stasiun yang dilalui beberapa lintas menjumlahkan semuanya. Stasiun + keanggotaan lintasnya dari relasi **OpenStreetMap** (129 stasiun: 92 KRL, 13 MRT, 24 LRT).
- **keberangkatan_halte(blok)** — dari **GTFS resmi TransJakarta** (`frequencies.txt`, hari kerja): jumlah keberangkatan = lama tumpang-tindih jendela layanan dengan blok ÷ headway, dijumlahkan untuk semua trip yang lewat halte itu (7.814 halte, termasuk rute JAK/Mikrotrans = JakLingko).
- **P90** = persentil-90 keberangkatan se-wilayah pada blok itu → normalisasi **relatif** (PRD: "penilaian bersifat relatif, bukan absolut").
- Mode Bandung (sampel) tetap memakai profil relatif per jenis simpul, karena datanya bukan wilayah studi.

## Langkah 6 — Kesenjangan

Sel disebut ber-**gap** pada satu blok kalau kelasnya **RAMAI** dan skor layanannya **< 0,35**:

| Kondisi | Jenis gap | Artinya |
|---|---|---|
| RAMAI + ada stasiun/halte dalam 1 km tapi skor layanan blok itu <0,35 | **Gap JADWAL / frekuensi** (oranye) | "Kawasan masih hidup ketika layanan menipis" |
| RAMAI + tidak ada stasiun maupun halte dalam 1 km | **Gap JANGKAUAN** (merah) | "Hidup tapi di luar jarak jalan kaki dari layanan mana pun" |

**Hasil nyata di sample:** gap jadwal muncul 5 sel (semuanya blok Malam — pas dengan jadwal KA lokal yang menipis setelah 20.00); gap jangkauan 9–37 sel tergantung blok.

## Langkah 7 — Kandidat berperingkat (aturan terbuka, bukan karangan AI)

Kedua jenis kesenjangan diproses sama: sel ber-gap yang **bersebelahan** digabung jadi satu kantong (flood-fill di grid heksagon), lalu tiap kantong jadi satu kandidat dengan blok dominan, jumlah bukti, jarak ke layanan, dan skor layanan rata-rata.

- **Kandidat frekuensi** → *jenis kandidat: penambahan frekuensi pada blok X* (target: operator rel atau TransJakarta/JakLingko, tergantung moda mana yang dominan di situ).
- **Kandidat jangkauan** → *jenis kandidat: rute pengumpan / halte baru menuju simpul terdekat*.
- **Tingkat keyakinan** (PRD): **tinggi** ≥8 bukti & ≥2 sel · **sedang** ≥3 bukti · **rendah** sisanya. Kandidat berkeyakinan rendah = prioritas survey activities.
- Peringkat = ukuran kantong + jumlah bukti (+ kepadatan usaha untuk jangkauan; + seberapa rendah layanan untuk frekuensi). Minimal 10 kandidat ditampilkan bila tersedia; kedua jenis dijamin tampil.
- Tidak ada kandidat yang menyebut jumlah armada atau kapasitas — sesuai batasan PRD.

**Peran AI vs aturan** — aturan menentukan **isi** (angka, lokasi, jenis kandidat, keyakinan); LLM hanya memperhalus **kalimat alasan** dan menjawab pertanyaan lewat *tool use*. AI tidak pernah menulis angka sendiri.

---

## Contoh nyata dari data sample (bisa dicek di aplikasi)

Sel `-5,-13` — kawasan arah Kutawaringin, barat daya Bandung:

| Hal | Nilai | Dari mana |
|---|---|---|
| Bukti | 2 struk transaksi, jam 18 & 19 | Struk Go |
| Poin blok Malam | 1 + 1 = **2,0** (perkiraan 0 — tidak ada properti tercatat di sel ini) | Langkah 1+3 |
| Ranking | persentil **98** se-kota → kelas **RAMAI** | Langkah 4 |
| Simpul terdekat | Terminal Leuwipanjang, **7,3 km** → faktor jarak 0 | Langkah 5 |
| Skor layanan | 0 × profil = **0** | Langkah 5 |
| Status | **GAP JANGKAUAN** (merah di mode Kesenjangan) | Langkah 6 |

Dua transaksi malam hari, 7 km dari terminal terdekat — sel ini otomatis tersorot dan masuk bahan rekomendasi feeder. Dengan data penuh, bukti seperti ini menebal dari 2 titik jadi ratusan.

---

## Ringkasan hasil di data sample (dihitung mesin, 26 Juli 2026)

| Blok | Sel aktif | RAMAI | Gap jadwal | Gap jangkauan |
|---|---|---|---|---|
| Pagi 06–10 | 182 | 76 | 0 | 37 |
| Siang 10–14 | 178 | 61 | 0 | 25 |
| Sore 14–18 | 175 | 29 | 0 | 14 |
| Malam 18–22 | 177 | 15 | **5** | 9 |
| Larut 22–06 | 0 | 0 | 0 | 0 |

Bacaan cepatnya: kurva kota condong ke pagi (bias jam surveyor — diakui), gap jadwal terkonsentrasi di blok Malam (persis saat jadwal KA lokal menipis), dan blok Larut jujur kosong karena memang belum ada pengamatan.

## Batasan (jangan disembunyikan di proposal)

1. **Data sample kecil** — 12 transaksi + 25 laporan. Ini demo METODE; data penuh via API setelah lolos 50 besar.
2. **Jam yang terekam = jam surveyor bekerja**, bukan jam kota sebenarnya → kurva bias ke pagi-siang. Survey activities diarahkan ke jam yang bolong.
3. **Profil jadwal masih perkiraan** → diganti Gapeka resmi.
4. **Bukan prediksi penumpang** — peta sisi permintaan kawasan vs sisi layanan. Data penumpang = slot kalibrasi.
5. Semua bobot (1 / 0,5 / 3-2-1 / 0,35 / persentil 75) adalah **keputusan tim yang ditulis terbuka** supaya bisa didebat dan diuji sensitivitasnya — bukan angka wahyu.
