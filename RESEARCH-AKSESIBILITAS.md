# Riset: Aksesibilitas & Transportasi Umum di Indonesia

> Dokumen kerja untuk tahap **mencari masalah**. Urutannya sengaja: temuan → masalah → pertanyaan → baru gambaran solusi (§5b) — bukan solusi duluan.
> Terakhir di-update: 26 Juli 2026. Sebagian besar temuan dari internet + hitung-hitungan data sample lomba. Yang masih perlu dicek langsung ke lapangan ditandai di §6.

---

## ⚡ Status keputusan (26 Juli 2026)

**Aksesibilitas diputuskan jadi LAPISAN PENDUKUNG, bukan ide utama.** Ide utama tim sudah dikunci dan dituangkan lengkap di **[IDE-UTAMA.md](IDE-UTAMA.md)**: peta denyut kawasan per jam (heatmap + slider) + kesenjangan layanan transit + rekomendasi AI untuk KAI. Aksesibilitas masuk sebagai pin di peta + catatan akses di tiap rekomendasi (lihat §7 di IDE-UTAMA.md).

Bentuk nempelnya aksesibilitas di ide utama, ringan saja:
1. **Pin aksesibilitas** di peta sekitar stasiun/jalur: ramah akses / tidak / belum dinilai (dari foto, fitur permanen saja) — klik pin = foto + tanggal + alasan.
2. **Catatan akses di tiap rekomendasi** untuk KAI ("jika layanan ditambah di kawasan ini, 6/10 titik keramaiannya berundakan — siapkan aksesnya").
3. Filter "yang bisa kursi roda" di asisten tanya-jawab.

**Soal kekhawatiran "fotonya tidak diperbarui":** tidak fatal, asal dipisah dua jenis temuan —
- **Fitur permanen** (undakan, ramp, lebar pintu): berubahnya bertahun-tahun → foto beberapa bulan lalu masih valid. Ini yang boleh dinilai.
- **Penghalang sementara** (motor parkir, dagangan, gerobak): berubah jam-jaman → dicatat, tapi tidak dijadikan dasar penilaian.

Penangkalnya: selalu tampilkan **tanggal foto** (cap MAPID sudah ada di tiap foto); titik yang fotonya tua/tak ternilai jadi daftar tujuan survey activities; dan pembandingnya bukan "data sempurna" tapi "tidak ada info sama sekali" — foto berumur 2 bulan + tanggal jelas tetap lompatan besar dari nol.

Dokumen ini tetap disimpan utuh: temuan-temuannya (T1–T11) tetap valid sebagai konteks, dan kalau arah ide berubah lagi, kerjaannya tidak hilang.

**Cara baca:** tiap temuan diberi dua label.
- **Bukti:** `KUAT` (data resmi, atau kami hitung sendiri dari data) · `SEDANG` (baru satu studi/survei) · `CERITA` (pengalaman orang atau uji kecil-kecilan — belum tentu mewakili banyak orang)
- **Jenis:** `BIASA` (sesuai dugaan orang pada umumnya) · `TAK TERDUGA` (beda dari dugaan umum)

Temuan berlabel `CERITA` bukan berarti dibuang — justru itu daftar hal yang paling perlu dicek langsung ke orangnya.

---

## 1. Kenapa dokumen ini ada

Kami hampir langsung loncat bikin solusi ("peta aksesibilitas dari foto"). Terus ada satu keberatan dari diskusi internal yang bikin kami berhenti dulu:

> *"Setahu gw, orang dengan disabilitas itu selalu di-guide. Teman daksa kalau mau pergi, H-1 tempatnya dicek dulu sama orang tuanya, apakah ramah kursi roda. Kalau mau naik KRL/kereta jarak jauh harus telpon KAI dulu, nanti dijemput petugas pakai alat khusus."*

Keberatan ini ternyata benar (lihat T1, T2), dan mengubah cara kami melihat masalahnya. Jadi kami mundur dulu: kumpulkan temuan, rumuskan masalahnya, baru nanti bicara solusi.

---

## 2. Temuan

### Bagaimana penyandang disabilitas bepergian di Indonesia

