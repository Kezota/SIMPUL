import { buildRecommendations } from '../lib/ai'
import { ACCESS_META } from '../lib/analysis'
import { categoryOf } from '../data/datasets'
import { formatDistance } from '../lib/geo'
import type { DatasetDef, Insights, NodeStats } from '../lib/types'
import { BarList, Donut, Stat } from './charts'

interface Props {
  dataset: DatasetDef
  insights: Insights
  nodeStats: NodeStats[]
  onFocusNode: (nodeId: string) => void
  activeNodeId: string | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

export default function InsightPanel({
  dataset,
  insights,
  nodeStats,
  onFocusNode,
  activeNodeId,
}: Props) {
  const recs = buildRecommendations(insights, nodeStats, dataset)

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Insight</h2>
        <span className="count-pill">{insights.total} titik</span>
      </div>

      <p className="block-note dataset-blurb">{dataset.blurb}</p>

      <section className="block">
        <h3>Angka utama</h3>
        <div className="stat-grid">
          <Stat
            label="Dalam 1 km simpul"
            value={pct(insights.coverageRatio)}
            sub={`${insights.withinServiceArea} dari ${insights.total} titik`}
            tone={insights.coverageRatio >= 0.5 ? 'good' : 'warn'}
          />
          <Stat
            label="Jarak median ke simpul"
            value={formatDistance(insights.medianDistanceM)}
            sub="Separuh titik lebih dekat dari ini"
          />
          <Stat
            label={dataset.highlight.label}
            value={pct(insights.highlightRatio)}
            sub={dataset.highlight.hint}
          />
          {insights.medianPrice !== null ? (
            <Stat
              label="Harga median"
              value={rupiah(insights.medianPrice)}
              sub="Diisi surveyor, bukan hasil baca struk"
            />
          ) : (
            <Stat
              label="Di luar jangkauan"
              value={`${insights.blankSpots.length}`}
              sub="Lebih dari 2 km dari simpul mana pun"
              tone={insights.blankSpots.length > 0 ? 'warn' : 'good'}
            />
          )}
        </div>
      </section>

      <section className="block">
        <h3>Indeks Denyut Transit per simpul</h3>
        <p className="block-note">
          40% volume (diluruhkan terhadap jarak) + 30% relevansi kategori + 30%
          kelengkapan bukti visual. Abu-abu = simpul tanpa catchment sama sekali.
          Klik untuk memfokuskan peta.
        </p>
        <BarList
          max={100}
          data={nodeStats.map((n) => ({
            label: n.node.name.replace(/^Stasiun |^Terminal /, ''),
            value: n.pulseIndex,
            color: n.count === 0 ? '#cbd5e1' : '#0ea5e9',
            active: activeNodeId === n.node.id,
            hint: `${n.node.name}: ${n.count} titik di catchment (${n.withinRadius} dalam radius jalan kaki), denyut ${n.pulseIndex}/100`,
            onClick: () => onFocusNode(n.node.id),
          }))}
        />
      </section>

      <section className="block">
        <h3>Komposisi kategori</h3>
        <p className="block-note">
          {dataset.categorySource === 'ai'
            ? 'Hasil klasifikasi teks — tidak ada kolom kategori di data mentah.'
            : 'Diambil langsung dari kolom kategori data panitia.'}
        </p>
        <BarList
          data={insights.categoryCounts.slice(0, 10).map((c) => ({
            label: categoryOf(dataset, c.categoryId).label,
            value: c.count,
            color: categoryOf(dataset, c.categoryId).color,
          }))}
        />
      </section>

      <section className="block">
        <h3>Sebaran keterjangkauan</h3>
        <Donut
          centerValue={pct(insights.coverageRatio)}
          centerLabel="walkable"
          data={insights.accessCounts
            .filter((a) => a.count > 0)
            .map((a) => ({
              label: ACCESS_META[a.cls].label,
              value: a.count,
              color: ACCESS_META[a.cls].color,
            }))}
        />
      </section>

      <section className="block">
        <h3>Rekomendasi</h3>
        <ul className="rec-list">
          {recs.map((r) => (
            <li key={r.title}>
              <span className="rec-target">{r.target}</span>
              <b>{r.title}</b>
              <p>{r.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
