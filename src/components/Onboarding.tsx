import { AlertTriangle, ArrowRight, Bot, ClipboardList, Clock, Database, Flame, ListOrdered, MapPinned, X } from 'lucide-react'

import logoImg from '../assets/logo.jpeg'
import type { SimpulModel } from '../lib/engine'
import type { Role } from '../lib/roles'

export type IntroStep = 'tentang' | 'cara'

const STEPS = [
  { Icon: Clock, title: 'Pilih jam', body: 'Tombol blok waktu di bawah peta: pagi, siang, sore, malam, larut. Warna peta ikut berubah.' },
  { Icon: MapPinned, title: 'Lihat yang bermasalah', body: 'Tampilan Kesenjangan hanya mewarnai kawasan ramai yang layanan transitnya kurang. Merah: jauh dari stasiun atau halte. Oranye: ada, tetapi jadwalnya jarang.' },
  { Icon: ListOrdered, title: 'Buka kandidat', body: 'Panel kanan mengurutkan kawasan yang perlu ditindaklanjuti. Nomor kartu sama dengan nomor di peta. Tombol Detail membuka usulan tindakan dan perkiraannya.' },
  { Icon: Bot, title: 'Tanya asisten', body: 'Tab Tanya AI menjawab pertanyaan bahasa biasa, misalnya "kenapa kandidat 1 di atas 2", dan menggerakkan peta ke tempat yang dibahas.' },
]

/** Pengenalan dua langkah: apa itu SIMPUL, lalu cara pakainya. Muncul otomatis pada kunjungan pertama. */
export default function Onboarding({
  step,
  role,
  model,
  onStep,
  onClose,
}: {
  step: IntroStep
  role: Role
  model: SimpulModel
  onStep: (s: IntroStep) => void
  onClose: () => void
}) {
  const n = (v: number) => v.toLocaleString('id-ID')
  return (
    <div className="guide-backdrop" role="presentation" onClick={onClose}>
      <div className={`ob ob-${step}`} role="dialog" aria-modal="true" aria-labelledby="ob-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ob-close" aria-label="Tutup" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="ob-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={step === 'tentang'} className={step === 'tentang' ? 'on' : undefined} onClick={() => onStep('tentang')}>
            Apa itu SIMPUL
          </button>
          <button type="button" role="tab" aria-selected={step === 'cara'} className={step === 'cara' ? 'on' : undefined} onClick={() => onStep('cara')}>
            Cara pakai
          </button>
        </div>

        {step === 'tentang' ? (
          <>
            <div className="ob-hero">
              <img src={logoImg} alt="" className="brand-mark simpul-mark ob-logo" />
              <h2 id="ob-title">Warga sudah ramai. Transitnya sudah sampai belum?</h2>
              <p>SIMPUL menjawabnya dengan dua tampilan peta.</p>
            </div>

            <div className="ob-feats">
              <div className="ob-feat ob-feat-denyut">
                <span className="ob-feat-ico">
                  <Flame size={22} />
                </span>
                <b>Keramaian</b>
                <p>Di mana warga ramai, jam berapa. Dari {n(model.counts.activities)} laporan lapangan warga di Community Maps MAPID, dipetakan per petak 500 m dan per blok waktu.</p>
              </div>
              <div className="ob-feat ob-feat-gap">
                <span className="ob-feat-ico">
                  <AlertTriangle size={22} />
                </span>
                <b>Kesenjangan</b>
                <p>Kawasan ramai yang transitnya belum sampai: jauh dari stasiun atau halte, atau jadwalnya jarang. Jadi daftar kandidat berperingkat dengan usulan tindakan.</p>
              </div>
            </div>

            <p className="ob-foot">
              <Database size={14} /> Peta dan laporan warga dari MAPID. {model.nodes.length} stasiun dari OpenStreetMap dengan jadwal Gapeka dan operator, {n(model.stops.length)} halte dari GTFS TransJakarta.
            </p>

            <div className="ob-actions">
              <button type="button" className="btn ghost" onClick={() => onStep('cara')}>
                Lihat cara pakai
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Mulai jelajah <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="ob-title" className="ob-h2">
              Cara pakai
            </h2>
            <p className="guide-lead">
              Anda masuk sebagai <b>{role.label}</b>. {role.focus}
            </p>
            <ol className="ob-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="ob-step-ico">
                    <s.Icon size={18} />
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
            <p className="guide-foot">
              <ClipboardList size={14} /> Petak tanpa warna berarti belum ada laporan, bukan sepi. Tombol kecil "i" di sebelah angka menjelaskan dari mana angka itu.
            </p>
            <div className="ob-actions">
              <button type="button" className="btn ghost" onClick={() => onStep('tentang')}>
                Apa itu SIMPUL
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Mulai <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
