# ARSITEKTUR.md — Rancangan Implementasi SIMPUL

> Arsitektur untuk **tahap implementasi penuh** (setelah lolos 50 besar, saat data API MAPID terbuka). Diagram ditulis dengan Mermaid — GitHub me-render-nya otomatis; bisa juga di-paste ke mermaid.live atau FigJam untuk diekspor jadi gambar proposal.
>
> Prinsip besarnya satu: **kerja berat dilakukan di belakang secara berkala (batch), browser hanya menampilkan hasil jadi.** Ini yang membuat WebGIS-nya tetap ringan (syarat lomba: loading wajar) walau datanya membesar.

---

## 1. Gambaran besar

```mermaid
flowchart LR
  subgraph SUMBER["📥 Sumber Data"]
    A1["API MAPID<br/>(Community, Properti Go,<br/>Struk Go, Menu Go)"]
    A2["Jadwal transit<br/>GTFS TransJakarta (resmi) ·<br/>Gapeka KRL · headway MRT/LRT"]
    A3["OpenStreetMap<br/>(stasiun & lintas, rel, jaringan pejalan kaki)"]
    A4["Survey Activities<br/>(MAPID APPS, validasi lapangan)"]
  end

  subgraph PIPELINE["⚙️ Pipeline Batch — jalan terjadwal, bukan tiap pengguna buka web"]
    B1["1. Tarik & bersihkan data<br/>(cleaning, dedupe, validasi koordinat)"]
    B2["2. Pengayaan AI offline<br/>· LLM: klasifikasi teks laporan warga<br/>· Vision: baca foto (akses, kondisi)<br/>· OCR: nominal struk"]
    B3["3. Mesin analisis<br/>(sel heksagon × blok waktu,<br/>persentil, skor layanan, gap)"]
    B4["4. Penyusun rekomendasi<br/>(aturan deterministik)"]
  end

  subgraph SIMPAN["🗄️ Basis Data"]
    C1[("PostgreSQL + PostGIS<br/>data mentah · hasil AI ·<br/>sel heksagon & rekomendasi terhitung")]
  end

  subgraph BE["🔧 Backend API — Node.js + Express"]
    D2["GET /api/denyut, /api/gap,<br/>/api/rekomendasi (GeoJSON dari PostGIS)"]
    D3["POST /api/tanya — asisten LLM<br/>dengan tool use (kunci API di server)"]
  end

  subgraph SAJI["🌐 Frontend"]
    D1["React + MapLibre<br/>basemap MAPID MAPS<br/>(Vercel)"]
  end

  E1["👤 Pengguna<br/>(KAI, Dishub, publik)"]

  A1 --> B1
  A2 --> B1
  A3 --> B1
  A4 --> B1
  B1 --> B2 --> B3 --> B4
  B4 --> C1
  B1 --> C1
  B2 --> C1
  C1 --> D2
  C1 --> D3
  D2 --> D1
  D3 <--> D1
  D1 <--> E1
```

Tiga zona, tiga ritme:

| Zona | Jalan kapan | Teknologi |
|---|---|---|
| **Pipeline batch** | Terjadwal (mis. tiap malam / tiap data baru masuk) via cron | Skrip Node.js/Python |
| **Basis data** | Diperbarui tiap pipeline selesai | PostgreSQL + PostGIS (Neon/Supabase, gratis) |
| **Backend API** | Real-time, melayani frontend | Node.js + Express (Railway/Render) |
| **Frontend** | Real-time saat pengguna membuka web | React + MapLibre di Vercel |

---

## 2. Kenapa dipisah begini (alasan yang bisa dipakai jawab juri)

**Kenapa AI-nya offline/batch, bukan tiap kali web dibuka?**
Membaca 1.000+ foto dan mengklasifikasi ribuan teks itu mahal dan lambat. Dilakukan **sekali per pembaruan data**, hasilnya disimpan sebagai kolom baru. Pengguna tidak pernah menunggu AI — mereka menerima hasil yang sudah jadi dan sudah divalidasi. Bonus: hasil AI bisa diaudit dulu sebelum tayang.