**T1 — Di Indonesia, sistemnya memang "didampingi", bukan "jalan sendiri".** `KUAT` · `BIASA — tapi sering dilupakan orang yang bikin aplikasi`
KAI Commuter punya nomor khusus layanan disabilitas (081296605747). Cara kerjanya: kasih tahu jam kedatangan → petugas stasiun asal koordinasi dengan petugas di kereta dan stasiun tujuan → dijemput, didampingi, sampai diantar ke kendaraan berikutnya. Untuk kereta jarak jauh, koordinasinya lewat kondektur. Petugasnya juga dilatih khusus.
**Artinya buat kita:** aplikasi yang mengasumsikan "pengguna kursi roda buka HP terus navigasi sendiri" (gaya negara Barat) tidak cocok di sini. Yang bisa dibantu justru: **tahap merencanakan sebelum berangkat**, dan **orang yang mendampingi**.

**T2 — Repotnya merencanakan perjalanan itu masalah nyata, bukan cuma cerita.** `KUAT (studi luar) + CERITA (lokal)` · `BIASA`
Ada studi (RESNA) yang bilang: perencanaan untuk perjalanan sesederhana apa pun itu begitu melelahkan sampai banyak pengguna kursi roda memilih tidak keluar rumah sama sekali. Cerita teman daksa kita (tempat tujuan dicek dulu H-1 oleh orang tuanya) adalah wujud nyata dari temuan ini.
**Artinya:** "ngecek tempat sehari sebelumnya" itu pekerjaan nyata, berulang, dan belum ada alat bantunya. Ini calon inti masalah.

**T3 — Penghalang nomor satu ternyata bukan fisik, tapi INFORMASI.** `KUAT` · `TAK TERDUGA — orang mengira penghalangnya selalu tangga/trotoar`
Berbagai sumber konsisten menyebut tiga penghalang: bangunan/jalan yang tidak ramah, sikap orang & petugas, dan **tidak adanya informasi yang bisa dipercaya**. Ramp bisa saja sudah ada — tapi kalau tidak ada cara mengetahuinya dari rumah, sama saja seperti tidak ada.
**Artinya:** masalah beton tidak bisa kita kerjakan. Masalah informasi bisa.

**T4 — Kesenjangannya bisa diukur, dan besar.** `SEDANG (respondennya sedikit)` · `BIASA`
Survei 100 orang: kepuasan penyandang disabilitas terhadap transportasi umum cuma **1,94 dari 5** — pengguna umum 3,41. Studi lain menilai satu halte TransJakarta: skor aksesibilitasnya **38,4 dari 100** (kategori "buruk").

### Siapa saja yang terdampak

**T5 — Jumlahnya bukan minoritas kecil: 22,9 juta orang (8,5% penduduk).** `KUAT (Susenas 2020)` · `TAK TERDUGA — jauh lebih besar dari yang orang kira`
Sumber lain (dengan definisi lebih luas) bahkan menyebut 28 juta / 10%. Belum termasuk lansia, ibu bawa stroller, orang yang lagi cedera — kelompok yang ikut kebantu kalau tempat-tempat jadi mudah diakses.

**T6 — Penyandang disabilitas lebih banyak PEREMPUAN, dan paling banyak di usia lansia.** `KUAT (BPS, Sensus 2020)` · `TAK TERDUGA`
Data BPS: persentase penyandang disabilitas konsisten lebih tinggi pada perempuan, di semua kategori. Kelompok terbesar: **perempuan 65 tahun ke atas** — salah satunya karena perempuan hidup lebih lama.
⚠️ **Catatan jujur:** dugaan awal kami "kebanyakan pengguna layanan disabilitas KAI itu perempuan" **belum bisa dibuktikan** — datanya tidak tersedia untuk publik. Yang terbukti: (a) di tingkat penduduk keseluruhan, disabilitas memang lebih banyak dialami perempuan lansia; (b) penumpang KRL secara umum imbang, sekitar 50:50.
**Hal yang jarang disadari:** aksesibilitas ternyata juga soal gender dan penuaan. Bayangan pengguna yang tepat bukan cuma "pemuda pakai kursi roda" — tapi juga **nenek 68 tahun yang lututnya tidak kuat naik undakan**. Dan karena penduduk Indonesia makin menua, masalah ini makin besar tiap tahun, bukan makin kecil.

