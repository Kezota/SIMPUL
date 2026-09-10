import { useEffect } from 'react'

import type { SimpulModel } from '../lib/engine'
import { formatDistance } from '../lib/geo'
import type { Recommendation } from '../lib/recommend'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'
import type { NodeKind, TransitNode } from '../lib/types'
import InfoTip from './InfoTip'

const KIND_LABEL: Record<NodeKind, string> = {
  krl: 'Stasiun KRL Commuter',
  mrt: 'Stasiun MRT Jakarta',
  lrt: 'Stasiun LRT Jakarta',
  lrt_jabodebek: 'Stasiun LRT Jabodebek',
  kcic: 'Stasiun Whoosh',
  stasiun: 'Stasiun',
  terminal: 'Terminal',
}

/**
 * Detail satu stasiun (modal): jadwal per blok, tingkat layanan, kawasan
 * sekitarnya (2 km), dan kandidat yang menunjuk ke stasiun ini. Semua angka
 * dari model hitungan — sama dengan yang dipakai alat AI profil_kawasan.
 */
export default function StationDetail({
  node,
  model,
  recs,
  block,
  onClose,
  onFocus,
  onOpenRec,
}: {
  node: TransitNode
  model: SimpulModel
  recs: Recommendation[]
  block: BlockId
  onClose: () => void
  onFocus: () => void
  onOpenRec: (rec: Recommendation, index: number) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const near = model.cells.filter((c) => c.nearestNode.id === node.id && c.nearestNodeDistM <= 2000)
  const per = TIME_BLOCKS.map((b) => {
    const dep = node.depByBlock?.[b.id] ?? 0
    return {
      ...b,
      dep,
      service: Math.min(1, dep / model.refDep.rail[b.id]),
      pts: near.reduce((s, c) => s + c.blocks[b.id].total, 0),
      ramai: near.filter((c) => c.blocks[b.id].cls === 'ramai').length,
      gap: near.filter((c) => c.blocks[b.id].gap).length,
    }
  })
  const now = per.find((x) => x.id === block)!
  const peakDep = Math.max(1, ...per.map((x) => x.dep))
  const peakPts = Math.max(1, ...per.map((x) => x.pts))
  const busiest = per.reduce((a, b) => (b.pts > a.pts ? b : a))
  const thinnest = per.filter((x) => x.dep > 0).reduce((a, b) => (b.service < a.service ? b : a), per[0])
  const reports = near.reduce((s, c) => s + c.evidence.length, 0)
  const linked = recs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.nearestNode.id === node.id)
    .map((x) => {
      const cs = x.r.cellKeys.map((k) => model.cellByKey.get(k)).filter((c) => c !== undefined)
      return { ...x, distM: cs.length ? cs.reduce((s, c) => s + c.nearestNodeDistM, 0) / cs.length : 0 }
    })
  const svcWord = (v: number) => (v <= 0.35 ? 'tipis' : v < 0.7 ? 'sedang' : 'memadai')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal rd sd" role="dialog" aria-modal="true" aria-labelledby="sd-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Tutup" onClick={onClose}>
          ×
        </button>
        <div className="rd-head">
          <span className={`sd-ico sd-ico-${node.kind}`} aria-hidden="true" />
          <div>
            <small className="rd-kind">{KIND_LABEL[node.kind] ?? 'Stasiun'}</small>
            <h2 id="sd-title">{node.name}</h2>
            <p>
              {node.lines?.length ? `Lintas ${node.lines.join(', ')} · ` : ''}
              {node.scheduleSource ?? 'Jadwal: perkiraan headway operator'}
            </p>
          </div>
        </div>

        <div className="rd-stats">
          <span>
            <b>±{now.dep}</b>
            <small>
              kereta pada blok {now.label}
              <InfoTip k="kereta_blok" corner />
            </small>
          </span>
          <span>
            <b>{Math.round(now.service * 100)}/100</b>
            <small>
              skor layanan ({svcWord(now.service)})
              <InfoTip k="skor_layanan" corner />
            </small>
          </span>
          <span>
            <b>{now.ramai}</b>
            <small>
              sel ramai dalam 2 km
              <InfoTip k="sel_ramai" corner />
            </small>
          </span>
          <span>
            <b>{reports}</b>
            <small>
              laporan aktivitas dari warga (2 km)
              <InfoTip k="laporan_warga" corner />
            </small>
          </span>
        </div>

        <section>
          <h3>Kereta per blok waktu</h3>
          <div className="rd-chart sd-chart">
            {per.map((b) => (
              <div key={b.id} className={`${b.id === block ? 'on' : ''}${b.service <= 0.35 ? ' low' : ''}`} title={`${b.label} ${b.range}: ±${b.dep} kereta · skor layanan ${Math.round(b.service * 100)}/100`}>
                <em>±{b.dep}</em>
                <span className="rd-bar" style={{ height: `${Math.max(4, (b.dep / peakDep) * 100)}%` }} />
                <b>{b.label}</b>
                <small>{b.range}</small>
              </div>
            ))}
          </div>
          <p className="rd-note">
            {thinnest.service <= 0.35
              ? `Paling tipis pada blok ${thinnest.label} — skor layanan ${Math.round(thinnest.service * 100)}/100.`
              : 'Tidak ada blok dengan jadwal tipis di stasiun ini.'}{' '}
            Skor layanan = keberangkatan dibanding acuan stasiun tersibuk pada blok yang sama.
          </p>
        </section>

        <section>
          <h3>Kawasan sekitar (2 km) — kapan hidupnya</h3>
          {near.length === 0 ? (
            <p className="rd-note">Belum ada laporan warga dalam 2 km dari stasiun ini. Bukan berarti sepi — belum ada data.</p>
          ) : (
            <>
              <div className="rd-chart sd-chart">
                {per.map((b) => (
                  <div key={b.id} className={b.id === block ? 'on' : undefined} title={`${b.label} ${b.range}: ${Math.round(b.pts)} poin · ${b.ramai} sel ramai · ${b.gap} sel ber-gap`}>
                    <em>{Math.round(b.pts)}</em>
                    <span className="rd-bar" style={{ height: `${Math.max(4, (b.pts / peakPts) * 100)}%` }} />
                    <b>{b.label}</b>
                    <small>{b.range}</small>
                  </div>
                ))}
              </div>
              <p className="rd-note">
                Paling hidup pada blok {busiest.label}; saat itu ±{busiest.dep} kereta, layanan {svcWord(busiest.service)}.
                {busiest.gap > 0 ? ` ${busiest.gap} sel di sekitarnya tergolong kesenjangan.` : ''}
              </p>
            </>
          )}
        </section>

        <section>
          <h3>Kandidat yang menunjuk ke stasiun ini</h3>
          {linked.length === 0 ? (
            <p className="rd-note">Tidak ada. Kawasan ramai di sekitar stasiun ini layanannya dinilai memadai.</p>
          ) : (
            <ul className="rd-list">
              {linked.map(({ r, i, distM }) => (
                <li key={r.id} className="sd-rec">
                  <div>
                    <b>
                      #{i + 1} {r.place}
                    </b>
                    <small>
                      {r.headline} · {formatDistance(distM)} dari stasiun
                    </small>
                  </div>
                  <button type="button" className="btn small" onClick={() => onOpenRec(r, i)}>
                    Buka →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="rd-foot">
          <button type="button" className="btn primary" onClick={onFocus}>
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
