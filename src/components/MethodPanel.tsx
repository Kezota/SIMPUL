const STEPS = [
  {
    n: '1',
    title: 'Data mentah',
    body: 'Community Maps (activity) dari MAPID — 25 titik sampel di Bandung Raya. Kolom apa adanya: title, description, latitude, longitude, medias/images/videos. Tidak ada satu pun kolom kategori.',
  },
  {
    n: '2',
    title: 'Cleaning & standardisasi',
    body: 'latitude/longitude datang sebagai string → dikonversi ke number; koordinat Z yang selalu 0 dibuang; baris tanpa koordinat valid atau di luar bbox Indonesia dibuang; duplikat (judul + koordinat sama) dibuang; images/videos dinormalkan jadi array.',
  },
  {
    n: '3',
    title: 'Pengolahan data tidak terstruktur (AI/NLP)',
    body: 'Teks judul + deskripsi diklasifikasikan ke 6 tema lewat leksikon berbobot, plus ekstraksi hashtag, deteksi nada laporan (keluhan/netral/apresiasi), dan ekstraksi indikasi harga ("44rb", "Rp25.000"). Ini yang mengubah teks bebas jadi kolom yang bisa difilter dan diagregasi.',
  },
  {
    n: '4',
    title: 'Data pendukung',
    body: '10 simpul transportasi massal (stasiun KA, terminal bus, stasiun kereta cepat) di koridor Bandung–Padalarang. Di prototipe ini koordinatnya masih diketik manual sebagai perkiraan — versi kompetisi memakai OSM/BIG/KAI dengan sumber dicantumkan.',
  },
  {
    n: '5',
    title: 'Analisis spasial',
    body: 'Nearest-neighbour join tiap aktivitas ke simpul terdekat (haversine) — sekaligus membentuk catchment ala Voronoi; klasifikasi keterjangkauan pada ambang 500 m / 1 km / 2 km; buffer geodesik radius layanan untuk visual; deteksi blank spot (>2 km dari simpul mana pun).',
  },
  {
    n: '6',
    title: 'Indexing',
    body: 'Indeks Denyut Transit per simpul (0–100) = 40% volume berbobot jarak Σ exp(−d/1500) + 30% rata-rata relevansi tema + 30% rata-rata kelengkapan bukti visual. Buffer 1 km kaku sempat dipakai tapi membuat 8 dari 10 simpul bernilai 0 — peluruhan jarak dipilih supaya indeksnya informatif tanpa memalsukan kedekatan.',
  },
  {
    n: '7',
    title: 'Insight & rekomendasi',
    body: 'Angka level kota (rasio walkable, jarak median, rasio keluhan), peringkat simpul, dan rekomendasi bertarget stakeholder yang disusun dari kondisi data — bukan teks statis.',
  },
  {
    n: '8',
    title: 'Integrasi WebGIS',
    body: 'Peta interaktif (zoom, klik objek, layer control, popup) + tabel atribut + grafik + asisten spasial yang mengubah pertanyaan bahasa alami jadi filter peta.',
  },
]

const CAVEATS = [
  'Basemap masih CARTO/OSM. Kompetisi mewajibkan MAPID MAPS — sudah disiapkan slot env `VITE_MAPID_STYLE_URL`, tinggal diisi.',
  'Klasifikasi tema dan asisten AI masih rule-based (deterministik), belum LLM. Kontrak fungsinya sudah dibuat supaya bisa ditukar tanpa mengubah UI.',
  'Koordinat simpul transit adalah perkiraan manual, bukan data resmi.',
  'n = 25 titik. Semua angka di panel Insight sah secara perhitungan tapi lemah secara statistik — ini prototipe metode, bukan temuan final.',
  'Belum ada network analysis berbasis jaringan jalan; jarak yang dipakai masih garis lurus (haversine), jadi cenderung optimistis.',
]

export default function MethodPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Metodologi</h2>
      </div>

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
          <dd>Community Maps (activity) — MAPID WebGIS Competition 2026</dd>
          <dt>Data pendukung</dt>
          <dd>Titik simpul transit (perkiraan manual; rencana: OpenStreetMap / BIG)</dd>
          <dt>Basemap</dt>
          <dd>CARTO + OpenStreetMap (sementara) → MAPID MAPS</dd>
        </dl>
      </section>
    </div>
  )
}
