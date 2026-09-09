import type { Role } from '../lib/roles'

/**
 * Panduan singkat "Cara pakai" — muncul otomatis pada kunjungan pertama dan
 * bisa dibuka lagi dari tombol ? di topbar. Tujuannya satu: orang yang baru
 * membuka SIMPUL tahu dalam 20 detik apa yang dilihat dan apa yang bisa diklik.
 */

const STEPS = [
  {
    icon: '🕒',
    title: 'Pilih blok waktu',
    body: 'Geser penggeser di bawah peta: pagi, siang, sore, malam, larut. Warna peta menunjukkan seberapa ramai kawasan menurut laporan lapangan warga pada jam itu.',
  },
  {
    icon: '⚠️',
    title: 'Lihat kesenjangan layanan',
    body: 'Tampilan "Kesenjangan" hanya mewarnai kawasan RAMAI yang layanan transitnya kurang: merah = tidak ada stasiun/halte dalam 1 km, oranye = ada tetapi jadwalnya tipis.',
  },
  {
    icon: '📋',
    title: 'Tinjau kandidat',
    body: 'Panel kanan menyusun daftar kandidat berperingkat. Nomor kartu = nomor di peta. Tiap kartu menyebut bukti, jarak, keyakinan, dan rumus peringkatnya.',
  },
  {
    icon: '💬',
    title: 'Tanya asisten',
    body: 'Tab "Tanya AI": tanyakan dalam bahasa biasa, misalnya "kenapa kandidat 1 di atas 2". Asisten mengambil angka dari hitungan yang sama dan menggerakkan peta.',
  },
]

export default function Guide({ role, onClose }: { role: Role; onClose: () => void }) {
  return (
    <div className="guide-backdrop" role="presentation" onClick={onClose}>
      <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="guide-title">Cara pakai SIMPUL</h2>
        <p className="guide-lead">
          Anda masuk sebagai <b>{role.label}</b>. {role.focus}
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
            <b>Cari lokasi</b> (kotak di atas peta): nama stasiun, halte, kelurahan, atau nomor kandidat.
          </span>
          <span>
            <b>Klik apa saja</b> di peta: kawasan, stasiun, halte — semuanya punya penjelasan.
          </span>
          <span>
            <b>Tanpa warna</b> = tidak ada data, bukan sepi. SIMPUL tidak menebak.
          </span>
        </div>
        <button type="button" className="guide-close" onClick={onClose}>
          Mulai
        </button>
      </div>
    </div>
  )
}
