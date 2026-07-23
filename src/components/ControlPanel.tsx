import { ACCESS_META } from '../lib/analysis'
import { THEMES } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import { BASEMAP_NOTE, usingMapidBasemap } from '../lib/basemap'
import type { AccessClass, Activity, Filters, NodeStats, ThemeId } from '../lib/types'
import type { LayerVisibility } from './MapView'

interface Props {
  filters: Filters
  setFilters: (f: Filters) => void
  layers: LayerVisibility
  setLayers: (l: LayerVisibility) => void
  nodeStats: NodeStats[]
  filtered: Activity[]
  total: number
}

const LAYER_META: { key: keyof LayerVisibility; label: string; desc: string }[] = [
  { key: 'activities', label: 'Aktivitas warga', desc: 'Titik Community Maps, diwarnai per tema' },
  { key: 'heatmap', label: 'Kepadatan (heatmap)', desc: 'Dibobot relevansi transit; hilang saat zoom dalam' },
  { key: 'nodes', label: 'Simpul transit', desc: 'Stasiun & terminal + jumlah laporan' },
  { key: 'radius', label: 'Radius layanan 1 km', desc: 'Buffer catchment pejalan kaki' },
  { key: 'links', label: 'Garis ke simpul terdekat', desc: 'Merah = di luar 2 km' },
]

export default function ControlPanel({
  filters,
  setFilters,
  layers,
  setLayers,
  nodeStats,
  filtered,
  total,
}: Props) {
  const toggleTheme = (t: ThemeId) =>
    setFilters({
      ...filters,
      themes: filters.themes.includes(t)
        ? filters.themes.filter((x) => x !== t)
        : [...filters.themes, t],
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
      themes: [],
      access: [],
      onlyComplaints: false,
      maxDistanceM: 20000,
      search: '',
      nodeId: null,
    })

  const dirty =
    filters.themes.length > 0 ||
    filters.access.length > 0 ||
    filters.onlyComplaints ||
    filters.maxDistanceM < 20000 ||
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
          placeholder="Cari judul, deskripsi, atau tag…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <p className="field-label">Tema (hasil klasifikasi AI)</p>
        <div className="chips">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip${filters.themes.includes(t.id) ? ' on' : ''}`}
              style={
                filters.themes.includes(t.id)
                  ? { background: t.color, borderColor: t.color, color: '#fff' }
                  : { borderColor: t.color, color: t.color }
              }
              onClick={() => toggleTheme(t.id)}
            >
              {t.short}
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
          max={20000}
          step={100}
          value={filters.maxDistanceM}
          onChange={(e) => setFilters({ ...filters, maxDistanceM: Number(e.target.value) })}
        />

        <p className="field-label">Simpul transit terdekat</p>
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

        <label className="switch">
          <input
            type="checkbox"
            checked={filters.onlyComplaints}
            onChange={(e) => setFilters({ ...filters, onlyComplaints: e.target.checked })}
          />
          <span>Hanya laporan bernada keluhan</span>
        </label>
      </section>
    </div>
  )
}