**T7 — Kebanyakan penyandang disabilitas kerjanya informal (dagang, usaha sendiri), bukan kantoran.** `KUAT` · `TAK TERDUGA — akibatnya yang menarik`
Hanya sekitar 22–40% yang bekerja. Lebih dari separuhnya berwirausaha. Yang bisa masuk kerja formal (kantoran) cuma 1–2%.
**Dua akibat:** (1) transportasi murah justru lebih penting buat mereka — tidak mampu "kabur" pakai taksi tiap hari; (2) jam bepergiannya **bukan jam kantor** — pedagang dan wirausaha bergeraknya di jam macam-macam. Padahal perencanaan transportasi biasanya cuma mikirin orang kantoran berangkat pagi pulang sore.

### Dari data lomba (kami hitung sendiri — detail di DATA-DAN-ANALISIS.md)

**T8 — Toko-toko nempel ke stasiun, tempat tinggal tidak. Kos paling parah.** `KUAT (590 data)` · `TAK TERDUGA`
Yang jaraknya di bawah 1 km dari stasiun/terminal: Retail 50%, Ruko 27%, Rumah 8%, **Kos 0%** (dari 29 kos, tidak ada satu pun). Padahal anak kos itu kelompok yang paling butuh transportasi murah — tapi justru paling jauh dari stasiun.

**T9 — Kondisi akses memang kelihatan dari foto lapangan MAPID (kami uji 5 foto).** `CERITA (baru uji kecil, 5 foto)` · `BIASA — tapi perlu dibuktikan, dan terbukti`
Dari 5 foto asli yang kami periksa satu-satu: undakan, trotoar bolong, tidak adanya ramp, dan motor parkir yang menutup pintu masuk **kelihatan jelas** di foto siang. Foto malam sebagian masih bisa dinilai, sebagian tidak.
**Pelajarannya:** penilaian dari foto wajib punya pilihan jawaban "tidak bisa dinilai" — jangan dipaksa nebak. Bonus: foto malam ada cap jamnya, jadi malah bisa dipakai untuk melihat **kondisi penerangan jalan** — data keselamatan pejalan kaki.

**T10 — Sudah ada yang pernah bikin hal mirip di lingkungan MAPID: namanya DIFLEX.** `KUAT` · `TAK TERDUGA`
DIFLEX = WebGIS peta fasilitas ramah difabel buatan tim PATEM-UPN (Surabaya). Cara kerjanya: pengguna menandai fasilitas secara manual (semacam Wikipedia — isinya dari sukarelawan).
**Kelemahan cara itu:** petanya kosong sampai ada orang yang mau mengisi, dan sukarelawan difabel jumlahnya sedikit. **Peluang pembeda kita:** menilai dari foto yang *sudah ada* (ribuan foto data lomba), jadi hari pertama pun peta sudah terisi.

**T11 — Ada soal harga diri yang tidak boleh diabaikan.** `SEDANG` · `TAK TERDUGA`
Ada studi yang menunjukkan sebagian orang tidak nyaman dilabeli "butuh bantuan". Jadi bahasa di aplikasi harus hati-hati: pakai "info akses untuk semua orang" (berguna juga buat stroller, koper, lansia) — bukan "fasilitas untuk penyandang cacat".

---

## 3. Kesimpulan gabungan: masalahnya ada di mana

Alur perjalanan penyandang disabilitas naik transportasi umum:

```
RUMAH ──(1)── STASIUN ASAL ──(2)── KERETA ──(3)── STASIUN TUJUAN ──(4)── TEMPAT TUJUAN
                └────── bagian ini SUDAH diurus KAI (T1):                      
                        telpon dulu, dijemput, didampingi ──────┘              
        ▲                                                              ▲       
        │                                                              │       
   (0) KEPUTUSAN BERANGKAT                              (4) BAGIAN TAK BERTUAN 
   dibuat sehari sebelumnya,                            jalan kaki terakhir +  
   infonya dikumpulkan MANUAL                           pintu tempat tujuan    
   dengan datang langsung (T2)                          (T3, T9)               
```

Dua celah yang tidak diurus siapa pun:

