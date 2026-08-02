# PERHITUNGAN.md — Cara SIMPUL Menghitung

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
| Community Maps | **cap waktu di nama file foto** (epoch ms, dikonversi ke WIB) | **0,5** | Bukti aktivitas warga, tapi bukan transaksi. Catatan: kolom jam tidak ada di data ini — kami menemukannya tersembunyi di nama file media, dan sudah diverifikasi cocok dengan cap tanggal-jam yang tercetak di fotonya |
| Menu Go "Ramai" | kolom `Waktu` | **3** | Pengamatan keramaian langsung oleh surveyor — bukti terkuat |
| Menu Go "Sedang" | | **2** | |
| Menu Go "Sepi" | | **1** | Tetap bukti tempatnya buka |
| Properti Go | tidak punya jam | — | Tidak jadi bukti ber-jam; perannya di Langkah 3 |

Catatan Menu Go: sample-nya berlokasi di Depok (di luar peta Bandung), jadi titiknya **tidak digambar di peta** — perannya menyumbang "kurva jam kota" di Langkah 3 dan menjadi bahan latihan AI di versi penuh.

**Hasil nyata di data sample:** 12 transaksi dipakai (3 e-commerce dibuang), 25 laporan warga semuanya berhasil diberi jam dari cap foto, 15 pengamatan Menu Go masuk kurva.

## Langkah 2 — Kota dibagi sel heksagon ±500 m, hari dibagi 5 blok

- **Sel heksagon** selebar ±500 m (jarak nyaman jalan kaki). Kenapa sel, bukan per-titik? Satu struk di satu warung bukan cerita; sepuluh struk dalam satu sel baru cerita.
- **5 blok waktu**: Pagi 06–10, Siang 10–14, Sore 14–18, Malam 18–22, Larut 22–06. Kenapa blok 4 jam, bukan per jam? Karena data sample tipis — dipecah per jam, tiap sel isinya 0–1 pengamatan dan kesimpulannya bohong. Blok dipersempit setelah data penuh (API) tersedia.

**Hasil nyata:** 204 sel terbentuk; 31 di antaranya punya pengamatan ber-jam, sisanya hanya berisi titik usaha (→ perkiraan).

## Langkah 3 — Poin per sel per blok = pengamatan + perkiraan

**Poin pengamatan**: jumlahkan bobot semua bukti yang jatuh di sel itu pada blok itu.

**Poin perkiraan** (untuk sel yang punya usaha tapi belum ada pengamatan):

```
perkiraan(sel, blok) = potensi_usaha(sel) × kurva_kota(blok) × 0,35
```

- `potensi_usaha` = jumlah bobot "wadah kegiatan" dari Properti Go di sel itu: Ruko/Retail/Restoran = 1 · Coworking = 0,8 · Kantor = 0,6 · Kos = 0,4 · Rumah = 0,15 · Gudang = 0,1 · Tanah = 0. (Logikanya: makin banyak wadah usaha, makin masuk akal ramai.)
- `kurva_kota` = sebaran jam dari SEMUA pengamatan ber-jam, dinormalisasi. **Hasil nyata dari sample: Pagi 1,00 · Siang 0,72 · Sore 0,44 · Malam 0,28 · Larut 0,00.**
- `0,35` = peredam, supaya perkiraan tidak pernah menenggelamkan pengamatan asli.

Di peta, sel yang isinya perkiraan-saja digambar **lebih pudar** — perkiraan tidak boleh menyamar jadi pengamatan.

```
total(sel, blok) = pengamatan + perkiraan
```

## Langkah 4 — "Ramai" = ranking, bukan angka mutlak

Jawaban untuk pertanyaan "standar ramai itu berapa?": **tidak ada angka mutlak yang jujur** dari data sebesar ini. Yang dipakai perbandingan relatif:

