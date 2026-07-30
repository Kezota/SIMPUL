# Ide Utama: Peta Denyut & Kesenjangan Transportasi

> Dokumen buat menjelaskan ide ke tim. Bahasa dibuat sesederhana mungkin.
> Update terakhir: 26 Juli 2026. Dokumen pendukung: [DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md) (angka-angka dari data sample) dan [RESEARCH-AKSESIBILITAS.md](RESEARCH-AKSESIBILITAS.md) (riset buat fitur aksesibilitas).

---

## 1. Idenya dalam 3 kalimat

1. Kita bikin **peta panas (heatmap) yang ada slider jam-nya** — geser slidernya, kelihatan kawasan mana yang ramai jam berapa. Ramainya dibaca dari data lapangan MAPID: jam transaksi struk, jam ramai tempat makan, jam aktivitas warga.
2. Peta itu dibandingkan dengan **layanan transportasi umum yang ada** (jarak ke stasiun/halte + jadwalnya) → ketahuan **kawasan yang ramai tapi layanannya kurang**.
3. **AI menuliskan rekomendasinya buat KAI/pengelola transit**: "tambah armada/frekuensi di rute X jam sekian" atau "kawasan Y ramai tapi tidak terjangkau — kandidat jalur/halte baru", lengkap dengan angka dan alasannya.

Bonus (nice to have): **pin aksesibilitas** — titik-titik di sekitar jalur transit yang dari fotonya kelihatan ramah/tidak ramah buat teman daksa (ada curb cut? ada ramp? berundakan?).

Format produk ini disebut panitia sendiri di aturan lomba: *"mobility intelligence map / decision-support map"* — jadi kita main di kotak yang mereka sediakan.

---

## 2. Kenapa ide ini masuk akal (bukti dari data yang sudah kami hitung)

Kami sudah mengolah data sample-nya duluan. Tiga bukti bahwa ide ini bisa jalan:

1. **Data waktunya beneran ada.** Struk Go punya kolom tanggal + jam transaksi. Menu Go punya jam kunjungan + label ramai/sedang/sepi. Community Maps tidak punya kolom jam, TAPI tiap fotonya ada cap tanggal-jam dari MAPID (kami sudah cek, cocok dengan stempel waktu di nama file).
2. **Kesenjangannya nyata.** Dari 590 titik Properti Go Bandung: **336 titik (57%) jaraknya lebih dari 2 km** dari stasiun/terminal mana pun. Terminal Leuwipanjang jadi "tanggungan" 183 titik tapi hampir semua terlalu jauh buat jalan kaki. Artinya: memang ada kawasan hidup yang tidak terlayani — tinggal dipetakan per jam.
3. **Ekonomi terbukti ngikutin stasiun.** Retail 50% dan Ruko 27% ada dalam 1 km stasiun (rumah cuma 8%). Jadi menganalisis keramaian dari sudut stasiun itu masuk akal secara data, bukan maksa.

---

## 3. Apa yang dilihat pengguna (fitur)

```
┌────────────────────────────────────────────────────────────┐
│  PETA                                                      │
│   🔥 heatmap keramaian (warna makin merah = makin ramai)   │
│   ◆ stasiun/terminal/halte                                 │
│   ⚠ kawasan "ramai tapi layanan kurang" disorot            │
│   ♿ pin aksesibilitas (nice to have)                       │
│                                                            │
│   ◀────────●──────────▶   slider jam                       │
│   06  10  14  18  22       geser → peta ikut berubah       │
├────────────────────────────────────────────────────────────┤
│  PANEL REKOMENDASI (ditulis AI)                            │
│  1. "Kawasan Kiaracondong ramai 18:00–21:00, kereta        │
│      terakhir 20:15 → pertimbangkan tambah jadwal malam"   │
│  2. "Kawasan Margaasih ramai tapi >2km dari semua          │
│      stasiun → kandidat rute feeder"                       │
├────────────────────────────────────────────────────────────┤
│  KOLOM TANYA AI: "kawasan mana yang masih hidup setelah    │
│  kereta terakhir?" → peta menyaring + jawaban tertulis     │
└────────────────────────────────────────────────────────────┘
```

1. **Heatmap + slider jam** — fitur pamer utamanya. Geser dari jam 6 pagi ke 12 malam, kota "bernapas": nyala, padam.
2. **Lapisan kesenjangan** — kawasan ramai yang layanannya kurang, disorot otomatis.
3. **Rekomendasi AI** — daftar rekomendasi konkret buat KAI/Dishub, tiap rekomendasi ada angka pendukung + alasannya (bisa diklik → peta terbang ke lokasinya).
4. **Asisten tanya-jawab** — nanya pakai bahasa biasa, peta ikut menyaring. (Rangka fitur ini sudah jadi di prototipe kita.)
5. **Pin aksesibilitas** (nice to have) — dijelaskan di bagian 7.