- **Celah (0) — keputusan berangkat.** Layanan KAI baru bekerja *setelah* orang memutuskan pergi. Masalahnya, keputusan itu sendiri macet karena tidak ada informasi — di sinilah ritual "cek tempat H-1" terjadi. Banyak rencana pergi yang batal di tahap ini, dan **pembatalan itu tidak tercatat di data mana pun** — jadi pemerintah tidak pernah tahu masalah ini ada.
- **Celah (4) — sisi tempat tujuan.** Pendampingan KAI selesai di stasiun. Setelah itu — jalan kaki ke tujuan, dan apakah pintunya bisa dimasuki — tidak ada yang mengurus. Bukan salah KAI; memang bukan wilayahnya. Justru itu celahnya: **tidak ada satu lembaga pun yang kebagian tugas ini**.

Ditambah satu lagi dari data lomba (T8): seandainya pun informasinya lengkap, **pilihan tempat yang dekat stasiun memang timpang** — toko banyak, tempat tinggal hampir tidak ada.

---

## 4. Peta masalah

Satu masalah akar, lima masalah turunan. Kode M dipakai biar gampang dirujuk saat diskusi.

| Kode | Masalah | Dasar |
|---|---|---|
| **M1 (AKAR)** | Tidak ada cara mengetahui "tempat itu bisa dimasuki atau tidak" **tanpa datang langsung** → muncul ritual cek H-1 oleh keluarga → banyak rencana pergi batal, dan pembatalannya tidak tercatat di mana pun | T2, T3, T9 |
| **M2** | Layanan putus di sisi tempat tujuan — KAI mengurus stasiun-ke-stasiun; jalan kaki terakhir + pintu tujuan tidak diurus siapa pun | T1 |
| **M3** | Kalaupun infonya ada, pilihannya memang sedikit — toko nempel stasiun, tempat tinggal (apalagi kos) tidak | T8 |
| **M4** | Pemerintah/operator tidak tahu harus memperbaiki yang mana dulu — tidak ada data tempat tujuan, dan mengecek satu-satu ke lapangan itu mahal | T4, T8 |
| **M5** | Peta serupa yang sudah ada (DIFLEX) mengandalkan sukarelawan → petanya kosong sampai ada yang mengisi | T10 |
| **M6** | Kelompok yang paling terdampak (perempuan lansia, pekerja informal) tidak pernah jadi patokan perencanaan — patokannya selalu orang kantoran | T6, T7 |

Hubungan ke rumusan masalah di §5: PS-1 menjawab M1+M2 · PS-2 menjawab M4 · PS-3 menjawab M6. M3 dan M5 jadi konteks latar belakang.

---

## 4b. Pertanyaan pemandu (guiding questions) — tiga tingkat

Dipisah tiga karena gunanya beda: tingkat 1 untuk **mengecek apakah masalahnya benar**, tingkat 2 **dijawab oleh WebGIS pakai data**, tingkat 3 **jembatan ke desain solusi**.

### Tingkat 1 — Cek dulu masalahnya benar atau tidak (tanya langsung ke orangnya, SEBELUM solusi diputuskan)

| # | Pertanyaan | Untuk mengecek |
|---|---|---|
| G1.1 | Kebiasaan "cek tempat H-1" itu umum, atau cuma satu-dua orang? Biasanya siapa yang ngecek — ortu, teman, komunitas? | M1 |
| G1.2 | Info apa yang paling menentukan jadi/batalnya pergi? (undakan? toilet? sikap pemilik tempat? parkir?) | M1, kriteria penilaian |
| G1.3 | Seberapa sering rencana pergi batal? Biasanya batal pergi ke jenis tempat apa? | M1 |
| G1.4 | Kalau sebuah tempat "bisa dimasuki asal ada yang bantu satu orang" — itu dianggap bisa, atau tetap dianggap tidak bisa? | T1, T11 |
| G1.5 | Siapa sebenarnya yang pakai layanan disabilitas KAI di Bandung? (umur, gender, seberapa sering, perginya ke mana) | M6, T6 |
| G1.6 | Kata-kata seperti apa yang nyaman dipakai di aplikasi? | T11 |

### Tingkat 2 — Dijawab WebGIS pakai data

