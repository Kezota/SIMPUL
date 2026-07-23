import { ACCESS_META } from '../lib/analysis'
import { formatDistance } from '../lib/geo'
import { BASEMAP_NOTE, usingMapidBasemap } from '../lib/basemap'
import { REGION_LABEL } from '../data/transitNodes'
import type { AccessClass, DatasetDef, Filters, NodeStats, Observation } from '../lib/types'
import type { LayerVisibility } from './MapView'

interface Props {
  dataset: DatasetDef
  filters: Filters
  setFilters: (f: Filters) => void
  layers: LayerVisibility
  setLayers: (l: LayerVisibility) => void
  nodeStats: NodeStats[]
  filtered: Observation[]
  total: number
}

const LAYER_META: { key: keyof LayerVisibility; label: string; desc: string }[] = [
  { key: 'points', label: 'Titik data', desc: 'Diwarnai per kategori dataset aktif' },
  { key: 'heatmap', label: 'Kepadatan (heatmap)', desc: 'Dibobot relevansi transit; hilang saat zoom dalam' },
  { key: 'nodes', label: 'Simpul transit', desc: 'Stasiun & terminal + jumlah titik di catchment' },
  { key: 'radius', label: 'Radius layanan 1 km', desc: 'Buffer catchment pejalan kaki' },
  { key: 'links', label: 'Garis ke simpul terdekat', desc: 'Merah = di luar 2 km' },
]

export default function ControlPanel({
  dataset,
  filters,
  setFilters,
  layers,
  setLayers,
  nodeStats,
  filtered,
  total,
}: Props) {
  const toggleCategory = (id: string) =>
    setFilters({
      ...filters,
      categories: filters.categories.includes(id)
        ? filters.categories.filter((x) => x !== id)
        : [...filters.categories, id],
    })

  const toggleAccess = (a: AccessClass) =>
    setFilters({
      ...filters,
      access: filters.access.includes(a)
        ? filters.access.filter((x) => x !== a)
        : [...filters.access, a],
    })

  const reset = () =>
    setFilters({
      categories: [],
      access: [],
      onlyHighlighted: false,
      maxDistanceM: 40000,
      search: '',
      nodeId: null,
    })

  const dirty =
    filters.categories.length > 0 ||
    filters.access.length > 0 ||
    filters.onlyHighlighted ||
    filters.maxDistanceM < 40000 ||
    filters.search !== '' ||
    filters.nodeId !== null

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Kontrol Peta</h2>
        <span className="count-pill">
          {filtered.length}/{total} titik
        </span>
      </div>

      <section className="block">
        <h3>Layer</h3>
        <ul className="layer-list">
          {LAYER_META.map((l) => (
            <li key={l.key}>
              <label>
                <input
                  type="checkbox"
                  checked={layers[l.key]}
                  onChange={() => setLayers({ ...layers, [l.key]: !layers[l.key] })}
                />
                <span>
                  <b>{l.label}</b>
                  <small>{l.desc}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className={`basemap-note${usingMapidBasemap ? ' ok' : ''}`}>{BASEMAP_NOTE}</p>
      </section>

      <section className="block">
        <div className="block-head">
          <h3>Filter</h3>
          {dirty && (
            <button type="button" className="link-btn" onClick={reset}>
              Reset
            </button>
          )}
        </div>

        <input
          className="search"
          type="search"
          placeholder="Cari judul, alamat, atau tag…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <p className="field-label">
          Kategori{' '}
          <span className={`src-tag src-${dataset.categorySource}`}>
            {dataset.categorySource === 'ai' ? 'hasil klasifikasi AI' : 'kolom asli data'}
          </span>
        </p>
        <div className="chips">
          {dataset.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              className={`chip${filters.categories.includes(c.id) ? ' on' : ''}`}
              style={
                filters.categories.includes(c.id)
                  ? { background: c.color, borderColor: c.color, color: '#fff' }
                  : { borderColor: c.color, color: c.color }
              }
              onClick={() => toggleCategory(c.id)}
            >
              {c.label.length > 22 ? `${c.label.slice(0, 20)}…` : c.label}
            </button>
          ))}
        </div>

        <p className="field-label">Kelas keterjangkauan</p>
        <div className="chips">
          {(Object.keys(ACCESS_META) as AccessClass[]).map((a) => (
            <button
              key={a}
              type="button"
              title={ACCESS_META[a].desc}
              className={`chip${filters.access.includes(a) ? ' on' : ''}`}
              style={
                filters.access.includes(a)
                  ? { background: ACCESS_META[a].color, borderColor: ACCESS_META[a].color, color: '#fff' }
                  : { borderColor: ACCESS_META[a].color, color: ACCESS_META[a].color }
              }
              onClick={() => toggleAccess(a)}
            >
              {ACCESS_META[a].label}
            </button>
          ))}
        </div>

        <p className="field-label">
          Jarak maksimal ke simpul: <b>{formatDistance(filters.maxDistanceM)}</b>
        </p>
        <input
          className="slider"
          type="range"
          min={200}
          max={40000}
          step={200}
          value={filters.maxDistanceM}
          onChange={(e) => setFilters({ ...filters, maxDistanceM: Number(e.target.value) })}
        />

        <p className="field-label">
          Simpul transit terdekat · {REGION_LABEL[dataset.region]}
        </p>
        <select
          className="select"
          value={filters.nodeId ?? ''}
          onChange={(e) => setFilters({ ...filters, nodeId: e.target.value || null })}
        >
          <option value="">Semua simpul</option>
          {nodeStats.map((n) => (
            <option key={n.node.id} value={n.node.id}>
              {n.node.name} · denyut {n.pulseIndex}
            </option>
          ))}
        </select>

        <label className="switch" title={dataset.highlight.hint}>
          <input
            type="checkbox"
            checked={filters.onlyHighlighted}
            onChange={(e) => setFilters({ ...filters, onlyHighlighted: e.target.checked })}
          />
          <span>Hanya: {dataset.highlight.label}</span>
        </label>
      </section>
    </div>
  )
}
