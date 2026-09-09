# BAB 5: KELAYAKAN TEKNIS

> Draf siap salin ke proposal (target 1–2 halaman). Catatan tim — jangan ikut disalin: ganti `[WILAYAH STUDI]` dan `[LINK GITHUB]`, dan pastikan wilayah studi konsisten dengan Bab 1–4.

---

## 5.1 Teknologi yang Digunakan

Arsitektur SIMPUL dirancang dengan satu prinsip: **komputasi berat dijalankan di belakang secara terjadwal, sehingga WebGIS yang diakses publik tetap ringan** (Gambar 5.1).

Antarmuka dibangun dengan **React + TypeScript** dan **MapLibre GL JS** dengan basemap **MAPID Maps**, responsif untuk desktop maupun mobile. Backend **Node.js + Express** menyajikan hasil analisis sebagai GeoJSON dan menjadi rumah asisten AI (kunci API tersimpan aman di server). Seluruh data tersimpan di **PostgreSQL + PostGIS**, yang sekaligus menjalankan sebagian analisis spasial melalui fungsi bawaannya: `ST_HexagonGrid` (grid heksagon), `ST_DWithin` (pencarian radius), dan operator KNN (simpul transit terdekat). Data diolah melalui **pipeline terjadwal** yang mencakup pembersihan data, pengayaan AI, dan perhitungan analisis sebelum hasilnya disimpan ke basis data — rincian orkestrasinya akan dimatangkan pada tahap implementasi. Komponen AI dilatih **mandiri**: klasifikasi teks laporan warga dengan *fine-tuning* **IndoBERT**, prediksi keramaian dengan **scikit-learn**, dan pembacaan nominal struk dengan **PaddleOCR** — setiap keluaran membawa skor keyakinan dan label "Perkiraan". **QGIS** digunakan untuk *network analysis* jaringan pejalan kaki. Seluruh sistem di-deploy pada layanan publik gratis: **Vercel** (frontend), **Railway/Render** (backend), dan **Neon/Supabase** (PostGIS).