| # | Pertanyaan | Menjawab |
|---|---|---|
| G2.1 | Dari semua tempat yang jaraknya bisa dijalan-kaki dari stasiun X, **berapa yang benar-benar bisa dimasuki?** (ini angka utamanya) | M1, M2 |
| G2.2 | Apakah tempat murah lebih susah diakses daripada tempat mahal? (bandingkan harga vs kondisi akses — soal keadilan) | M3 |
| G2.3 | Stasiun mana yang paling baik/paling buruk, dan apa bedanya? | M4 |
| G2.4 | Yang lebih sering jadi penghalang itu **jalannya** (trotoar rusak/putus) atau **pintunya** (undakan)? → jawaban ini menentukan rekomendasi larinya ke Pemda (trotoar) atau ke pedagang (undakan) | M4 |
| G2.5 | Kalau cuma sanggup pasang satu ramp, di titik mana ramp itu membuka akses ke paling banyak tempat? | M4 |
| G2.6 | Bagaimana penerangan jalan di malam hari? (dari foto malam yang ada cap jamnya) | M2 |
| G2.7 | Untuk lansia: berapa banyak kebutuhan harian (pasar, apotek, puskesmas) yang terjangkau dari tiap stasiun? | M6 |

### Tingkat 3 — Jembatan ke solusi ("Gimana caranya kita…") — JANGAN dijawab sebelum Tingkat 1 selesai

| # | Pertanyaan |
|---|---|
| G3.1 | …memindahkan "cek tempat H-1" dari datang langsung jadi lihat layar — **tanpa kehilangan rasa percayanya**? (orang tua percaya mata sendiri; apa yang bikin mereka mau percaya peta? → dugaan jawaban: selalu tunjukkan fotonya + alasannya, jangan cuma kasih skor) |
| G3.2 | …bilang "kami tidak tahu kondisi tempat ini" secara jujur, tanpa bikin aplikasinya terasa kosong? |
| G3.3 | …melayani **pendampingnya** sebagai pengguna utama, bukan cuma penyandangnya? |
| G3.4 | …nyambung dengan layanan KAI yang sudah ada — jadi terasa melengkapi, bukan menyaingi? |
| G3.5 | …bikin pemilik warung *mau* dinilai — bahkan bangga dipasang tanda "mudah diakses"? (iming-imingnya: pembeli baru) |
| G3.6 | …menjaga perasaan dan harga diri di tiap kata yang tampil di layar? |

---

## 5. Calon rumusan masalah (problem statement)

Formatnya: *[siapa] butuh [apa] karena [temuan]* — sengaja tanpa menyebut solusi.

**PS-1 (utama):**
> Penyandang disabilitas daksa dan keluarganya di Bandung Raya butuh cara untuk tahu — **sebelum berangkat** — apakah tempat tujuan di sekitar stasiun/terminal benar-benar bisa dimasuki. Karena sekarang, satu-satunya cara tahu adalah mendatangi tempatnya langsung (cek H-1), dan repotnya itu membuat banyak rencana pergi batal bahkan sebelum dimulai. (T1, T2, T3, T9)

**PS-2 (untuk pemerintah/operator):**
> Operator transportasi dan Pemda butuh cara untuk tahu **perbaikan kecil mana yang paling besar dampaknya** (ramp di warung mana, trotoar di ruas mana). Karena selama ini anggaran aksesibilitas dibagi tanpa data tentang tempat tujuan — yang ada cuma data fasilitas stasiun. (T3, T4, T8)

**PS-3 (sudut pandang yang jarang diangkat tim lain):**
> Perempuan lansia — kelompok penyandang disabilitas terbesar di Indonesia, yang jumlahnya terus bertambah — butuh info tempat kebutuhan harian (pasar, puskesmas, tempat ibadah) yang terjangkau dari stasiun. Karena kebutuhan mereka beda dari orang kantoran yang selama ini jadi patokan perencanaan transportasi. (T6, T7)

Saran: **PS-1 jadi inti**, PS-2 jadi bagian output rekomendasi (panitia mewajibkan ada rekomendasi untuk stakeholder), PS-3 buat mempertajam cerita di latar belakang.

---

## 5b. Gambaran solusi (masih coretan — bisa berubah setelah cek lapangan §6)