---

## 4. Data apa dipakai buat apa

| Data | Kolom yang dipakai | Jadi apa |
|---|---|---|
| **Struk Go** | Tanggal + Waktu Transaksi, Kategori Tempat, lokasi | Bukti "ada kegiatan ekonomi di titik ini jam segini" → bahan utama heatmap per jam |
| **Menu Go** | Waktu kunjungan, **Kondisi Pembeli (ramai/sedang/sepi)**, jenis tempat, harga, lokasi | Pengamatan keramaian langsung + **bahan latihan AI** (satu-satunya data yang ada label ramainya) |
| **Community Maps** | Cap tanggal-jam di foto, isi laporan, lokasi | Bukti aktivitas warga per jam + keluhan (jalan rusak, macet) |
| **Properti Go** | Kategori (ruko/warung/kos/rumah...), lokasi — 590 titik | "Peta latar": di mana orang tinggal & usaha → kawasan mana yang *berpotensi* ramai, dan bukti kawasan tak terjangkau |
| Data pendukung (resmi, sumber dicantumkan) | Jadwal KA lokal Bandung Raya, rute Trans Metro Bandung, titik stasiun/halte dari OpenStreetMap | Sisi "layanan" buat dibandingkan dengan sisi "keramaian" |
| **Nice to have:** data naik-turun penumpang KAI | — | Kalau dikasih: buat kalibrasi (mencocokkan skor kita dengan angka penumpang beneran). Sistem didesain punya "slot" buat data ini. **Produk tetap jalan tanpa ini.** |

**Catatan penting buat proposal:** kita TIDAK menjanjikan "prediksi jumlah penumpang" — data penumpang tidak ada di data wajib, dan janji itu bakal dibantai juri di bagian validasi. Yang kita janjikan: **peta sisi permintaan** (kawasan mana hidup, jam berapa) dibandingkan **sisi layanan** (transit ada/tidak, jam berapa). Kalau nanti dapat data penumpang KAI → tinggal masuk slot kalibrasi. Kelemahan berubah jadi roadmap.

---

## 5. Cara hitungnya, langkah demi langkah

Ini bagian yang sering ditanya: "ramai itu standarnya berapa?" Jawaban jujurnya: **tidak ada angka standar mutlak** dari data sebesar ini — yang jujur dan bisa dipertanggungjawabkan adalah **perbandingan relatif** (kawasan ini ramai *dibanding kawasan lain di kota yang sama*). Begini langkahnya:

### Langkah 1 — Bagi wilayah jadi kotak

Wilayah studi dibagi kotak-kotak segi enam (heksagon) selebar ±500 m. Kenapa kotak, bukan per-titik? Karena satu struk di satu warung itu bukan cerita; sepuluh struk dalam satu kotak baru cerita.

### Langkah 2 — Bagi hari jadi blok waktu

Bukan per jam, tapi per **blok 3–4 jam**: pagi (06–10), siang (10–14), sore (14–18), malam (18–22), larut (22–06). Alasannya jujur: datanya belum tebal, kalau dipecah per jam tiap sel isinya 0–1 pengamatan — kesimpulannya bohong. Blok lebar = tiap sel lebih terisi. (Kalau nanti data API penuh sudah tebal, blok bisa dipersempit.)

### Langkah 3 — Hitung "poin kegiatan" tiap kotak per blok waktu

Tiap bukti kegiatan menyumbang poin ke kotaknya, dengan bobot beda:

| Bukti | Poin | Alasan bobot |
|---|---|---|
| 1 pengamatan Menu Go "Ramai" | 3 | Pengamatan keramaian langsung — paling dipercaya |
| 1 pengamatan Menu Go "Sedang" | 2 | |
| 1 pengamatan Menu Go "Sepi" | 1 | Tetap bukti tempat itu buka |
| 1 struk transaksi | 1 | Bukti transaksi beneran terjadi |
| 1 struk e-commerce | 0 | **Dibuang** — belanja online tercatat di mana pun pembelinya, bukan bukti keramaian lokasi |
| 1 laporan warga (dari cap jam foto) | 0,5 | Bukti aktivitas, tapi bukan transaksi |

Ditambah pengali kecil dari Properti Go: kotak yang isinya banyak tempat usaha (ruko/warung/retail) dapat pengali potensi, karena makin banyak "wadah" makin masuk akal ramai. (Angka bobot ini keputusan tim — sengaja ditulis terbuka biar bisa didebat dan diubah. Jangan disembunyikan di proposal; juri lebih suka bobot yang diakui daripada angka misterius.)