**Kenapa PostGIS, bukan sekadar file?**
Tiga alasan. (1) Data tumbuh terus dari API + survey — butuh satu sumber kebenaran yang bisa di-query, bukan tumpukan file. (2) PostGIS punya operasi spasial bawaan yang persis dipakai SIMPUL: `ST_HexagonGrid` (pembentukan sel heksagon langsung di SQL), `ST_DWithin` (cari titik dalam radius), operator `<->` (tetangga terdekat / simpul terdekat). Artinya sebagian mesin analisis bisa dieksekusi di database — cepat dan standar industri. (3) Riwayat tersimpan: hasil hitungan tiap siklus bisa dibandingkan antarwaktu.

**Kenapa backend Express, dan apa kerjanya?**
Backend bukan tempelan — dia punya tiga tugas nyata: (1) menyajikan hasil hitungan dari PostGIS ke frontend sebagai GeoJSON (`/api/denyut?blok=malam`, `/api/gap`, `/api/rekomendasi`); (2) menjadi rumah asisten AI — kunci API LLM tinggal di server, dan jawaban model **dipaksa lewat tool use** (model hanya boleh memanggil fungsi seperti `getNodeStats()` lalu merangkai kalimat dari hasilnya — tidak pernah menulis angka sendiri); (3) endpoint untuk memicu/memantau pipeline. Respons publik di-cache sehingga beban tetap ringan dan loading tetap wajar.

---

## 3. Detail pipeline batch

```mermaid
sequenceDiagram
  autonumber
  participant CRON as GitHub Actions (cron)
  participant API as API MAPID
  participant ETL as Skrip Cleaning
  participant AI as LLM / Vision / OCR
  participant ENG as Mesin Analisis
  participant DB as PostGIS
  participant BE as Backend Express
  participant WEB as Frontend (Vercel)

  CRON->>API: tarik data terbaru (4 dataset)
  API-->>ETL: GeoJSON mentah
  ETL->>ETL: bersihkan: tipe, dedupe (ID resmi), bbox, kolom kosong
  ETL->>AI: baris BARU saja (yang belum pernah diproses)
  AI-->>ETL: kolom tambahan: tema teks, label akses dari foto,<br/>nominal struk (OCR) + skor keyakinan
  ETL->>ENG: data bersih + hasil AI
  ENG->>ENG: sel heksagon × blok waktu → persentil →<br/>skor layanan (GTFS/Gapeka) → gap → kandidat
  ENG->>DB: simpan hasil: sel×blok, gap, rekomendasi (ber-versi, ada tanggal)
  BE->>DB: query saat frontend meminta
  BE->>WEB: GeoJSON siap-tampil — pengguna dapat data baru
```

Catatan penting per langkah:

- **Langkah 4 (hemat biaya):** AI hanya memproses **baris baru** — hasil lama di-cache. Biaya LLM tidak membengkak seiring data tumbuh.
- **Langkah 5 (kejujuran):** setiap hasil AI membawa skor keyakinan + kelas "tidak ternilai". Sampel acak divalidasi manusia tiap siklus; angka akurasinya ikut disimpan di artefak dan **ditampilkan di tab Metode**.
- **Langkah 7 (dapat diaudit):** hasil tiap siklus ber-versi di database — kalau ada angka aneh di web, bisa dirunut ke pipeline run yang mana, data masuk yang mana.

---

## 4. Alur asisten AI (satu-satunya jalur real-time)

```mermaid
sequenceDiagram
  autonumber
  participant U as Pengguna
  participant FE as Frontend
  participant FN as Backend /api/tanya
  participant LLM as LLM
  participant M as PostGIS (hasil hitungan)

  U->>FE: "kawasan mana yang masih hidup setelah kereta terakhir?"
  FE->>FN: pertanyaan + konteks blok aktif
  FN->>LLM: pertanyaan + daftar tool
  LLM->>FN: panggil tool: cariSelRamai(blok="malam", layananRendah=true)
  FN->>M: eksekusi query terhadap hasil hitungan
  M-->>FN: 15 sel, 14 ber-gap, koordinat teratas
  FN->>LLM: hasil tool (angka asli)
  LLM-->>FN: kalimat jawaban (dirangkai DARI hasil tool)
  FN-->>FE: jawaban + aksi peta (pindah blok, fly-to) + jejak nalar
  FE-->>U: jawaban tampil, peta ikut bergerak
```