Enam masalah tidak mungkin diselesaikan satu solusi. Jadi solusinya berupa **paket 4 fitur + 1 pengakuan jujur**, yang semuanya hidup di **satu WebGIS yang sama** (lomba memang mintanya satu produk). Tiap fitur menjawab masalah yang berbeda.

### Tabel ringkas: solusi mana menjawab masalah mana

| | M1 cek H-1 | M2 sisi tujuan | M3 pilihan timpang | M4 prioritas perbaikan | M5 peta kosong | M6 lansia terlupakan |
|---|---|---|---|---|---|---|
| S1 Peta "bisa dimasuki nggak" | ✅ inti | ✅ | | | ✅ | |
| S2 Rapor akses per stasiun | | ✅ inti | ✅ menunjukkan | ✅ | | |
| S3 Daftar prioritas perbaikan | | | | ✅ inti | | |
| S4 Mode kebutuhan harian | | | | | | ✅ inti |
| S5 Asisten tanya-jawab | ✅ | | | | | ✅ |

---

### S1 — Peta "bisa dimasuki nggak" *(menjawab M1, M2, M5)*

**Apa:** tiap tempat (warung, kos, toko) di peta punya label kondisi akses: **A** = bisa masuk sendiri · **B** = bisa, asal ada yang bantu satu orang · **C** = praktis tidak bisa · **?** = belum bisa dinilai. Klik tempatnya → muncul **foto asli + alasannya** ("ada dua undakan, tidak ada ramp, trotoar depannya bolong") — bukan cuma skor.

**Cara kerjanya:** AI membaca ribuan foto lapangan MAPID yang *sudah ada* (1.180 foto tampak depan di Properti Go saja), menilai pakai daftar kriteria tetap: ada undakan? ada ramp? pintunya cukup lebar? permukaan depannya rata? ada motor/dagangan yang menghalangi? Hasil AI dicek silang dengan penilaian manusia (tim melabeli ±50 foto dulu, hitung seberapa cocok), lalu dicek ke lapangan lewat survey activities.

**Kenapa ini mengalahkan cara lama (DIFLEX/sukarelawan):** hari pertama peta sudah terisi ratusan titik, karena fotonya sudah ada — tidak perlu menunggu sukarelawan.

**Ini menjawab ritual cek H-1:** yang tadinya "datang dulu sehari sebelumnya buat lihat", jadi "lihat foto + alasan dari rumah". Kata kuncinya *kepercayaan* (G3.1): makanya yang ditampilkan foto dan alasan yang bisa dicek mata sendiri, bukan angka misterius.

### S2 — Rapor akses per stasiun *(menjawab M2, M4; memperlihatkan M3)*

**Apa:** satu angka per stasiun — **"dari X tempat yang kelihatan dekat stasiun ini, cuma Y yang benar-benar bisa dimasuki."** Ditambah rincian: penghalangnya lebih sering di jalannya (trotoar) atau di pintunya (undakan), dan bagaimana penerangan jalannya di malam hari (dari foto malam).

**Buat apa:** membandingkan antar stasiun ("kenapa Stasiun A 30% tapi Stasiun B cuma 5%?"), dan jadi bukti buat masalah M3 — kalau memang pilihan dekat stasiun timpang, angkanya kelihatan di sini. Aplikasi tidak bisa membangun kos dekat stasiun, tapi bisa **menunjukkan datanya ke yang bisa** (Pemda, pengembang).

### S3 — Daftar prioritas perbaikan *(menjawab M4)*

**Apa:** keluaran otomatis untuk Pemda/operator/pedagang: *"kalau cuma sanggup pasang 10 ramp, pasang di 10 titik ini — karena membuka akses ke paling banyak tempat"* dan *"ruas trotoar ini yang paling banyak memutus jalur"*. Plus versi buat pedagang: tempat yang tinggal selangkah lagi jadi mudah diakses ("cuma butuh papan landai Rp200 ribu") ditandai — dengan iming-iming: pembeli baru (G3.5).

**Kenapa penting buat lomba:** panitia mewajibkan output berupa **rekomendasi untuk stakeholder** — ini bentuk konkretnya, bukan rekomendasi umum "sebaiknya ditingkatkan".

### S4 — Mode kebutuhan harian *(menjawab M6)*

