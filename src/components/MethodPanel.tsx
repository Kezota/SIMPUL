import { WEIGHTS, type SimpulModel } from '../lib/engine'
import type { ActivityFeedStatus } from '../lib/mapidApi'

/* ── Panel Metode ─────────────────────────────────────────────────────────── */

export default function MethodPanel({ model, feedStatus }: { model: SimpulModel; feedStatus: ActivityFeedStatus | 'memuat' }) {
  const c = model.counts
  return (
    <div className="panel">
      <p className="block-note dataset-blurb">
        Versi bahasa sederhana: <b>CARA-KERJA.md</b>; alasan tiap angka: <b>PERHITUNGAN.md</b> di repo.
      </p>

      <section className="block">
        <h3>Sumber data yang dipakai</h3>
        <ul className="caveats">
          {model.sources.map((src) => (
            <li key={src}>{src}</li>
          ))}
        </ul>
        {feedStatus === 'snapshot' && (
          <p className="block-note warn">
            Server MAPID tidak terjangkau saat halaman dimuat, jadi dipakai snapshot 9 Sep 2026.
          </p>
        )}
      </section>

      <section className="block">
        <h3>Cara hitungnya, singkat</h3>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <div>
              <b>Laporan warga jadi bukti kegiatan</b>
              <p>
                Tiap laporan Community Maps = satu titik + jam + bobot. Jam dari "pukul …" yang
                ditulis surveyor (kalau tidak ada, jam unggah WIB). Bobot {WEIGHTS.aktivitasRamai}/
                {WEIGHTS.aktivitas}/{WEIGHTS.aktivitasSepi} menurut kata <i>ramai</i> / tanpa
                keterangan / <i>sepi</i> di teksnya — aturan kata kunci yang bisa diaudit, bukan LLM.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">2</span>
            <div>
              <b>Kelompokkan per kawasan per waktu</b>
              <p>Sel heksagon ±500 m (jarak nyaman jalan kaki) × 5 blok waktu (4 jam).</p>
            </div>
          </li>
          <li>
            <span className="step-n">3</span>
            <div>
              <b>"Ramai" = dibandingkan se-wilayah, bukan angka mutlak</b>
              <p>
                Masuk 25% teratas = ramai, 50–75% = sedang, sisanya sepi. Kawasan tanpa laporan ={' '}
                <b>Tidak Ada Data</b> — bukan sepi, dan tidak diperkirakan (sesuai PRD).
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">4</span>
            <div>
              <b>Tabrakkan dengan layanan transit nyata</b>
              <p>
                Skor layanan = faktor jarak (≤1 km penuh, 1–2 km 0,6, &gt;2 km 0) × keberangkatan
                terjadwal pada blok itu ÷ persentil-90 se-wilayah; diambil yang tertinggi antara
                stasiun terdekat dan halte terdekat. Ramai + tidak ada layanan dalam 1 km ={' '}
                <b>tak terjangkau</b>. Ramai + layanan ada tapi skornya &lt;35/100 ={' '}
                <b>frekuensi rendah</b>.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">5</span>
            <div>
              <b>Sel bermasalah yang bersebelahan digabung jadi kandidat</b>
              <p>
                Tiap kantong diberi peringkat dari jumlah sel, jumlah laporan, dan seberapa rendah
                layanannya. Keyakinan: tinggi ≥ 8 laporan di ≥ 2 sel; sedang 3–7; rendah &lt; 3.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="block">
        <h3>Yang jujur kami akui</h3>
        <ul className="caveats">
          <li>
            Data aktivitas: {c.activities.toLocaleString('id-ID')} laporan warga ({c.activitiesRamai}{' '}
            menyebut ramai, {c.activitiesSepi} menyebut sepi; {c.activitiesHourFromText} jamnya dibaca
            dari teks "pukul …"). Struk Go, Menu Go, dan Properti Go belum masuk — menunggu endpoint{' '}
            <i>Missions</i> MAPID.
          </li>
          <li>
            Sebaran laporan mengikuti lokasi surveyor bekerja (sebagian besar Agustus 2026), bukan sampel
            acak se-Jabodetabek. Kawasan tanpa laporan tetap "Tidak Ada Data".
          </li>
          <li>
            Jam yang terekam = jam surveyor bekerja (memuncak 12–17 WIB), jadi blok pagi &amp; larut lebih
            tipis datanya — bukan berarti kotanya sepi.
          </li>
          <li>
            Perjalanan KRL harian dibagi ke blok waktu memakai bobot headway sibuk/non-sibuk (timetable
            per stasiun belum tersedia sebagai data terbuka). Headway GTFS TransJakarta hampir rata
            sepanjang hari, jadi variasi antar-blok untuk bus kecil.
          </li>
          <li>
            Ini bukan ramalan jumlah penumpang. Ini peta "kawasan hidup" vs "layanan ada" — data
            penumpang operator tinggal masuk sebagai pengkalibrasi kalau tersedia.
          </li>
          <li>
            Asisten "Tanya" masih berbasis aturan. Rencana: LLM dengan <i>tool use</i> di backend — model
            memilih alat (ringkasan blok, daftar kandidat, profil kawasan) dan merangkai kalimat, angka
            tetap dari mesin hitung ini.
          </li>
        </ul>
      </section>
    </div>
  )
}
