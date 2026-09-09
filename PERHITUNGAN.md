# PERHITUNGAN.md — Cara SIMPUL Menghitung

> **Pembaruan 9 Sep 2026:** poin perkiraan dihapus (PRD), bukti kegiatan kini laporan warga Community Maps live dari API MAPID, skor layanan dari data transit nyata (OSM + Gapeka + GTFS TransJakarta), wilayah studi Jabodetabek saja (sampel Bandung dihapus). Versi bahasa sederhana: [CARA-KERJA.md](CARA-KERJA.md).

> Dokumen ini menjelaskan **persis** apa yang dihitung aplikasi, langkah demi langkah, dengan angka bobot yang benar-benar dipakai di kode (`src/lib/engine.ts`, `serviceProfiles.ts`, `recommend.ts`). Semua angka contoh di bagian akhir adalah **hasil nyata** dari menjalankan mesinnya atas data sample — bukan karangan.

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

Satu bukti = satu titik (lat/lon) + jam kejadian + bobot. Sumber bukti saat ini satu: laporan warga Community Maps dari API MAPID. Struk Go / Menu Go / Properti Go akan masuk sebagai baris tambahan di tabel ini begitu endpoint *Missions* tersedia (rencana bobot: transaksi 1, Menu Go ramai/sedang/sepi 3/2/1, Properti Go hanya konteks).

| Sumber | Jam diambil dari | Bobot | Alasan |
|---|---|---|---|
| **Community Maps — API MAPID kompetisi** (`POST server.mapid.io/web/competition/activities`, ditarik live per wilayah) | **"pukul …" yang ditulis surveyor** di deskripsi; kalau tidak ada, `created_at` (jam unggah) dikonversi ke WIB | **2 / 1 / 0,5** | Bobot mengikuti keterangan keramaian yang ditulis surveyor sendiri: menyebut *ramai/padat/antre* → 2, tanpa keterangan → 1, menyebut *sepi/lengang* → 0,5 (tetap pengamatan, bukan "Tidak Ada Data"). Dibaca dengan **aturan kata kunci** (`src/lib/activityText.ts`), bukan LLM — sesuai PRD. Endpoint menolak permintaan dari browser (403 bila ada header `Origin`), jadi dipanggil lewat backend tipis: proxy Vite saat dev, Vercel Edge Function `api/activities.ts` di produksi; bila gagal, snapshot 9 Sep 2026 dipakai dan statusnya ditulis "snapshot" di topbar |


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

## Contoh nyata (data live API MAPID, 9 Sep 2026)

Kandidat #1 di aplikasi — kantong dua sel arah **Stasiun MRT Lebak Bulus**:

| Hal | Nilai | Dari mana |
|---|---|---|
| Bukti | 13 laporan warga di 2 sel bersebelahan | Langkah 1 |
| Blok dominan | Sore (14–18) — poin terbesar di antara blok ber-gap | Langkah 2–3 |
| Ranking | persentil ≥ 75 → kelas **RAMAI** | Langkah 4 |
| Layanan terdekat | rata-rata **1,5 km** → faktor jarak 0,6; keberangkatan × 0,6 masih < 0,35 | Langkah 5 |
| Status | **GAP JANGKAUAN** (> 1 km dari stasiun/halte mana pun) | Langkah 6 |
| Keyakinan | **tinggi** (≥ 8 laporan di ≥ 2 sel) | Langkah 7 |

Bacaan per bagian kartunya ada di [CARA-KERJA.md §5](CARA-KERJA.md).

---

## Ringkasan hasil (dihitung mesin dari 1.750 laporan, 9 Sep 2026)

| Blok | Poin kegiatan |
|---|---|
| Pagi 06–10 | 153 |
| Siang 10–14 | 571 |
| Sore 14–18 | 860 |
| Malam 18–22 | 345 |
| Larut 22–06 | 182 |

Kandidat: 6–12 kartu (bervariasi mengikuti data live). Kurva memuncak sore karena jam surveyor bekerja memuncak 12–17 WIB — bias yang diakui di bawah.

## Batasan (jangan disembunyikan di proposal)

1. **Sebaran laporan mengikuti lokasi surveyor** (sebagian besar Agustus 2026, tim-tim peserta), bukan sampel acak se-Jabodetabek. Kawasan tanpa laporan = "Tidak Ada Data", bukan sepi.
2. **Jam yang terekam = jam surveyor bekerja** (puncak 12–17 WIB) → blok pagi & larut tipis. Survey activities diarahkan ke jam yang bolong.
3. **Timetable KRL per stasiun belum terbuka** → total trip lintas (Gapeka) dibagi ke blok dengan bobot headway. Headway GTFS TransJakarta hampir rata sepanjang hari → variasi bus antar-blok kecil.
4. **Struk Go / Menu Go / Properti Go belum masuk** — menunggu endpoint *Missions* MAPID.
5. **Bukan prediksi penumpang** — peta sisi permintaan kawasan vs sisi layanan. Data penumpang operator = slot kalibrasi.
6. Semua bobot (2 / 1 / 0,5 · 0,35 · persentil 75 · 1 km / 2 km) adalah **keputusan tim yang ditulis terbuka** supaya bisa didebat dan diuji sensitivitasnya.
