/**
 * Panduan singkat "Cara pakai" — muncul otomatis pada kunjungan pertama dan
 * bisa dibuka lagi dari tombol ? di topbar. Tujuannya satu: orang yang baru
 * membuka SIMPUL tahu dalam 20 detik apa yang dilihat dan apa yang bisa diklik.
 */

const STEPS = [
  {
    icon: '🔥',
    title: 'Lihat kapan kota hidup',
    body: 'Mode Denyut mewarnai kawasan dari laporan lapangan warga (Community Maps MAPID). Makin pekat = makin banyak kegiatan terekam. Geser blok waktu di bawah peta: pagi, siang, sore, malam, larut.',
  },
  {
    icon: '🚨',
    title: 'Temukan kesenjangan layanan',
    body: 'Mode Kesenjangan hanya mewarnai kawasan yang RAMAI tetapi layanan transitnya kurang: merah = tidak ada stasiun/halte dalam 1 km, oranye = ada tetapi frekuensinya rendah pada blok itu.',
  },
  {
    icon: '📋',
    title: 'Baca kandidatnya',
    body: 'Panel kanan menyusun daftar kandidat berperingkat dari hitungan itu. Klik kartu (atau nomor di peta) untuk terbang ke lokasinya; tiap kartu menyebut bukti, jarak, dan tingkat keyakinannya.',
  },
]

export default function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="guide-backdrop" role="presentation" onClick={onClose}>
      <div
        className="guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="guide-title">Cara pakai SIMPUL</h2>
        <p className="guide-lead">
          Peta ini menjawab dua pertanyaan: <b>kapan sebuah kawasan hidup</b>, dan{' '}
          <b>apakah transportasi massalnya hadir pada jam itu</b>.
        </p>
        <ol className="guide-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="guide-icon" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <b>
                  {i + 1}. {s.title}
                </b>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="guide-tips">
          <span>
            <b>Lapisan peta</b> (kiri atas): nyalakan/matikan halte bus, jalur rel, citra satelit.
          </span>
          <span>
            <b>Klik apa saja</b>: kawasan, stasiun, halte — semuanya punya penjelasan.
          </span>
          <span>
            <b>Tidak ada warna</b> = tidak ada data, bukan sepi. SIMPUL tidak menebak.
          </span>
        </div>
        <button type="button" className="guide-close" onClick={onClose}>
          Mulai jelajahi
        </button>
      </div>
    </div>
  )
}
