import { useEffect, useState } from 'react'

import { WEIGHTS, type SimpulModel } from '../lib/engine'
import type { ActivityFeedStatus } from '../lib/mapidApi'

/* ── Panel Metode: versi singkat di panel, versi lengkap di jendela ─────── */

export default function MethodPanel({ model, feedStatus }: { model: SimpulModel; feedStatus: ActivityFeedStatus | 'memuat' }) {
  const c = model.counts
  const [open, setOpen] = useState(false)
  const n = (v: number) => v.toLocaleString('id-ID')

  return (
    <div className="panel mt">
      <section className="mt-card">
        <h3>Dari mana datanya</h3>
        <ul className="mt-list">
          <li>
            <b>{n(c.activities)} laporan warga</b> dari Community Maps MAPID{feedStatus === 'snapshot' ? ' (salinan 9 Sep 2026, server tidak terjangkau saat dimuat)' : feedStatus === 'live' ? ' (langsung dari server)' : ''}.
          </li>
          <li>
            <b>{model.nodes.length} stasiun</b> KRL, MRT, dan LRT beserta jalurnya dari OpenStreetMap.
          </li>
          <li>
            <b>{n(model.stops.length)} halte</b> TransJakarta dan JakLingko beserta jadwalnya dari GTFS resmi TransJakarta.
          </li>
          <li>Jumlah perjalanan kereta per hari dari Gapeka 2025 (KAI Commuter) dan jadwal resmi MRT/LRT.</li>
        </ul>
      </section>

      <section className="mt-card">
        <h3>Cara menghitungnya</h3>
        <ol className="mt-steps">
          <li>Tiap laporan warga jadi satu titik kegiatan, dengan jam dari teks laporan (kalau ada) dan bobot lebih besar bila warga menulis "ramai".</li>
          <li>Titik dikelompokkan ke petak seluas 500 m dan ke lima blok waktu.</li>
          <li>Petak yang masuk seperempat teratas se-Jabodetabek pada jam itu disebut ramai. Petak tanpa laporan tidak ditebak.</li>
          <li>Tiap petak dinilai layanannya: ada stasiun atau halte dalam 1 km, dan seberapa sering layanan itu berangkat pada jam tersebut.</li>
          <li>Petak ramai yang layanannya kurang digabung dengan tetangganya menjadi kandidat, lalu diurutkan dari bukti terkuat.</li>
        </ol>
      </section>

      <section className="mt-card">
        <h3>Yang perlu diketahui</h3>
        <ul className="mt-list">
          <li>Laporan mengikuti tempat surveyor bekerja, bukan sampel acak. Kawasan tanpa laporan bukan berarti sepi.</li>
          <li>Jam surveyor bekerja memuncak siang sampai sore, jadi blok pagi dan larut datanya lebih tipis.</li>
          <li>Ini bukan ramalan jumlah penumpang. Ini peta "kawasan hidup" dibanding "layanan ada".</li>
        </ul>
        <button type="button" className="btn small ghost mt-more" onClick={() => setOpen(true)}>
          Baca selengkapnya, termasuk semua asumsi
        </button>
      </section>

      {open && <MethodDetail model={model} onClose={() => setOpen(false)} />}
    </div>
  )
}

