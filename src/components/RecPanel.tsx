import { useEffect, useMemo, useRef, useState } from 'react'

import { summarizeBlocks, type SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'
import type { Role } from '../lib/roles'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'
import type { MapMode } from './MapView'
import RecDetail from './RecDetail'
import InfoTip from './InfoTip'
import type { GlossaryKey } from '../lib/glossary'

const FACT_KEY: Record<string, GlossaryKey> = { 'Sel ramai': 'sel_ramai', Bukti: 'bukti', 'Ke layanan': 'ke_layanan', 'Skor layanan': 'skor_layanan' }

const KIND_LABEL = { jangkauan: 'Tak terjangkau', jadwal: 'Frekuensi rendah' } as const
const CONF_HINT = {
  tinggi: 'Keyakinan tinggi: ≥ 8 laporan di ≥ 2 sel bersebelahan',
  sedang: 'Keyakinan sedang: 3–7 laporan',
  rendah: 'Keyakinan rendah: < 3 laporan — perlu survei lanjutan',
} as const
const CONF_DOTS = { tinggi: 3, sedang: 2, rendah: 1 } as const

type SortKey = 'skor' | 'bukti' | 'keyakinan'

/* ── Panel Kandidat ───────────────────────────────────────────────────────── */

export default function RecPanel({
  model,
  recs,
  role,
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
  role: Role
  block: BlockId
  mode: MapMode
  loading: boolean
  activeRecId: string | null
  onSetBlock: (b: BlockId) => void
  onFocus: (r: Recommendation) => void
  onShowGap: () => void
}) {
  const summaries = summarizeBlocks(model)
  const peak = Math.max(1, ...summaries.map((s) => s.totalPoints))
  const listRef = useRef<HTMLDivElement>(null)
  const [sort, setSort] = useState<SortKey>('skor')
  const [showOthers, setShowOthers] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Nomor kandidat = urutan skor (sama dengan nomor di peta), apa pun urutan tampilnya.
  const numbered = useMemo(() => recs.map((r, i) => ({ r, n: i + 1 })), [recs])
  const sorted = useMemo(() => {
    const arr = [...numbered]
    if (sort === 'bukti') arr.sort((a, b) => b.r.evidenceCount - a.r.evidenceCount || b.r.score - a.r.score)
    if (sort === 'keyakinan') arr.sort((a, b) => CONF_DOTS[b.r.confidence] - CONF_DOTS[a.r.confidence] || b.r.score - a.r.score)
    return arr
  }, [numbered, sort])
  const mine = sorted.filter((x) => role.owns(x.r))
  const others = sorted.filter((x) => !role.owns(x.r))

  const activeIsOther = activeRecId !== null && others.some((x) => x.r.id === activeRecId)
  const othersVisible = showOthers || activeIsOther
  const expanded = openId ?? activeRecId

  // Marker bernomor di peta / asisten menyorot kartu → gulir masuk.
  useEffect(() => {
    if (!activeRecId || !listRef.current) return
    const raf = requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-rec="${activeRecId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    )
    return () => cancelAnimationFrame(raf)
  }, [activeRecId])

  const card = ({ r, n }: { r: Recommendation; n: number }) => {
    const isOpen = expanded === r.id
    const blockMeta = r.block ? TIME_BLOCKS.find((b) => b.id === r.block) : null
    return (
      <li key={r.id} data-rec={r.id} className={`rc rc-${r.kind}${activeRecId === r.id ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="rc-head"
          aria-expanded={isOpen}
          onClick={() => setOpenId(isOpen ? (activeRecId === r.id ? '' : null) : r.id)}
        >
          <span className="rc-num">{n}</span>
          <span className="rc-body">
            <span className="rc-place">{r.place}</span>
            <span className="rc-headline">{r.headline}</span>
            <span className="rc-meta">
              <i className="rc-kind">{KIND_LABEL[r.kind]}</i>
              <i className="rc-conf" title={CONF_HINT[r.confidence]} aria-label={CONF_HINT[r.confidence]}>
                {[1, 2, 3].map((d) => (
                  <b key={d} className={d <= CONF_DOTS[r.confidence] ? 'on' : undefined} />
                ))}
              </i>
              <i>{r.evidenceCount} laporan</i>
              {blockMeta && <i>{blockMeta.label}</i>}
            </span>
          </span>
          <span className="rc-chev" aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="rc-detail">
            <div className="rc-stats">
              {r.facts.map((f) => (
                <span key={f.label}>
                  <b>{f.value}</b>
                  <small>
                    {f.label}
                    {FACT_KEY[f.label] && <InfoTip k={FACT_KEY[f.label]} corner />}
                  </small>
                </span>
              ))}
            </div>
            <p className="rc-proposal">{r.proposal.summary}</p>
            <div className="rc-est">
              {r.proposal.estimate.slice(0, 2).map((e) => (
                <span key={e.label}>
                  {e.label}: {e.value}
                  <InfoTip text={e.how} />
                </span>
              ))}
            </div>
            <div className="rc-btns">
              <button type="button" className="btn small" onClick={() => onFocus(r)}>
                Lihat di peta →
              </button>
              <button type="button" className="btn small ghost" onClick={() => setDetailId(r.id)}>
                Detail lengkap
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="panel panel-rec" ref={listRef}>
      {/* Grafik mini: kapan datanya "hidup". Klik batang = pindah blok. */}
      <section className="blk">
        <div className="blk-head">
          <h3>
            Aktivitas per blok waktu <InfoTip k="aktivitas_blok" />
          </h3>
        </div>
        {loading ? (
          <p className="skeleton-line">Memuat laporan warga dari MAPID…</p>
        ) : (
          <div className="blk-chart" role="group" aria-label="Aktivitas per blok waktu">
            {summaries.map((s) => {
              const b = TIME_BLOCKS.find((t) => t.id === s.block)!
              return (
                <button
                  key={s.block}
                  type="button"
                  className={s.block === block ? 'on' : undefined}
                  onClick={() => onSetBlock(s.block)}
                  title={`${b.label} ${b.range}: ${Math.round(s.totalPoints)} poin · ${s.ramai} sel ramai · ${s.gapJadwal + s.gapJangkauan} sel ber-gap`}
                >
                  <span className="blk-val">{Math.round(s.totalPoints)}</span>
                  <span className="blk-bar" style={{ height: `${Math.max(4, (s.totalPoints / peak) * 100)}%` }} />
                  <span className="blk-lbl">{b.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="blk">
        <div className="blk-head">
          <h3>
            {role.ownedTitle} <span className="count-pill">{mine.length}</span>
          </h3>
          <label className="sort">
            <span className="sr-only">Urutkan</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} title="Urutkan kandidat">
              <option value="skor">Skor</option>
              <option value="bukti">Bukti</option>
              <option value="keyakinan">Keyakinan</option>
            </select>
          </label>
        </div>

        {mode !== 'gap' && recs.length > 0 && (
          <button type="button" className="link-btn inline-cta" onClick={onShowGap}>
            Tampilkan nomor kandidat di peta →
          </button>
        )}
        {loading && <p className="skeleton-line">Menghitung kandidat…</p>}
        {!loading && mine.length === 0 && (
          <p className="empty-state">
            {recs.length === 0 ? 'Belum ada kawasan ramai yang layanannya kurang.' : 'Tidak ada kandidat untuk peran ini — lihat kandidat instansi lain di bawah.'}
          </p>
        )}
        <ul className="rc-list">{mine.map(card)}</ul>

        {others.length > 0 && (
          <>
            <button type="button" className="link-btn others-toggle" onClick={() => setShowOthers(!othersVisible)}>
              {othersVisible ? 'Sembunyikan' : 'Tampilkan'} {others.length} kandidat instansi lain {othersVisible ? '↑' : '↓'}
            </button>
            {othersVisible && <ul className="rc-list rc-list-others">{others.map(card)}</ul>}
          </>
        )}
        <p className="foot-note">Urutan = bukti paling kuat lebih dulu, bukan urutan investasi. Rumus ada di tab Metode &amp; data.</p>
      </section>

      {detailId !== null && (() => {
        const i = recs.findIndex((r) => r.id === detailId)
        return i >= 0 ? <RecDetail rec={recs[i]} index={i} model={model} onClose={() => setDetailId(null)} onFocus={onFocus} /> : null
      })()}
    </div>
  )
}
