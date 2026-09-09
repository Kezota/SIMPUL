import { useEffect } from 'react'

import type { SimpulModel } from '../lib/engine'
import { formatDistance } from '../lib/geo'
import type { Recommendation } from '../lib/recommend'
import { TIME_BLOCKS } from '../lib/timeblocks'

const KIND_LABEL = { jangkauan: 'Tak terjangkau', jadwal: 'Frekuensi rendah' } as const
const CONF_TEXT = {
  tinggi: 'Tinggi — didukung ≥ 8 laporan di ≥ 2 sel bersebelahan.',
  sedang: 'Sedang — 3–7 laporan; layak ditinjau, sebaiknya dicek lapangan.',
  rendah: 'Rendah — kurang dari 3 laporan; perlu survei sebelum ditindaklanjuti.',
} as const

/**
 * Detail lengkap satu kandidat (modal). Semua angka dari mesin hitung; tidak
 * ada yang dikarang. Tujuannya menjawab: seberapa kuat buktinya, kapan
 * ramainya, layanan apa yang terdekat, dan apa langkah wajarnya.
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
  const ramaiN = cells.reduce((s, c) => s + c.evidence.filter((e) => e.crowd === 'ramai').length, 0)

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
            </span>
          ))}
          <span>
            <b>{ramaiN}</b>
            <small>laporan sebut "ramai"</small>
          </span>
        </div>

        <section>
          <h3>Apa yang terjadi</h3>
          <p>{rec.body}</p>
        </section>

        <section>
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
          <p className="rd-note">Batang biru = blok paling ramai sekaligus blok yang layanannya dinilai kurang.</p>
        </section>

        <section>
          <h3>Layanan terdekat</h3>
          <ul className="rd-list">
            <li>
              <b>{node.name}</b> · {formatDistance(avgNodeM)} · ±{node.depByBlock?.[rec.block ?? 'sore'] ?? 0} kereta pada blok{' '}
              {rec.block ? TIME_BLOCKS.find((b) => b.id === rec.block)?.label : ''}
              {node.scheduleSource && <small>{node.scheduleSource}</small>}
            </li>
            {stop && (
              <li>
                <b>{stop.name}</b> · {formatDistance(avgStopM)} · ±{stop.dep[rec.block ?? 'sore']} bus pada blok itu
                <small>{stop.jak ? 'Halte JakLingko / Mikrotrans' : 'Halte TransJakarta'} · GTFS resmi</small>
              </li>
            )}
          </ul>
        </section>

        <section className="rd-action">
          <h3>Langkah yang wajar</h3>
          <p>
            {rec.action.replace(/^Jenis kandidat: /, '')}
            <br />
            <small>Untuk {rec.target}. SIMPUL tidak menentukan jumlah armada atau rute rinci — itu keputusan operator/regulator.</small>
          </p>
        </section>

        <section>
          <h3>Seberapa yakin</h3>
          <p>{CONF_TEXT[rec.confidence]}</p>
          <p className="rd-note">
            Peringkat #{index + 1} dari skor {rec.score.toFixed(1)} — kantong yang lebih luas, laporannya lebih banyak, dan layanannya lebih tipis naik lebih dulu. Rumus di tab Metode &amp; data.
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