### Langkah 4 — Ubah poin jadi kelas "ramai" (ini jawaban soal "standarnya berapa")

Kumpulkan nilai semua (kotak × blok waktu), lalu **diranking**:

- Masuk **25% teratas** → kelas **RAMAI**
- 25–50% → **SEDANG**
- Di bawahnya → **SEPI**
- Kotak tanpa pengamatan sama sekali → **TIDAK ADA DATA** (abu-abu — bukan dianggap sepi! Ini penting biar jujur)

Jadi "ramai" artinya: *termasuk yang paling ramai dibanding seluruh kota pada data yang ada.* Bukan angka mutlak "minimal 50 transaksi" — angka mutlak baru bisa dibuat kalau ada data penumpang/omzet buat kalibrasi (di situlah slot data KAI).

### Langkah 5 — Hitung skor layanan transit tiap kotak per blok waktu

Dari data pendukung (jadwal + titik stasiun/halte):

- **Dekat** layanan (< 1 km jalan kaki) dan pada blok itu layanannya **sering** → layanan BAIK
- Dekat tapi jarang (mis. malam cuma 1 kereta) → layanan KURANG
- Jauh dari semua stasiun/halte (> 2 km) → TIDAK TERLAYANI

### Langkah 6 — Temukan kesenjangan

Tabrakkan langkah 4 dan 5:

| Keramaian | Layanan | Artinya | Rekomendasinya |
|---|---|---|---|
| RAMAI | BAIK | Sehat | — |
| RAMAI | KURANG (dekat tapi jarang) | **Kesenjangan jadwal** | "Tambah frekuensi/armada di jam ini" |
| RAMAI | TIDAK TERLAYANI | **Kesenjangan jangkauan** | "Kandidat rute/halte baru" — kotak-kotak begini yang bersebelahan digabung jadi usulan koridor |
| SEPI | BAIK | Menarik juga: layanan ada, kawasan sepi | Bahan pertanyaan: kenapa? |

### Langkah 7 — Contoh biar kebayang (angka karangan, cuma ilustrasi)

> Kotak dekat Kiaracondong, blok malam (18–22): ada 4 struk (4 poin) + 2 pengamatan Menu Go "Ramai" (6 poin) + 3 laporan warga (1,5 poin) = **11,5 poin** → masuk 25% teratas se-kota → kelas RAMAI. Stasiun cuma 700 m (dekat ✓), tapi jadwal kereta lokal setelah jam 20:00 tinggal satu → layanan KURANG. → Sistem menandai: **kesenjangan jadwal**, dan AI menulis: *"Kawasan X ramai hingga blok malam (11,5 poin kegiatan, peringkat 12 dari 400 kotak), namun frekuensi layanan turun 80% setelah 20:00. Pertimbangkan penambahan jadwal malam."*

### Peran AI (tiga, semuanya di dalam WebGIS)

1. **Mengisi bolongan** — banyak tempat/jam belum diamati. AI belajar dari label Menu Go (jenis tempat + jam + ramai/sedang/sepi) buat **memperkirakan** kelas keramaian tempat serupa yang belum diamati. Hasil perkiraan diberi tanda beda dari hasil pengamatan (garis putus-putus / label "perkiraan") — jujur itu wajib.
2. **Menulis rekomendasi** — dari tabel kesenjangan, AI menyusun kalimat rekomendasi + alasan + angka. AI-nya tidak boleh mengarang angka: semua angka ditarik dari hitungan langkah 1–6. (Prinsip ini sudah kami pakai di prototipe.)
3. **Asisten tanya-jawab** — pengguna nanya bahasa biasa, peta ikut berubah.

**Validasinya** (juri pasti nanya): sampel acak titik yang diprediksi "ramai jam X" didatangi pas survey activities di jam itu → cocok atau tidak, angkanya dilaporkan. Prediksi yang bisa dicek > klaim canggih yang tidak bisa dicek.

---

## 6. Kenapa nggak pakai Google aja? (siap-siap ditanya juri)

- Google *popular times* itu per-tempat, **tertutup**, dan tidak boleh ditarik massal buat analisis. Kita butuh analisis se-kota — itu cuma bisa dengan data terbuka seperti MAPID.
- Google Maps merutekan orang di jalur yang **sudah ada**; dia tidak bisa dan tidak pernah menjawab "di mana perlu jalur BARU". Produk kita menjawab itu.
- Warung kaki lima & gerobak — yang justru penanda keramaian kawasan — hampir tidak ada di Google. Menu Go bahkan mencatat pedagang yang berkeliling.

---

## 7. Nice to have: pin aksesibilitas ♿

