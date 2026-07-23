import { useEffect, useMemo, useState } from 'react'

import MapView, { type LayerVisibility } from './components/MapView'
import ControlPanel from './components/ControlPanel'
import InsightPanel from './components/InsightPanel'
import AIAssistant from './components/AIAssistant'
import DetailPanel from './components/DetailPanel'
import MethodPanel from './components/MethodPanel'
import DataTable from './components/DataTable'

import { DATASETS } from './data/datasets'
import { REGION_LABEL } from './data/transitNodes'
import {
  applyFilters,
  computeInsights,
  computeNodeStats,
  loadDataset,
} from './lib/analysis'
import type { BasemapVariant } from './lib/basemap'
import type { DatasetId, Filters } from './lib/types'
import './webgis.css'

const INITIAL_FILTERS: Filters = {
  categories: [],
  access: [],
  onlyHighlighted: false,
  maxDistanceM: 40000,
  search: '',
  nodeId: null,
}

type Tab = 'insight' | 'ai' | 'detail' | 'metode' | 'kontrol' | 'tabel'

const DESKTOP_TABS: { id: Tab; label: string }[] = [
  { id: 'insight', label: 'Insight' },
  { id: 'ai', label: 'AI' },
  { id: 'detail', label: 'Detail' },
  { id: 'metode', label: 'Metode' },
]