**Apa:** satu tombol yang mengubah sudut pandang peta: dari "semua tempat" jadi "kebutuhan harian lansia & pekerja informal" — pasar, apotek, puskesmas, tempat ibadah, warung murah. Pertanyaannya berubah dari "ada apa aja dekat stasiun" jadi **"nenek 68 tahun turun di stasiun ini, kebutuhan hariannya kejangkau nggak?"**

**Kenapa ini pembeda:** hampir semua tim akan mendesain untuk komuter kantoran. Data BPS bilang kelompok terbesar justru perempuan lansia (T6) — dan belum ada yang mendesain untuk mereka.

### S5 — Asisten tanya-jawab di dalam peta *(melayani M1 & M6; sekaligus syarat wajib lomba "AI di dalam interface")*

**Apa:** kolom tanya berbahasa sehari-hari: *"aku pakai kursi roda, mau makan di bawah 25 ribu dekat Stasiun Bandung"* → peta langsung menyaring dan menjawab, lengkap dengan alasan per tempat. Didesain juga untuk **pendamping** (G3.3): *"besok mau antar ibu ke pasar naik kereta, turun di mana yang paling gampang?"*

**Catatan teknis:** rangka asisten ini sudah jadi di prototipe (tab AI); tinggal ditambah dimensi kondisi akses.

---

### Yang sengaja TIDAK dijanjikan (biar jujur)

1. **M3 tidak bisa diselesaikan aplikasi.** Kos jauh dari stasiun itu masalah pembangunan kota. Yang bisa kami lakukan: membuktikannya dengan angka dan menyerahkan ke yang berwenang (S2, S3).
2. **Label "?" (belum bisa dinilai) akan banyak** — foto malam, foto tertutup. Ini ditampilkan apa adanya, bukan disembunyikan. Titik "?" justru jadi daftar tujuan survey lapangan.
3. **Aplikasi ini tidak menggantikan pendamping dan tidak menggantikan layanan KAI** — dia mengisi bagian yang dua-duanya tidak urus: keputusan sebelum berangkat, dan info sisi tujuan.

### Urutan pengerjaannya (realistis, bukan mimpi)

| Tahap | Yang dikerjakan | Kapan |
|---|---|---|
| 1 | S1 versi kecil: tim melabeli ±30 titik manual dari foto → tampil di prototipe sebagai bukti konsep | sekarang, buat proposal |
| 2 | S2 + S5 dasar (rangkanya sudah ada di prototipe) | sekarang, buat proposal |
| 3 | Cek lapangan §6 (wawancara) → kriteria penilaian dikunci | sebelum submit proposal |
| 4 | S1 versi penuh: AI membaca semua foto + dicek lapangan lewat survey activities | setelah lolos 50 besar |
| 5 | S3 + S4 lengkap | setelah lolos 50 besar |

---

## 6. Yang harus dicek langsung ke lapangan (tidak bisa dari internet)

| # | Pertanyaan | Cara | Mengecek |
|---|---|---|---|
| P1 | Kebiasaan "cek H-1" umum atau tidak? Siapa pelakunya? | Wawancara 3–5 orang (komunitas difabel Bandung) | G1.1 |
| P2 | Info apa yang PALING dicari sebelum berangkat? | Wawancara + minta urutkan kartu prioritas | G1.2 |
| P3 | Apakah "bisa masuk asal dibantu satu orang" dianggap bisa? | Diskusi kriteria bareng pengguna kursi roda | G1.4 |
| P4 | Profil pengguna layanan disabilitas KAI Bandung? | Tanya KAI Daop 2 / amati di stasiun (bisa jadi bagian survey lapangan lomba) | G1.5 |
| P5 | Pemilik warung mau nggak dipasangi tanda/ramp kalau tahu bisa menambah pembeli? | Ngobrol singkat dengan 5 pedagang dekat stasiun | G3.5 |
| P6 | Kata-kata apa yang nyaman dipakai? | Uji beberapa pilihan kata dengan komunitas | G1.6 |