Kelayakan rancangan ini telah diuji lewat **prototipe berjalan** (https://tes-web-gis.vercel.app/, kode: `[LINK GITHUB]`): heatmap aktivitas per blok waktu, mode kesenjangan layanan, rekomendasi otomatis yang tertaut dua arah dengan peta, asisten AI dengan "jejak nalar" yang dapat diaudit, serta jalur rel dari geometri OpenStreetMap. **Seluruh angka pada proposal ini dihasilkan pipeline tersebut dari data sampel resmi**, dan mesin analisisnya dipakai ulang tanpa perubahan pada tahap implementasi — yang berpindah hanya tempat eksekusi dan sumber datanya.

> **[GAMBAR 5.1 — diagram arsitektur]**
> *Gambar 5.1. Arsitektur SIMPUL: sumber data diolah pipeline terjadwal, disimpan pada PostgreSQL/PostGIS, disajikan backend Express, dan ditampilkan frontend React + MapLibre (basemap MAPID Maps).*

## 5.2 Sumber Data

| Sumber Data | Peran dalam Sistem | Akses |
|---|---|---|
| **Struk Go** (MAPID, wajib) | Bukti kegiatan ekonomi ber-waktu: tanggal & jam transaksi, kategori merchant, metode pembayaran | Sampel resmi (sudah diolah di prototipe); API *Missions* MAPID menyusul |
| **Menu Go** (MAPID, wajib) | Pengamatan keramaian berlabel (ramai/sedang/sepi) + jam kunjungan & harga — bahan latih model prediksi keramaian | Sampel resmi; API MAPID setelah kurasi |
| **Community Maps** (MAPID, wajib) | Sinyal aktivitas & keluhan warga ber-foto dan ber-waktu; keterangan ramai/sepi dan jam pengamatan dibaca dari teks laporan | **Sudah tersambung** ke API kompetisi MAPID (endpoint *Activities*, 1.750 laporan di Jabodetabek per 9 Sep 2026) melalui backend |
| **Properti Go** (MAPID, wajib) | Peta sebaran usaha/hunian (potensi kawasan) + foto lapangan untuk pembacaan AI | Sampel resmi; API MAPID setelah kurasi |
| **Survey Activities** (MAPID APPS) | Validasi prediksi di lapangan & pengisian area/jam yang belum berdata | Setelah lolos 50 besar, sesuai arahan panitia |
| **Jadwal layanan transit** — GTFS (bila tersedia, mis. TransJakarta via Jakarta Open Data) atau Gapeka/jadwal resmi operator | Perhitungan skor layanan transit per blok waktu | Publik |
| **OpenStreetMap** | Geometri jalur rel & jaringan pejalan kaki (© OSM contributors, ODbL) | Publik, terbuka |
| **Esri World Imagery** | Citra satelit sebagai basemap alternatif | Publik, dengan atribusi |
| **Data naik–turun penumpang** (KAI/operator) — *opsional* | Kalibrasi skor keramaian relatif menjadi angka absolut; sistem menyediakan slot integrasi **tanpa bergantung padanya** | Jika dibagikan operator |

Data mentah MAPID tidak disebarluaskan di luar keperluan kompetisi, dan seluruh data pendukung dicantumkan sumbernya.

## 5.3 Persyaratan Teknis Utama

WebGIS memenuhi ketentuan kompetisi: basemap utama MAPID Maps; peta interaktif dengan zoom, klik objek, filter waktu, dan kontrol lapisan; hasil AI hadir di dalam antarmuka dan dapat dipetakan; responsif desktop–mobile dengan waktu muat wajar (hasil analisis disajikan siap-tampil, bukan dihitung di browser); serta dapat diakses publik pada tahap final tanpa fitur berbayar.

## 5.4 Rencana Pengembangan

| Tahap | Aktivitas | Waktu |
|---|---|---|
| 1 | Heatmap aktivitas per blok waktu + penggeser waktu | ✅ Selesai, sebelum proposal |
| 2 | Analisis kesenjangan layanan + rekomendasi otomatis | ✅ Selesai, sebelum proposal |
| 3 | Finalisasi metode dan penyusunan proposal | Sebelum 2 Agustus |
| 4 | Integrasi API MAPID `[WILAYAH STUDI]`; backend Express + PostGIS; profil jadwal dari GTFS/Gapeka | Pekan 1–2 setelah lolos 50 besar |
| 5 | Pelabelan data & pelatihan model AI (IndoBERT, prediksi keramaian, OCR) + pengukuran akurasi | Setelah lolos 50 besar |
| 6 | Survey activities (validasi lapangan & pengisian area kosong); network analysis QGIS; rilis final | Mengikuti jadwal panitia |

## 5.5 Keterbatasan dan Mitigasi

**Sebaran data Community Maps mengikuti lokasi surveyor, bukan sampel acak** — 1.750 laporan Jabodetabek sudah ditarik dari API MAPID, tetapi terkonsentrasi di kawasan yang disurvei; kawasan tanpa laporan tetap ditampilkan "Tidak Ada Data", dan Struk Go/Menu Go/Properti Go masih berupa sampel Bandung sampai API *Missions* tersambung. **Jam pengambilan data mengikuti jadwal surveyor** — kawasan tanpa pengamatan ditampilkan sebagai "Tidak Ada Data", dibedakan tegas dari "Sepi", dan survey diarahkan ke area serta jam yang kosong. **Prediksi AI tidak selalu benar** — setiap prediksi berlabel "Perkiraan", tampil lebih pudar di peta, divalidasi lewat survei lapangan, dan akurasinya dilaporkan terbuka. **Profil jadwal transit masih perkiraan** — diganti perhitungan langsung dari jadwal resmi (GTFS bila tersedia, atau Gapeka) pada tahap implementasi.

---

## Lampiran kerja (untuk tim — tidak disalin ke proposal)

### Prompt untuk men-generate Gambar 5.1

**Opsi A — paling andal:** kode Mermaid di `ARSITEKTUR.md` §1 → paste ke mermaid.live → ekspor PNG/SVG. (Hapus dulu node "Survey Activities"-nya kalau mau persis dengan bab ini, dan abaikan label GitHub Actions.)

**Opsi B — alat diagram ber-AI (Eraser.io / Napkin):**

```
Buatkan diagram arsitektur perangkat lunak bergaya flat & profesional (untuk proposal),
alur kiri ke kanan, 5 kelompok berlabel:

1. SUMBER DATA (abu-abu): API MAPID (Community Maps, Properti Go, Struk Go, Menu Go);
   Jadwal transit (GTFS / Gapeka); OpenStreetMap (rel & jaringan pejalan kaki);
   Survey Activities (validasi lapangan)

2. PIPELINE TERJADWAL (oranye), 4 langkah berurutan (cukup nama langkahnya saja):
   Pembersihan Data → Pengayaan AI → Analisis Spasial → Rekomendasi

3. BASIS DATA (silinder, biru): PostgreSQL + PostGIS — data mentah, hasil AI,
   hasil analisis ber-versi

4. BACKEND (hijau): Node.js + Express — endpoint GeoJSON (/api/denyut,
   /api/rekomendasi) dan asisten AI dengan tool use (/api/tanya)

5. FRONTEND (biru muda): React + MapLibre GL JS, basemap MAPID Maps,
   hosting Vercel → PENGGUNA (KAI, Dishub, publik)

Panah: semua sumber → langkah 1 pipeline; pipeline berurutan; hasil → basis data;
basis data → backend; backend → frontend; frontend ↔ pengguna; frontend ↔ asisten AI.
Flat, tanpa 3D, font tegas terbaca.
```

**Jangan** pakai generator gambar umum (DALL·E/Midjourney) untuk diagram — teksnya kacau.
