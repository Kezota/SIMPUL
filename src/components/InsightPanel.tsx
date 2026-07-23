import { buildRecommendations } from '../lib/ai'
import { ACCESS_META } from '../lib/analysis'
import { themeMeta } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import type { Insights, NodeStats } from '../lib/types'
import { BarList, Donut, Stat } from './charts'

interface Props {
  insights: Insights
  nodeStats: NodeStats[]
  onFocusNode: (nodeId: string) => void
  activeNodeId: string | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export default function InsightPanel({
  insights,
  nodeStats,
  onFocusNode,
  activeNodeId,
}: Props) {
  const recs = buildRecommendations(insights, nodeStats)

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Insight</h2>
        <span className="count-pill">{insights.total} laporan</span>
      </div>

      <section className="block">
        <h3>Angka utama</h3>
        <div className="stat-grid">
          <Stat
            label="Dalam 1 km simpul"
            value={pct(insights.coverageRatio)}
            sub={`${insights.withinServiceArea} dari ${insights.total} laporan`}
            tone={insights.coverageRatio >= 0.5 ? 'good' : 'warn'}
          />
          <Stat
            label="Jarak median ke simpul"
            value={formatDistance(insights.medianDistanceM)}
            sub="Separuh laporan lebih dekat dari ini"
          />
          <Stat
            label="Bernada keluhan"
            value={pct(insights.complaintRatio)}
            sub="Hasil deteksi nada dari teks"
            tone={insights.complaintRatio > 0.3 ? 'bad' : 'default'}
          />
          <Stat
            label="Di luar jangkauan"
            value={`${insights.blankSpots.length}`}
            sub="Lebih dari 2 km dari simpul mana pun"
            tone={insights.blankSpots.length > 0 ? 'warn' : 'good'}
          />
        </div>
      </section>

      <section className="block">
        <h3>Indeks Denyut Transit per simpul</h3>
        <p className="block-note">
          45% volume laporan + 30% relevansi tema + 25% kelengkapan bukti visual.
          Klik untuk memfokuskan peta.
        </p>
        <BarList
          max={100}
          data={nodeStats.map((n) => ({
            label: n.node.name.replace(/^Stasiun |^Terminal /, ''),
            value: n.pulseIndex,
            color: n.count === 0 ? '#cbd5e1' : '#0ea5e9',
            active: activeNodeId === n.node.id,
            hint: `${n.node.name}: ${n.count} laporan, denyut ${n.pulseIndex}/100`,
            onClick: () => onFocusNode(n.node.id),
          }))}
        />
      </section>

      <section className="block">
        <h3>Komposisi tema</h3>
        <p className="block-note">
          Hasil klasifikasi teks — tidak ada kolom kategori di data mentah.
        </p>
        <BarList
          data={insights.themeCounts.map((t) => ({
            label: themeMeta(t.theme).short,
            value: t.count,
            color: themeMeta(t.theme).color,
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