Kontrak kuncinya: **LLM tidak pernah diberi izin menulis angka bebas** — dia hanya boleh memanggil tool dan merangkai kalimat dari nilai yang dikembalikan. Prototipe sekarang sudah memakai kontrak yang sama (versi rule-based), jadi migrasinya cuma mengganti isi satu fungsi.

---

## 5. Peta migrasi: prototipe sekarang → implementasi penuh

| Komponen | Prototipe (sudah jalan) | Implementasi penuh | Effort |
|---|---|---|---|
| Sumber data | File sample statis di repo | API MAPID via pipeline | Kecil — adapter per dataset sudah ada |
| Cleaning | `engine.ts` di browser | Pindah ke skrip pipeline (logika sama, TypeScript bisa dipakai ulang langsung) | Kecil |
| Klasifikasi teks | Leksikon (rule-based) | LLM batch + validasi sampel | Sedang |
| Baca foto | 3 label manual (bukti konsep) | Vision model batch atas ribuan foto | Sedang–besar |
| Mesin analisis (hex, blok, persentil, gap) | `engine.ts` + `recommend.ts` | **Dipakai ulang apa adanya** di pipeline | Nol |
| Profil jadwal | ✅ Sudah dari GTFS TransJakarta + Gapeka per lintas (prototipe) | Timetable per stasiun KRL bila tersedia | Kecil |
| Asisten | Rule-based di browser | LLM + tool use di backend Express | Sedang |
| Penyimpanan | JSON statis di repo | PostgreSQL + PostGIS (Neon/Supabase) | Sedang |
| Backend | — | Node.js + Express: endpoint GeoJSON + asisten + cache | Sedang |
| Peta & UI | React + MapLibre | **Sama** — tinggal ganti sumber ke API backend + basemap MAPID MAPS | Nol–kecil |
| Hosting | Lokal | Vercel (frontend) + Railway/Render (backend) + Neon/Supabase (DB) + GitHub Actions (pipeline) — semua free tier | Kecil |

Poin jual ke juri: **mesin analisisnya tidak dibuang** — yang berubah hanya di mana dia dijalankan dan dari mana datanya. Prototipe ini bukan mockup; dia komponen produksi yang dipindah tempat.

---

## 6. Teknologi per komponen (buat Lampiran Assessment Tim)

| Komponen | Pilihan | Kenapa |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Sudah jalan; ekosistem luas |
| Peta | MapLibre GL JS | Open source; kompatibel basemap MAPID MAPS |
| Pipeline | Node.js (pakai ulang engine TS) atau Python (kalau tim lebih nyaman untuk bagian AI) | Logika inti sudah ada dalam TS |
| AI teks & foto | LLM multimodal via API, batch | Sekali per siklus, murah, hasil di-cache & divalidasi |
| Analisis spasial berat (network analysis pejalan kaki) | QGIS (offline) → hasil diekspor GeoJSON ke pipeline | Sesuai anjuran panitia soal tools open-source |
| Backend | Node.js + Express | Endpoint GeoJSON, asisten AI (kunci API aman di server), cache |
| Database geospasial | PostgreSQL + PostGIS (Neon/Supabase) | ST_HexagonGrid, ST_DWithin, KNN — analisis spasial standar industri; free tier |
| Penjadwal | GitHub Actions cron | Gratis, log-nya publik & bisa diaudit |
| Deploy | Vercel, publik | Syarat final lomba |

---

## 7. Hal yang sengaja TIDAK ada di arsitektur ini

1. **Tidak ada AI real-time di jalur data** — AI yang menyentuh data selalu batch + tervalidasi. Satu-satunya AI real-time adalah asisten, dan dia dikurung tool use.
2. **Tidak ada microservices** — satu backend Express monolitik cukup untuk skala lomba. Kompleksitas harus dibayar oleh kebutuhan, bukan gengsi.
3. **Frontend tidak pernah menyentuh database langsung** — semua lewat API backend, dengan cache untuk endpoint publik. Kalau backend sedang dingin (free tier), frontend memakai salinan hasil hitungan terakhir yang ikut ter-deploy — web tetap hidup saat dinilai juri.
