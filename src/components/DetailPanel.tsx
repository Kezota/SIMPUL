import { describeNode } from '../lib/ai'
import { ACCESS_META } from '../lib/analysis'
import { themeMeta } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import { NODE_KIND_LABEL } from '../data/transitNodes'
import type { Activity, NodeStats } from '../lib/types'
import { BarList } from './charts'

interface Props {
  activity: Activity | null
  node: NodeStats | null
  onClear: () => void
  onFilterNode: (nodeId: string) => void
}

export default function DetailPanel({ activity, node, onClear, onFilterNode }: Props) {
  if (!activity && !node) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Detail</h2>
        </div>
        <p className="placeholder">
          Klik satu titik aktivitas atau satu simpul transit di peta untuk melihat
          atribut lengkapnya — termasuk foto lapangan dan hasil pembacaan AI.
        </p>
      </div>
    )
  }

  if (activity) {
    const meta = themeMeta(activity.theme)
    const acc = ACCESS_META[activity.accessClass]
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Detail Aktivitas</h2>
          <button type="button" className="link-btn" onClick={onClear}>
            Tutup
          </button>
        </div>

        <div className="block">
          <span className="theme-badge" style={{ background: meta.color }}>
            {meta.label}
          </span>
          <h3 className="detail-title">{activity.title}</h3>
          {activity.description && <p className="detail-desc">{activity.description}</p>}
        </div>

        {activity.images.length > 0 && (
          <div className="block">
            <h3>Dokumentasi lapangan ({activity.images.length} foto{activity.videos.length ? `, ${activity.videos.length} video` : ''})</h3>
            <div className="thumbs">
              {activity.images.slice(0, 6).map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" loading="lazy" />
                </a>
              ))}
            </div>
            <p className="block-note">
              Foto inilah bahan mentah untuk klasifikasi visual pada versi lanjutan
              (mis. deteksi kondisi trotoar / fasilitas dari citra).
            </p>
          </div>
        )}

        <div className="block">
          <h3>Hasil pembacaan AI</h3>
          <p className="ai-summary">{activity.aiSummary}</p>
          <dl className="kv">
            <dt>Tema</dt>
            <dd>
              {meta.label} · keyakinan {Math.round(activity.themeConfidence * 100)}%
            </dd>
            <dt>Nada laporan</dt>
            <dd className={`nada nada-${activity.sentiment}`}>{activity.sentiment}</dd>
            <dt>Relevansi transit</dt>
            <dd>{Math.round(activity.transitRelevance * 100)}/100</dd>
            {activity.priceHints.length > 0 && (
              <>
                <dt>Indikasi harga</dt>
                <dd>{activity.priceHints.join(', ')}</dd>
              </>
            )}
          </dl>
          <div className="chips">
            {activity.tags.map((t) => (
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
              {activity.lat.toFixed(5)}, {activity.lon.toFixed(5)}
            </dd>
            <dt>Simpul terdekat</dt>
            <dd>
              <button
                type="button"
                className="link-btn"
                onClick={() => onFilterNode(activity.nearestNodeId)}
              >
                {activity.nearestNodeName}
              </button>
            </dd>
            <dt>Jarak</dt>
            <dd style={{ color: acc.color }}>
              {formatDistance(activity.distanceM)} — {acc.label}
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
        <p className="ai-summary">{describeNode(n)}</p>
      </div>

      {n.themeMix.length > 0 && (
        <div className="block">
          <h3>Komposisi tema di radius layanan</h3>
          <BarList
            data={n.themeMix.map((t) => ({
              label: themeMeta(t.theme).short,
              value: t.count,
              color: themeMeta(t.theme).color,
            }))}
          />
        </div>
      )}

      <div className="block">
        <h3>Data simpul</h3>
        <dl className="kv">
          <dt>Radius layanan</dt>
          <dd>{formatDistance(n.node.serviceRadiusM)}</dd>
          <dt>Laporan di radius</dt>
          <dd>{n.count}</dd>
          <dt>Bernada keluhan</dt>
          <dd>{n.complaintCount}</dd>
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
