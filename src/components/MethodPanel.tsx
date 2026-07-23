import { REGION_LABEL } from '../data/transitNodes'
import type { DatasetDef } from '../lib/types'

const STEPS = [
  {
    n: '1',
    title: 'Identifikasi data awal',
    body: 'Empat dataset panitia, skemanya berbeda-beda: Community Maps (teks bebas + media), Menu Go (survei tempat makan), Struk Go (bukti transaksi), Properti Go (listing properti). Dipilih satu yang aktif, tidak digabung.',
  },
  {
    n: '2',
    title: 'Adapter & standardisasi',
    body: 'Tiap dataset punya adapter yang menormalkannya jadi satu bentuk `Observation`: lokasi, judul, kategori, foto, plus kolom khas dataset (harga, waktu, alamat). Karena bentuknya seragam, satu mesin analisis melayani keempatnya tanpa percabangan.',
  },
  {
    n: '3',
    title: 'Cleaning',
    body: 'Konversi tipe (lat/long string → number), validasi koordinat terhadap bbox Indonesia, dedupe pakai ID resmi kalau ada, buang kolom yang kosong seluruhnya, normalisasi nilai kategorikal yang tersimpan sebagai kalimat panjang. Detailnya berbeda per dataset — lihat catatan di bawah.',
  },
  {
    n: '4',
    title: 'Pengolahan teks (AI)',
    body: 'Hanya Community Maps yang butuh klasifikasi tema, karena tiga dataset lain sudah punya kolom kategori. Untuk semua dataset, teks bebasnya tetap dipindai untuk tag dan indikasi harga.',
  },
  {
    n: '5',
    title: 'Data pendukung',
    body: '17 simpul transportasi massal di dua wilayah: Bandung Raya (11) dan koridor KRL Depok (6). Simpul yang dipakai mengikuti wilayah dataset aktif. Koordinatnya masih perkiraan manual.',
  },
  {
    n: '6',
    title: 'Analisis spasial',
    body: 'Nearest-neighbour join tiap titik ke simpul terdekat (haversine) — sekaligus membentuk catchment ala Voronoi; klasifikasi keterjangkauan pada ambang 500 m / 1 km / 2 km; buffer geodesik radius layanan; deteksi blank spot (>2 km dari simpul mana pun).',
  },
  {
    n: '7',
    title: 'Indexing',
    body: 'Indeks Denyut Transit per simpul (0–100) = 40% volume berbobot jarak Σ exp(−d/1500) + 30% rata-rata relevansi kategori + 30% rata-rata kelengkapan bukti visual. Buffer 1 km kaku sempat dipakai tapi membuat sebagian besar simpul bernilai 0 — peluruhan jarak dipilih supaya indeksnya informatif tanpa memalsukan kedekatan.',
  },
  {
    n: '8',
    title: 'Insight, rekomendasi, WebGIS',
    body: 'Angka level kota, peringkat simpul, dan rekomendasi bertarget stakeholder yang disusun dari kondisi data. Semuanya masuk ke peta interaktif + tabel atribut + grafik + asisten spasial yang mengubah pertanyaan bahasa alami jadi filter peta.',
  },
]

const CAVEATS = [
  'Basemap masih CARTO/OSM. Kompetisi mewajibkan MAPID MAPS — slot env `VITE_MAPID_STYLE_URL` sudah disiapkan, tinggal diisi.',
  'Klasifikasi tema dan asisten AI masih rule-based (deterministik), belum LLM. Kontrak fungsinya sudah dibuat supaya bisa ditukar tanpa mengubah UI.',
  'Koordinat 17 simpul transit adalah perkiraan manual, bukan data resmi.',
  'Tiga dari empat dataset hanya berisi 15–25 baris. Semua angka sah secara perhitungan tapi lemah secara statistik — ini prototipe metode, bukan temuan final.',
  'Belum ada network analysis berbasis jaringan jalan; jarak masih garis lurus (haversine), jadi cenderung optimistis.',
  'Foto belum dianalisis sama sekali, padahal itu aset terbesar keempat dataset ini.',
]

export default function MethodPanel({
  dataset,
  notes,
  dropped,
}: {
  dataset: DatasetDef
  notes: string[]
  dropped: number
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Metodologi</h2>
      </div>

      <section className="block">
        <h3>Dataset aktif: {dataset.label}</h3>
        <dl className="kv">
          <dt>Sumber</dt>
          <dd>{dataset.source}</dd>
          <dt>Wilayah</dt>
          <dd>{REGION_LABEL[dataset.region]}</dd>
          <dt>Kategori</dt>
          <dd>
            {dataset.categorySource === 'ai'
              ? 'Hasil klasifikasi AI (tidak ada di data mentah)'
              : 'Kolom asli data panitia'}
          </dd>
          <dt>Baris dibuang</dt>
          <dd>{dropped}</dd>
        </dl>
        <p className="ai-summary">
          <b>Peran AI di dataset ini:</b> {dataset.aiRole}
        </p>
      </section>

      <section className="block">
        <h3>Catatan cleaning untuk {dataset.label}</h3>
        <ul className="caveats">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h3>Alur pengolahan data</h3>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="step-n">{s.n}</span>
              <div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="block">
        <h3>Batasan yang perlu diakui</h3>
        <ul className="caveats">
          {CAVEATS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h3>Sumber data</h3>
        <dl className="kv">
          <dt>Data dasar</dt>
          <dd>Community Maps, Menu Go, Struk Go, Properti Go — MAPID WebGIS Competition 2026</dd>
          <dt>Data pendukung</dt>
          <dd>Titik simpul transit (perkiraan manual; rencana: OpenStreetMap / BIG / KAI)</dd>
          <dt>Basemap</dt>
          <dd>CARTO + OpenStreetMap (sementara) → MAPID MAPS</dd>
        </dl>
      </section>
    </div>
  )
}