function MethodDetail({ model, onClose }: { model: SimpulModel; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const c = model.counts
  const n = (v: number) => v.toLocaleString('id-ID')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal rd mt-modal" role="dialog" aria-modal="true" aria-labelledby="mt-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Tutup" onClick={onClose}>
          ×
        </button>
        <h2 id="mt-title">Metode, data, dan asumsi</h2>
        <p className="mt-lead">Semua angka di SIMPUL dihitung dengan aturan terbuka di bawah ini. Asisten AI hanya merangkai kalimat; ia tidak menghitung apa pun.</p>

        <section className="rd-card">
          <h3>Sumber data</h3>
          <ul className="mt-list">
            {model.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="rd-card">
          <h3>Laporan warga</h3>
          <ul className="mt-list">
            <li>
              {n(c.activities)} laporan dipakai. {n(c.activitiesRamai)} di antaranya menulis kata seperti ramai, padat, atau antre; {n(c.activitiesSepi)} menulis sepi atau lengang. Pembacaannya memakai daftar kata, bukan AI, jadi bisa diperiksa siapa pun.
            </li>
            <li>
              Jam kejadian diambil dari teks laporan ("pukul 15.30") untuk {n(c.activitiesHourFromText)} laporan. Sisanya memakai jam unggah (WIB), yang bisa beberapa jam setelah kejadian.
            </li>
            <li>
              Bobot: laporan biasa {WEIGHTS.aktivitas}, menyebut ramai {WEIGHTS.aktivitasRamai}, menyebut sepi {WEIGHTS.aktivitasSepi}. Laporan tanpa jam dibagi rata ke lima blok.
            </li>
            <li>Data Struk Go, Menu Go, dan Properti Go belum dipakai karena endpoint-nya belum tersedia untuk kompetisi.</li>
          </ul>
        </section>

        <section className="rd-card">
          <h3>Petak, blok waktu, dan kelas ramai</h3>
          <ul className="mt-list">
            <li>Petak heksagon selebar kira-kira 500 m, jarak yang nyaman untuk jalan kaki.</li>
            <li>Lima blok waktu: pagi 06.00 sampai 10.00, siang 10.00 sampai 14.00, sore 14.00 sampai 18.00, malam 18.00 sampai 22.00, larut 22.00 sampai 06.00. Blok, bukan jam, karena datanya masih tipis.</li>
            <li>Ramai berarti masuk 25% teratas dari semua petak berdata pada blok itu; sedang 50 sampai 75%; sisanya cenderung sepi. Semuanya relatif se-Jabodetabek.</li>
          </ul>
        </section>

        <section className="rd-card">
          <h3>Skor layanan</h3>
          <ul className="mt-list">
            <li>Untuk tiap petak dicari stasiun terdekat dan halte terdekat. Dalam 1 km dihitung penuh; 1 sampai 2 km dihitung 60%; lebih dari 2 km dihitung nol.</li>
            <li>Keberangkatan pada blok itu dibandingkan dengan simpul tersibuk se-wilayah (persentil 90). Skor tertinggi antara kereta dan bus yang dipakai.</li>
            <li>Di bawah 35 dari 100 disebut tipis. Ramai dan tipis tanpa layanan dalam 1 km = tak terjangkau; ramai dan tipis tetapi ada layanan = frekuensi rendah.</li>
            <li>Keramaian tingkat sedang dengan layanan tipis tidak jadi prioritas, tetapi masuk daftar "perlu dipantau".</li>
          </ul>
        </section>

        <section className="rd-card">
          <h3>Kandidat, peringkat, dan keyakinan</h3>
          <ul className="mt-list">
            <li>Petak bermasalah yang bersebelahan digabung jadi satu kandidat. Prioritas paling banyak 12, perlu dipantau paling banyak 10.</li>
            <li>Urutan dari bukti terkuat: jumlah petak, jumlah laporan, dan seberapa tipis layanannya. Kawasan tak terjangkau diberi bobot lebih besar. Ini bukan urutan biaya.</li>
            <li>Keyakinan tinggi: 8 laporan atau lebih di 2 petak bersebelahan. Sedang: 3 sampai 7. Rendah: kurang dari 3.</li>
          </ul>
        </section>

        <section className="rd-card">
          <h3>Asumsi di balik usulan tindakan</h3>
          <ul className="mt-list">
            <li>Target layanan yang wajar untuk kawasan ramai: 60% dari simpul tersibuk pada blok yang sama.</li>
            <li>Perjalanan KRL per hari dibagi ke blok waktu memakai jeda jam sibuk dan non-sibuk tiap lintas, karena jadwal per stasiun belum tersedia sebagai data terbuka. Jadwal TransJakarta memakai hari kerja dari GTFS.</li>
            <li>Satu perjalanan pulang pergi dianggap 120 menit untuk kereta dan 90 menit untuk bus koridor. Rute pengumpan dianggap berjalan 15 km/jam dengan 10 menit istirahat dan bus tiap 15 menit.</li>
            <li>Angka armada dan keberangkatan hanya untuk membuka pembicaraan. Kapasitas, biaya, dan slot jalur tidak dihitung.</li>
            <li>Jumlah penumpang naik turun per stasiun atau halte tidak tersedia sebagai data terbuka, jadi tidak dipakai.</li>
          </ul>
        </section>

        <section className="rd-card">
          <h3>Asisten dan pencarian</h3>
          <ul className="mt-list">
            <li>Pertanyaan rutin dijawab langsung dari hitungan. Pertanyaan bebas dikirim ke Gemini, yang hanya boleh memilih alat dan merangkai kalimat. Kalau Gemini tidak bisa dihubungi, jawaban disusun dari hitungan langsung.</li>
            <li>Pencarian nama stasiun, halte, dan kandidat dilakukan di browser. Nama tempat lain dicari lewat Nominatim (OpenStreetMap), dibatasi Jabodetabek.</li>
          </ul>
        </section>

        <div className="rd-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
