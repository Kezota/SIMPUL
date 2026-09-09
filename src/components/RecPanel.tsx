import { useEffect, useRef } from 'react'

import { summarizeBlocks, type SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'
import { BarList } from './BarList'
import type { MapMode } from './MapView'

const blockMeta = (id: BlockId) => TIME_BLOCKS.find((b) => b.id === id)!

const KIND_LABEL = { jangkauan: 'Tak terjangkau', jadwal: 'Frekuensi rendah' } as const
const CONF_HINT = {
  tinggi: '≥ 8 laporan di ≥ 2 sel bersebelahan',
  sedang: '3–7 laporan',
  rendah: 'kurang dari 3 laporan — perlu survei lanjutan',
} as const

/* ── Panel Kandidat (default) ─────────────────────────────────────────────── */

export default function RecPanel({
  model,
  recs,
  block,
  mode,
  loading,
  activeRecId,
  onSetBlock,
  onFocus,
  onShowGap,
}: {
  model: SimpulModel
  recs: Recommendation[]
  block: BlockId
  mode: MapMode
  loading: boolean
  activeRecId: string | null
  onSetBlock: (b: BlockId) => void
  onFocus: (r: Recommendation) => void
  onShowGap: () => void
}) {
  const summaries = summarizeBlocks(model)
  const listRef = useRef<HTMLUListElement>(null)

  // Marker bernomor di peta diklik → kartunya ikut tersorot dan digulir masuk.
  useEffect(() => {
    if (!activeRecId || !listRef.current) return
    listRef.current
      .querySelector(`[data-rec="${activeRecId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeRecId])

  return (
    <div className="panel">
      <section className="block">
        <h3>Kapan kota ini hidup?</h3>
        <p className="block-note">
          Poin kegiatan yang terekam per blok waktu — klik untuk memindahkan peta ke blok itu.
        </p>
        {loading ? (
          <p className="skeleton-line">Memuat laporan warga dari MAPID…</p>
        ) : (
          <BarList
            data={summaries.map((s) => ({
              label: `${blockMeta(s.block).label} ${blockMeta(s.block).range}`,
              value: Math.round(s.totalPoints),
              color: s.block === block ? '#0ea5e9' : '#cbd5e1',
              active: s.block === block,
              onClick: () => onSetBlock(s.block),
            }))}
          />
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <h3>Kandidat yang perlu ditindaklanjuti</h3>
          <span className="count-pill">{recs.length}</span>
        </div>
        <p className="block-note">
          Kawasan <b>ramai</b> yang layanan transitnya <b>kurang</b> pada jam ramainya. Disusun
          otomatis dari hitungan, diurutkan dari yang paling kuat buktinya. Klik kartu untuk terbang ke
          lokasinya.
        </p>
        {mode !== 'gap' && recs.length > 0 && (
          <button type="button" className="link-btn inline-cta" onClick={onShowGap}>
            Tampilkan nomor kandidat di peta →
          </button>
        )}
        {loading && <p className="skeleton-line">Menghitung kandidat…</p>}
        {!loading && recs.length === 0 && (
          <p className="empty-state">
            Belum ada kawasan ramai yang layanannya kurang pada data saat ini.
          </p>
        )}
        <ul className="rec-list" ref={listRef}>
          {recs.map((r, i) => (
            <li
              key={r.id}
              data-rec={r.id}
              className={`rec-card rec-${r.kind}${activeRecId === r.id ? ' is-active' : ''}`}
            >
              <button type="button" className="rec-card-btn" onClick={() => onFocus(r)}>
                <span className={`rec-num rec-num-${r.kind}`}>{i + 1}</span>
                <span className="rec-main">
                  <span className="rec-meta">
                    <i className={`rec-kind rec-kind-${r.kind}`}>{KIND_LABEL[r.kind]}</i>
                    <i className={`conf conf-${r.confidence}`} title={CONF_HINT[r.confidence]}>
                      keyakinan {r.confidence}
                    </i>
                  </span>
                  <b>{r.title}</b>
                </span>
              </button>
              <div className="rec-stats">
                {r.facts.map((f) => (
                  <span key={f.label} className="rec-stat">
                    <b>{f.value}</b>
                    <small>{f.label}</small>
                  </span>
                ))}
              </div>
              <p>{r.body}</p>
              <div className="rec-action">
                <small>Usulan · untuk {r.target}</small>
                {r.action.replace(/^Jenis kandidat: /, '')}
              </div>
              <button type="button" className="link-btn rec-goto" onClick={() => onFocus(r)}>
                Lihat di peta →
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