Fitur kecil tapi bikin rekomendasi kita lebih berempati — dan risetnya sudah kami kerjakan duluan (lihat [RESEARCH-AKSESIBILITAS.md](RESEARCH-AKSESIBILITAS.md)).

**Apa:** di sekitar stasiun dan kawasan yang direkomendasikan, ada pin kecil: titik ini **ramah akses** (ada ramp/curb cut, pintu rata) / **tidak ramah** (berundakan, trotoar rusak) / **belum bisa dinilai**. Sumbernya: foto-foto lapangan MAPID (Properti Go & Menu Go — ribuan foto tampak depan), dibaca AI, klik pin → muncul fotonya + tanggal foto + alasannya.

**Aturan jujurnya** (hasil riset kemarin):
- Yang dinilai cuma **fitur permanen** (undakan, ramp, lebar pintu) — itu berubahnya bertahun-tahun, jadi foto beberapa bulan lalu masih valid. Penghalang sementara (motor parkir) tidak dijadikan vonis.
- Selalu tampilkan **tanggal fotonya** — biar orang menimbang sendiri.
- Foto yang tidak jelas (malam, tertutup) → jujur "belum bisa dinilai", dan titik-titik itu jadi daftar tujuan survey lapangan.

**Nyambungnya ke fitur utama:** setiap rekomendasi buat KAI dapat satu baris tambahan, contoh: *"...dan dari foto lapangan, 6 dari 10 titik keramaian di kawasan ini berundakan tanpa ramp — jika layanan ditambah, siapkan juga aksesnya."* Rekomendasi kita jadi lebih lengkap dari tim mana pun: bukan cuma BERAPA armada, tapi juga SIAPA penumpangnya (termasuk lansia & teman daksa — data BPS: kelompok penyandang disabilitas terbesar itu perempuan lansia).

---

## 8. Batasan yang kita akui duluan (dan jawabannya)

| Pertanyaan/serangan juri | Jawaban kita |
|---|---|
| "Sampelnya kecil banget (15–25 baris buat sebagian data)" | Betul — makanya yang kami serahkan sekarang adalah **metode yang sudah jalan**; data penuh diakses lewat API MAPID setelah lolos 50 besar, dan survey activities menambah data di titik yang bolong |
| "Ini forecast penumpang?" | Bukan. Ini peta sisi permintaan kawasan vs sisi layanan. Data penumpang adalah slot kalibrasi kalau KAI berkenan berbagi |
| "Standar 'ramai' dari mana?" | Relatif (ranking persentil se-kota), bukan angka mutlak — dan bobotnya kami tulis terbuka. Kalibrasi absolut menunggu data penumpang |
| "Jam yang terekam kan jamnya surveyor" | Betul, ada bias — diakui, dan kelas "tidak ada data" dibedakan dari "sepi". Survey diarahkan ke jam yang bolong |
| "Kotak tanpa data dianggap sepi dong?" | Tidak — abu-abu, bukan sepi. Itu prinsip kejujuran peta kami |

---

## 9. Rencana kerja kasar

| Tahap | Isi | Kapan |
|---|---|---|
| 1 | Heatmap + slider blok waktu dari data sample (rangka peta, filter, asisten AI sudah jalan di prototipe kami) | Sekarang — buat proposal |
| 2 | Skor layanan (jadwal KA lokal + halte OSM) + tabel kesenjangan + rekomendasi versi pertama | Sekarang — buat proposal |
| 3 | Wawancara singkat & finalisasi bobot; tulis proposal | Sebelum deadline 2 Agustus |
| 4 | Data penuh via API + AI prediksi keramaian + validasi survey | Setelah lolos 50 besar |
| 5 | Pin aksesibilitas (baca foto massal) + kalibrasi data KAI (kalau dapat) | Setelah lolos 50 besar |

---

## 10. Satu paragraf buat ngejelasin ke orang (elevator pitch)

> "Kota itu punya denyut — ramai jam sekian, sepi jam sekian — tapi selama ini nggak ada yang merekamnya dalam bentuk yang bisa dianalisis. Kami membacanya dari jejak kegiatan nyata warga di data MAPID: struk belanja, kondisi tempat makan, laporan warga. Hasilnya peta yang bisa digeser per jam: kelihatan kawasan mana yang hidup jam berapa. Terus kami tabrakkan dengan layanan transportasi umum yang ada — dan AI menunjukkan ke KAI: di sini ramai tapi keretanya sudah habis, di sana hidup tapi nggak ada jalur sama sekali. Bonusnya, tiap rekomendasi dilengkapi catatan aksesibilitas dari foto lapangan, biar layanan yang ditambah juga bisa dinaiki semua orang — termasuk lansia dan teman-teman daksa."