1. Kumpulkan nilai `total` semua pasangan (sel × blok) yang nilainya > 0.
2. Ranking. Sel-blok di **persentil ≥ 75** (25% teratas se-kota) = **RAMAI**. Persentil 50–75 = **SEDANG**. Sisanya = **SEPI**.
3. Sel tanpa data sama sekali = **abu-abu, "TIDAK ADA DATA"** — bukan dianggap sepi. Ini prinsip kejujuran peta: blok Larut misalnya kosong total di sample (tidak ada satu pun pengamatan jam 22–06), dan petanya memang menampilkan itu apa adanya.

Kalibrasi ke angka mutlak (misal "ramai = X penumpang") menunggu data naik-turun penumpang KAI — sistem sudah menyediakan slot integrasinya.

## Langkah 5 — Skor layanan per sel per blok

```
layanan(sel, blok) = faktor_jarak(sel) × profil_jadwal(simpul_terdekat, blok)
```

- **faktor_jarak**: ≤1 km = 1 · 1–2 km = 0,6 · >2 km = **0** (ambang yang sama dengan analisis keterjangkauan di DATA-DAN-ANALISIS.md).
- **profil_jadwal** per jenis simpul per blok (0–1). ⚠️ Saat ini **perkiraan kasar dari jadwal publik** (KA Lokal Bandung Raya ±37 perjalanan/hari, layanan ±04.30–20.30; jam operasi terminal). Contoh: stasiun KA → Pagi 1,0 · Siang 0,7 · Sore 1,0 · **Malam 0,3** · Larut 0. Di versi penuh diganti hitungan langsung dari Gapeka resmi (jumlah keberangkatan per blok ÷ maksimum).

## Langkah 6 — Kesenjangan

Sel disebut ber-**gap** pada satu blok kalau kelasnya **RAMAI** dan skor layanannya **< 0,35**:

| Kondisi | Jenis gap | Artinya |
|---|---|---|
| RAMAI + dekat simpul (≤2 km) tapi jadwal blok itu jarang | **Gap JADWAL** (oranye di mode Kesenjangan) | "Kawasan masih hidup ketika layanan menipis" |
| RAMAI + >2 km dari semua simpul | **Gap JANGKAUAN** (merah di mode Kesenjangan) | "Hidup tapi tidak terlayani sama sekali" |

**Hasil nyata di sample:** gap jadwal muncul 5 sel (semuanya blok Malam — pas dengan jadwal KA lokal yang menipis setelah 20.00); gap jangkauan 9–37 sel tergantung blok.

## Langkah 7 — Rekomendasi (aturan terbuka, bukan karangan AI)

**Rekomendasi JADWAL** — per simpul: kalau ≥2 sel dalam 2 km masih ramai/sedang pada blok yang profil jadwalnya ≤0,35 → *"tambah frekuensi di sekitar [simpul] pada blok [X]"*, dengan jumlah sel + total poin + skor layanan sebagai angka pendukung.

**Rekomendasi JANGKAUAN** — sel-sel ramai yang >2 km dari semua simpul dan **bersebelahan** digabung jadi kantong (flood-fill di grid heksagon). Kantong ≥2 sel → *"kandidat koridor feeder menuju [simpul terdekat]"*, dengan luas, jumlah titik usaha, jarak rata-rata, dan blok dominannya.

Prioritas: kantong yang **padat usaha** di atas kantong yang hanya berisi laporan warga. Kedua jenis rekomendasi dijamin tampil (5 jangkauan + 3 jadwal teratas).

**Catatan akses** (fitur nice-to-have): tiap rekomendasi mengecek pin aksesibilitas dalam 1,2 km — kalau ada titik yang dinilai tidak ramah dari foto lapangan, rekomendasinya diberi satu kalimat tambahan: *"jika layanan ditambah, siapkan juga aksesnya."*

**Peran AI vs aturan** — pembagian yang disengaja: aturan menentukan **isi** (angka, lokasi, jenis usulan), AI/LLM nantinya hanya memperhalus **kalimat** dan menerjemahkan pertanyaan pengguna. AI tidak pernah boleh menulis angka sendiri — itu yang membuat halusinasi angka nyaris mustahil, dan itu jawaban kami untuk butir "validasi hasil AI" di ketentuan lomba.

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
