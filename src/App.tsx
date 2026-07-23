import { useEffect, useMemo, useState } from 'react'

import MapView, { type LayerVisibility } from './components/MapView'
import ControlPanel from './components/ControlPanel'
import InsightPanel from './components/InsightPanel'
import AIAssistant from './components/AIAssistant'
import DetailPanel from './components/DetailPanel'
import MethodPanel from './components/MethodPanel'
import DataTable from './components/DataTable'

import {
  applyFilters,
  computeInsights,
  computeNodeStats,
  loadActivities,
} from './lib/analysis'
import type { BasemapVariant } from './lib/basemap'
import type { Filters } from './lib/types'
import './webgis.css'

const INITIAL_FILTERS: Filters = {
  themes: [],
  access: [],
  onlyComplaints: false,
  maxDistanceM: 20000,
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
  // Pipeline dijalankan sekali: cleaning -> enrichment -> spatial join -> indexing.
  const { activities, dropped } = useMemo(() => loadActivities(), [])
  const nodeStats = useMemo(() => computeNodeStats(activities), [activities])
  const insights = useMemo(
    () => computeInsights(activities, nodeStats),
    [activities, nodeStats],
  )

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [layers, setLayers] = useState<LayerVisibility>({
    activities: true,
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

  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters])

  const selected = useMemo(
    () => activities.find((a) => a.id === selectedId) ?? null,
    [activities, selectedId],
  )
  const selectedNode = useMemo(
    () => nodeStats.find((n) => n.node.id === selectedNodeId) ?? null,
    [nodeStats, selectedNodeId],
  )

  const flyTo = (lat: number, lon: number, zoom: number) =>
    setFocus({ lat, lon, zoom, nonce: performance.now() })

  const openTab = (t: Tab) => {
    setTab(t)
    if (isMobile) setSheetOpen(true)
  }

  const selectActivity = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    setSelectedNodeId(null)
    const a = activities.find((x) => x.id === id)
    if (a) flyTo(a.lat, a.lon, 14)
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
    setSelectedNodeId(nodeId)
    flyTo(n.node.lat, n.node.lon, 14)
  }

  const panelFor = (t: Tab) => {
    switch (t) {
      case 'insight':
        return (
          <InsightPanel
            insights={insights}
            nodeStats={nodeStats}
            onFocusNode={focusNode}
            activeNodeId={selectedNodeId}
          />
        )
      case 'ai':
        return (
          <AIAssistant
            activities={activities}
            nodeStats={nodeStats}
            insights={insights}
            filters={filters}
            onApply={(patch, f) => {
              setFilters({ ...INITIAL_FILTERS, ...patch })
              if (f) flyTo(f.lat, f.lon, f.zoom)
            }}
          />
        )
      case 'detail':
        return (
          <DetailPanel
            activity={selected}
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
        return <MethodPanel />
      case 'kontrol':
        return (
          <ControlPanel
            filters={filters}
            setFilters={setFilters}
            layers={layers}
            setLayers={setLayers}
            nodeStats={nodeStats}
            filtered={filtered}
            total={activities.length}
          />
        )
      case 'tabel':
        return <DataTable rows={filtered} selectedId={selectedId} onSelect={selectActivity} />
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
              Apa yang sebenarnya hidup di sekitar stasiun &amp; terminal Bandung Raya —
              dibaca dari laporan warga
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="data-note" title={`${dropped} baris dibuang saat cleaning`}>
            {activities.length} laporan · {nodeStats.length} simpul
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setVariant(variant === 'light' ? 'dark' : 'light')}
          >
            {variant === 'light' ? '🌙' : '☀️'} Basemap
          </button>
        </div>
      </header>

      <main className="layout">
        {!isMobile && (
          <aside className="rail rail-left">
            <div className="rail-body">
              <ControlPanel
                filters={filters}
                setFilters={setFilters}
                layers={layers}
                setLayers={setLayers}
                nodeStats={nodeStats}
                filtered={filtered}
                total={activities.length}
              />
            </div>
          </aside>
        )}

        <section className="map-area">
          <MapView
            activities={filtered}
            nodeStats={nodeStats}
            layers={layers}
            variant={variant}
            selectedId={selectedId}
            focus={focus}
            onSelect={selectActivity}
            onSelectNode={selectNode}
          />

          <div className="map-legend">
            <b>Legenda</b>
            <ul>
              <li>
                <i className="lg-dot" /> laporan warga — warna = tema hasil klasifikasi
              </li>
              <li>
                <i className="lg-ring" /> cincin merah = bernada keluhan
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
                <DataTable rows={filtered} selectedId={selectedId} onSelect={selectActivity} />
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
