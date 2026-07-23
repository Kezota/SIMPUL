import { Fragment } from 'react'

import { describeNode } from '../lib/ai'
import { ACCESS_META } from '../lib/analysis'
import { categoryOf } from '../data/datasets'
import { formatDistance } from '../lib/geo'
import { NODE_KIND_LABEL } from '../data/transitNodes'
import type { DatasetDef, NodeStats, Observation } from '../lib/types'
import { BarList } from './charts'

interface Props {
  dataset: DatasetDef
  observation: Observation | null
  node: NodeStats | null
  onClear: () => void
  onFilterNode: (nodeId: string) => void
}

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

export default function DetailPanel({
  dataset,
  observation,
  node,
  onClear,
  onFilterNode,
}: Props) {
  if (!observation && !node) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Detail</h2>
        </div>
        <p className="placeholder">
          Klik satu titik atau satu simpul transit di peta untuk melihat atribut
          lengkapnya — termasuk foto lapangan dan hasil pembacaan AI.
        </p>
      </div>
    )
  }

  if (observation) {
    const o = observation
    const cat = categoryOf(dataset, o.categoryId)
    const acc = ACCESS_META[o.accessClass]
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Detail Titik</h2>
          <button type="button" className="link-btn" onClick={onClear}>
            Tutup
          </button>
        </div>

        <div className="block">
          <span className="theme-badge" style={{ background: cat.color }}>
            {cat.label}
          </span>
          <span className={`src-tag src-${o.categorySource}`}>
            {o.categorySource === 'ai'
              ? `AI · keyakinan ${Math.round(o.categoryConfidence * 100)}%`
              : 'kolom asli data'}
          </span>
          <h3 className="detail-title">{o.title}</h3>
          {o.subtitle && <p className="detail-sub">{o.subtitle}</p>}
          {o.description && <p className="detail-desc">{o.description}</p>}
        </div>

        {o.images.length > 0 && (
          <div className="block">
            <h3>
              Dokumentasi lapangan ({o.images.length} foto
              {o.videos.length ? `, ${o.videos.length} video` : ''})
            </h3>
            <div className="thumbs">
              {o.images.slice(0, 6).map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" loading="lazy" />
                </a>
              ))}
            </div>
            <p className="block-note">
              Foto inilah bahan mentah untuk klasifikasi visual pada versi lanjutan
              (mis. kondisi bangunan, ada tidaknya undakan/ramp, keramaian).
            </p>
          </div>
        )}

        {(o.price !== null || o.when || o.attributes.length > 0) && (
          <div className="block">
            <h3>Atribut dataset</h3>
            <dl className="kv">
              {o.price !== null && (
                <>
                  <dt>Harga rata-rata</dt>
                  <dd>{rupiah(o.price)}</dd>
                </>
              )}
              {o.when && (
                <>
                  <dt>Waktu</dt>
                  <dd>
                    {o.when.date}
                    {o.when.time ? ` · ${o.when.time}` : ''}
                  </dd>
                </>
              )}
              {o.attributes.map((a) => (
                <Fragment key={a.label}>
                  <dt>{a.label}</dt>
                  <dd>{a.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}

        <div className="block">
          <h3>Hasil pembacaan AI</h3>
          <p className="ai-summary">{o.aiSummary}</p>
          <dl className="kv">
            <dt>Relevansi transit</dt>
            <dd>{Math.round(o.transitRelevance * 100)}/100</dd>
            <dt>Kelengkapan bukti</dt>
            <dd>{Math.round(o.mediaScore * 100)}%</dd>
            {o.priceHints.length > 0 && (
              <>
                <dt>Indikasi harga di teks</dt>
                <dd>{o.priceHints.join(', ')}</dd>
              </>
            )}
          </dl>
          <div className="chips">
            {o.tags.map((t) => (
              <span key={t} className="chip static">
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div className="block">
          <h3>Atribut spasial</h3>
          <dl className="kv">
            <dt>Koordinat</dt>
            <dd>
              {o.lat.toFixed(5)}, {o.lon.toFixed(5)}
            </dd>
            <dt>Simpul terdekat</dt>
            <dd>
              <button
                type="button"
                className="link-btn"
                onClick={() => onFilterNode(o.nearestNodeId)}
              >
                {o.nearestNodeName}
              </button>
            </dd>
            <dt>Jarak</dt>
            <dd style={{ color: acc.color }}>
              {formatDistance(o.distanceM)} — {acc.label}
            </dd>
            <dt>Interpretasi</dt>
            <dd>{acc.desc}</dd>
          </dl>
        </div>
      </div>
    )
  }

  const n = node!
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Detail Simpul</h2>
        <button type="button" className="link-btn" onClick={onClear}>
          Tutup
        </button>
      </div>

      <div className="block">
        <span className="theme-badge" style={{ background: '#0ea5e9' }}>
          {NODE_KIND_LABEL[n.node.kind]}
        </span>
        <h3 className="detail-title">{n.node.name}</h3>
        <div className="pulse-big">
          <span>{n.pulseIndex}</span>
          <small>Indeks Denyut Transit / 100</small>
        </div>
        <p className="ai-summary">{describeNode(n, dataset)}</p>
      </div>

      {n.categoryMix.length > 0 && (
        <div className="block">
          <h3>Komposisi kategori di catchment</h3>
          <BarList
            data={n.categoryMix.slice(0, 8).map((c) => ({
              label: categoryOf(dataset, c.categoryId).label,
              value: c.count,
              color: categoryOf(dataset, c.categoryId).color,
            }))}
          />
        </div>
      )}

      <div className="block">
        <h3>Data simpul</h3>
        <dl className="kv">
          <dt>Radius layanan</dt>
          <dd>{formatDistance(n.node.serviceRadiusM)}</dd>
          <dt>Catchment</dt>
          <dd>{n.count} titik (simpul terdekat)</dd>
          <dt>Dalam radius</dt>
          <dd>
            {n.withinRadius} titik{' '}
            {n.count > 0 && `(${Math.round((n.withinRadius / n.count) * 100)}%)`}
          </dd>
          <dt>{dataset.highlight.label}</dt>
          <dd>{n.highlightCount}</dd>
          {n.medianPrice !== null && (
            <>
              <dt>Harga median</dt>
              <dd>{rupiah(n.medianPrice)}</dd>
            </>
          )}
          <dt>Koordinat</dt>
          <dd>
            {n.node.lat.toFixed(4)}, {n.node.lon.toFixed(4)}
          </dd>
        </dl>
        <button type="button" className="btn" onClick={() => onFilterNode(n.node.id)}>
          Filter peta ke simpul ini
        </button>
        <p className="block-note">
          ⚠️ Koordinat simpul masih perkiraan manual — di versi kompetisi diganti
          data resmi OSM/BIG/KAI.
        </p>
      </div>
    </div>
  )
}