const MOBILE_TABS: { id: Tab; label: string }[] = [
  { id: 'kontrol', label: 'Kontrol' },
  ...DESKTOP_TABS,
  { id: 'tabel', label: 'Tabel' },
]

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 980px)')
    const on = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export default function App() {
  const [datasetId, setDatasetId] = useState<DatasetId>('community')

  // Seluruh pipeline dijalankan ulang tiap dataset berganti:
  // adapter -> cleaning -> enrichment -> spatial join -> indexing.
  const loaded = useMemo(() => loadDataset(datasetId), [datasetId])
  const { dataset, observations, nodes, dropped, notes } = loaded

  const nodeStats = useMemo(
    () => computeNodeStats(observations, nodes),
    [observations, nodes],
  )
  const insights = useMemo(
    () => computeInsights(observations, nodeStats),
    [observations, nodeStats],
  )

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [layers, setLayers] = useState<LayerVisibility>({
    points: true,
    heatmap: true,
    nodes: true,
    radius: true,
    links: false,
  })
  const [variant, setVariant] = useState<BasemapVariant>('light')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [focus, setFocus] = useState<
    { lat: number; lon: number; zoom: number; nonce: number } | null
  >(null)
  const [tab, setTab] = useState<Tab>('insight')
  const [tableOpen, setTableOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const isMobile = useIsMobile()

  const filtered = useMemo(
    () => applyFilters(observations, filters),
    [observations, filters],
  )

  const selected = useMemo(
    () => observations.find((o) => o.id === selectedId) ?? null,
    [observations, selectedId],
  )
  const selectedNode = useMemo(
    () => nodeStats.find((n) => n.node.id === selectedNodeId) ?? null,
    [nodeStats, selectedNodeId],
  )

  // nonce = penghitung naik, supaya terbang ke koordinat yang SAMA dua kali
  // tetap memicu efek di MapView. Sengaja bukan timestamp: nilai jam bukan
  // fungsi murni dan membuat render tidak deterministik.
  const flyTo = (lat: number, lon: number, zoom: number) =>
    setFocus((prev) => ({ lat, lon, zoom, nonce: (prev?.nonce ?? 0) + 1 }))

  /** Ganti dataset: filter & seleksi lama tidak berlaku (kategorinya beda). */
  const switchDataset = (id: DatasetId) => {
    if (id === datasetId) return
    setDatasetId(id)
    setFilters(INITIAL_FILTERS)
    setSelectedId(null)
    setSelectedNodeId(null)
    setFocus(null)
  }

  const openTab = (t: Tab) => {
    setTab(t)
    if (isMobile) setSheetOpen(true)
  }

  const selectObservation = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    setSelectedNodeId(null)
    const o = observations.find((x) => x.id === id)
    if (o) flyTo(o.lat, o.lon, 15)
    openTab('detail')
  }

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setSelectedId(null)
    const n = nodeStats.find((x) => x.node.id === nodeId)
    if (n) flyTo(n.node.lat, n.node.lon, 14)
    openTab('detail')
  }

  const focusNode = (nodeId: string) => {
    const n = nodeStats.find((x) => x.node.id === nodeId)
    if (!n) return
    setSelectedNodeId(n.node.id)
    flyTo(n.node.lat, n.node.lon, 14)
  }

  const controlPanel = (
    <ControlPanel
      dataset={dataset}
      filters={filters}
      setFilters={setFilters}
      layers={layers}
      setLayers={setLayers}
      nodeStats={nodeStats}
      filtered={filtered}
      total={observations.length}
    />
  )

  const panelFor = (t: Tab) => {
    switch (t) {
      case 'insight':
        return (
          <InsightPanel
            dataset={dataset}
            insights={insights}
            nodeStats={nodeStats}
            onFocusNode={focusNode}
            activeNodeId={selectedNodeId}
          />
        )
      case 'ai':
        return (
          <AIAssistant
            key={dataset.id}
            ctx={{ dataset, observations, nodeStats, insights }}
            onApply={(patch, f) => {
              setFilters({ ...INITIAL_FILTERS, ...patch })
              if (f) flyTo(f.lat, f.lon, f.zoom)
            }}
          />
        )
      case 'detail':
        return (
          <DetailPanel
            dataset={dataset}
            observation={selected}
            node={selectedNode}
            onClear={() => {
              setSelectedId(null)
              setSelectedNodeId(null)
            }}
            onFilterNode={(id) => {
              setFilters({ ...filters, nodeId: id })
              focusNode(id)
            }}
          />
        )
      case 'metode':
        return <MethodPanel dataset={dataset} notes={notes} dropped={dropped} />
      case 'kontrol':
        return controlPanel
      case 'tabel':
        return (
          <DataTable
            dataset={dataset}
            rows={filtered}
            selectedId={selectedId}
            onSelect={selectObservation}
          />
        )
    }
  }

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`} data-theme={variant}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Denyut Simpul</h1>
            <p>
              Apa yang sebenarnya hidup di sekitar stasiun &amp; terminal — dibaca dari
              data lapangan MAPID
            </p>
          </div>
        </div>

        <nav className="dataset-switch" aria-label="Pilih dataset">
          {DATASETS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === datasetId ? 'on' : undefined}
              title={`${d.blurb} — ${d.source}`}
              onClick={() => switchDataset(d.id)}
            >
              {d.short}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <span className="data-note" title={`${dropped} baris dibuang saat cleaning`}>
            {observations.length} titik · {nodes.length} simpul ·{' '}
            {REGION_LABEL[dataset.region]}
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setVariant(variant === 'light' ? 'dark' : 'light')}
          >
            {variant === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="layout">
        {!isMobile && (
          <aside className="rail rail-left">
            <div className="rail-body">{controlPanel}</div>
          </aside>
        )}

        <section className="map-area">
          <MapView
            dataset={dataset}
            observations={filtered}
            allObservations={observations}
            nodeStats={nodeStats}
            layers={layers}
            variant={variant}
            selectedId={selectedId}
            focus={focus}
            onSelect={selectObservation}
            onSelectNode={selectNode}
          />

          <div className="map-legend">
            <b>Legenda · {dataset.label}</b>
            <ul>
              <li>
                <i className="lg-dot" /> titik data — warna = kategori
              </li>
              <li>
                <i className="lg-ring" /> cincin gelap = {dataset.highlight.label.toLowerCase()}
              </li>
              <li>
                <i className="lg-circle" /> lingkaran putus-putus = radius layanan 1 km
              </li>
            </ul>
          </div>

          {!isMobile && (
            <div className={`table-drawer${tableOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="drawer-handle"
                onClick={() => setTableOpen(!tableOpen)}
              >
                Tabel Atribut · {filtered.length} baris <span>{tableOpen ? '▾' : '▴'}</span>
              </button>
              {tableOpen && (
                <DataTable
                  dataset={dataset}
                  rows={filtered}
                  selectedId={selectedId}
                  onSelect={selectObservation}
                />
              )}
            </div>
          )}
        </section>

        {!isMobile && (
          <aside className="rail rail-right">
            <nav className="tabs">
              {DESKTOP_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? 'on' : undefined}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="rail-body">{panelFor(tab)}</div>
          </aside>
        )}
      </main>

      {isMobile && (
        <div className={`sheet${sheetOpen ? ' open' : ''}`}>
          <nav className="tabs">
            {MOBILE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id && sheetOpen ? 'on' : undefined}
                onClick={() => {
                  if (tab === t.id && sheetOpen) setSheetOpen(false)
                  else {
                    setTab(t.id)
                    setSheetOpen(true)
                  }
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {sheetOpen && <div className="sheet-body">{panelFor(tab)}</div>}
        </div>
      )}
    </div>
  )
}