**Panduan ngobrol singkat (buat P1–P3):**
1. "Ceritain dong perjalanan terakhir naik transportasi umum" →
2. "Sebelum berangkat, apa aja yang dicek? Siapa yang ngecek? Gimana caranya?" →
3. "Pernah nggak rencana pergi yang akhirnya batal? Kenapa?" →
4. "Kalau ada satu hal yang bisa diketahui dari rumah sebelum berangkat, pengennya tahu apa?" →
5. Tunjukkan 3 foto tempat dari data MAPID: "Menurut Anda ini bisa dimasuki nggak? Apa yang Anda lihat?" *(pertanyaan terakhir ini sekalian menguji: apakah cara kita menilai foto sama dengan cara mereka menilai)*

---

## 7. Risiko & etika

1. **Jangan simpan data pribadi** — semua yang ditampilkan berupa angka gabungan; aturan lomba juga melarang data pribadi sensitif.
2. **Salah label lebih bahaya daripada tidak ada label.** Tempat ditandai "bisa dimasuki" padahal tidak = orang terlanjur datang dan terlantar. Makanya pilihan "tidak bisa dinilai" wajib ada, dan selalu tampilkan foto + alasan — bukan cuma skor.
3. **Bahasa** (T11): hindari nada kasihan. Pakai sudut pandang "info berguna untuk semua orang" — kursi roda, stroller, koper, lansia.
4. **Jangan mengaku mewakili komunitas** tanpa benar-benar melibatkan komunitas — minimal kriteria penilaian foto harus dicek bareng mereka (P3) sebelum skornya dipublikasikan.

---

## 8. Sumber

**Dari internet:**
- [Kompas — Cara akses layanan disabilitas LRT/MRT/KRL/KAI](https://www.kompas.com/tren/read/2023/12/12/181500865/cara-akses-dan-daftar-layanan-disabilitas-bagi-penumpang-lrt-mrt-krl-dan?page=all) (T1)
- [Liputan6 — Layanan disabilitas KRL menurut pengguna](https://www.liputan6.com/bisnis/read/5816086/layanan-disabilitas-di-krl-jabodetabek-bagaimana-kata-pengguna) (T1)
- [RESNA — Accessibility information to promote independence for wheelchair users](https://www.resna.org/sites/default/files/legacy/conference/proceedings/2004/Papers/Research/OTH/AccessabilityInfo.html) (T2)
- [Liputan6 — Tantangan akses transportasi publik](https://www.liputan6.com/disabilitas/read/6059175/tantangan-penyandang-disabilitas-dalam-akses-transportasi-publik-infrastruktur-dan-sdm-belum-inklusif) (T3)
- [WRI Indonesia — Melibatkan penyandang disabilitas dalam layanan transportasi](https://wri-indonesia.org/en/insights/engaging-person-disabilities-urban-transportation-service) (T3, T4)
- [Kohesi — Ketimpangan aksesibilitas halte Tanjung Duren](https://cibangsa.com/index.php/kohesi/article/view/12398) (T4)
- [BPS — Potret Penyandang Disabilitas di Indonesia, Long Form SP2020](https://www.bps.go.id/id/publication/2024/12/20/43880dc0f8be5ab92199f8b9/potret-penyandang-disabilitas-di-indonesia-hasil-long-form-sp2020.html) · [versi UNFPA (PDF)](https://indonesia.unfpa.org/sites/default/files/pub-pdf/2025-07/Potret%20Penyandang%20Disabilitas%20di%20Indonesia%20Hasil%20Long%20Form%20Sensus%20Penduduk%202020.pdf) (T5, T6)
- [SWA — Survei KAI: profil penumpang commuter line](https://swa.co.id/swa/trends/business-research/survei-kai-mayoritas-penumpang-kereta-commuter-line-lulusan-sma) (T6 — penumpang KRL ±50:50)
- [KAGAMA — Pengangguran disabilitas & pemberdayaan](https://kagama.id/pengangguran-disabilitas-tinggi-tantangan-implementasi-kebijakan-dan-urgensi-pemberdayaan/) (T7)
- [MAPID — DIFLEX oleh PATEM-UPN](https://mapid.co.id/articles/patemupn_melalui_diflex_mendorong_inklusifitas_fasilitas_difabel_melalui_teknologi_webgis) (T10)

**Hitungan sendiri:** [DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md) (T8), uji 5 foto sample MAPID (T9).
**Cerita lokal:** pengalaman teman daksa (cek H-1, telpon KAI dulu) — masuk T2, menunggu dicek lewat P1.
