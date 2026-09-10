import { useEffect } from 'react'

import type { SimpulModel } from '../lib/engine'
import { formatDistance } from '../lib/geo'
import type { GlossaryKey } from '../lib/glossary'
import type { Recommendation } from '../lib/recommend'
import { TIME_BLOCKS } from '../lib/timeblocks'
import InfoTip from './InfoTip'

const KIND_LABEL = { jangkauan: 'Tak terjangkau', jadwal: 'Frekuensi rendah' } as const
const CONF_TEXT = {
  tinggi: 'Didukung ≥ 8 laporan di ≥ 2 sel bersebelahan.',
  sedang: '3–7 laporan; layak ditinjau, sebaiknya dicek lapangan.',
  rendah: 'Kurang dari 3 laporan; perlu survei sebelum ditindaklanjuti.',
} as const
const CONF_DOTS = { tinggi: 3, sedang: 2, rendah: 1 } as const
const FACT_KEY: Record<string, GlossaryKey> = { 'Sel ramai': 'sel_ramai', Bukti: 'bukti', 'Ke layanan': 'ke_layanan', 'Skor layanan': 'skor_layanan' }

/**
 * Detail satu kandidat (modal). Dibagi jadi blok-blok pendek: angka →
 * apa yang terjadi → kapan → layanan terdekat → usulan → keyakinan.
 * Semua angka dari mesin hitung.
 */
export default function RecDetail({
  rec,
  index,
  model,
  onClose,
  onFocus,
}: {
  rec: Recommendation
  index: number
  model: SimpulModel
  onClose: () => void
  onFocus: (r: Recommendation) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cells = rec.cellKeys.map((k) => model.cellByKey.get(k)).filter((c) => c !== undefined)
  const perBlock = TIME_BLOCKS.map((b) => ({
    ...b,
    pts: cells.reduce((s, c) => s + c.blocks[b.id].total, 0),
    ramai: cells.filter((c) => c.blocks[b.id].cls === 'ramai').length,
    gap: cells.filter((c) => c.blocks[b.id].gap).length,
  }))
  const peak = Math.max(1, ...perBlock.map((x) => x.pts))
  const node = rec.nearestNode
  const avgNodeM = cells.length ? cells.reduce((s, c) => s + c.nearestNodeDistM, 0) / cells.length : 0
  const stop = cells[0]?.nearestStop ?? null
  const avgStopM = cells.length ? cells.reduce((s, c) => s + c.nearestStopDistM, 0) / cells.length : 0
  const blockName = rec.block ? TIME_BLOCKS.find((b) => b.id === rec.block)?.label : ''

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal rd" role="dialog" aria-modal="true" aria-labelledby="rd-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Tutup" onClick={onClose}>
          ×
        </button>

        <div className="rd-head">
          <span className={`rc-num rc-num-${rec.kind}`}>{index + 1}</span>
          <div>
            <small className={`rd-kind rd-kind-${rec.kind}`}>{KIND_LABEL[rec.kind]}</small>
            <h2 id="rd-title">{rec.place}</h2>
            <p>{rec.headline}</p>
          </div>
        </div>

        <div className="rd-stats">
          {rec.facts.map((f) => (
            <span key={f.label}>
              <b>{f.value}</b>
              <small>{f.label}</small>
              {FACT_KEY[f.label] && <InfoTip k={FACT_KEY[f.label]} corner />}
            </span>
          ))}
          <span>
            <b>{blockName}</b>
            <small>blok paling ramai</small>
          </span>
        </div>

        <section className="rd-card">
          <h3>Apa yang terjadi</h3>
          <ul className="rd-facts">
            {rec.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>

        <section className="rd-card">
          <h3>Kapan kawasan ini hidup</h3>
          <div className="rd-chart">
            {perBlock.map((b) => (
              <div key={b.id} className={b.id === rec.block ? 'on' : undefined} title={`${b.label} ${b.range}: ${b.pts.toFixed(1)} poin · ${b.ramai} sel ramai · ${b.gap} sel ber-gap`}>
                <span className="rd-bar" style={{ height: `${Math.max(4, (b.pts / peak) * 100)}%` }} />
                <b>{b.label}</b>
                <small>{b.range}</small>
              </div>
            ))}
          </div>
          <p className="rd-note">Batang biru = blok paling ramai; pada blok itulah layanannya dinilai kurang.</p>
        </section>

        <section className="rd-card">
          <h3>Layanan terdekat</h3>
          <ul className="rd-list">
            <li>
              <b>{node.name}</b>
              <span className="rd-list-meta">
                {formatDistance(avgNodeM)} · ±{node.depByBlock?.[rec.block ?? 'sore'] ?? 0} kereta pada blok {blockName}
              </span>
            </li>
            {stop && (
              <li>
                <b>Halte {stop.name}</b>
                <span className="rd-list-meta">
                  {formatDistance(avgStopM)} · ±{stop.dep[rec.block ?? 'sore']} bus pada blok {blockName} · {stop.jak ? 'JakLingko' : 'TransJakarta'}
                </span>
              </li>
            )}
          </ul>
        </section>

        <section className="rd-card rd-action">
          <h3>
            Usulan tindakan <InfoTip k="perkiraan_armada" />
          </h3>
          <p className="rd-summary">{rec.proposal.summary}</p>
          <small className="rd-target">Untuk {rec.target}</small>
          <ol className="rd-steps">
            {rec.proposal.steps.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
          <div className="rd-est">
            {rec.proposal.estimate.map((e) => (
              <span key={e.label}>
                <b>{e.value}</b>
                <small>{e.label}</small>
                <InfoTip text={e.how} corner />
              </span>
            ))}
          </div>
          <p className="rd-caveat">{rec.proposal.caveat}</p>
        </section>

        <section className="rd-card rd-conf">
          <h3>
            Seberapa yakin <InfoTip k="keyakinan" />
          </h3>
          <div className="rd-conf-row">
            <i className="rc-conf" aria-hidden="true">
              {[1, 2, 3].map((d) => (
                <b key={d} className={d <= CONF_DOTS[rec.confidence] ? 'on' : undefined} />
              ))}
            </i>
            <b className="rd-conf-word">{rec.confidence}</b>
            <span>{CONF_TEXT[rec.confidence]}</span>
          </div>
          <p className="rd-note">
            Peringkat #{index + 1} (skor {rec.score.toFixed(1)}) <InfoTip k="skor_peringkat" />
          </p>
        </section>

        <div className="rd-foot">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onFocus(rec)
              onClose()
            }}
          >
            Lihat di peta →
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
