import { useEffect, useMemo, useState } from 'react'

import logoImg from './assets/logo.jpeg'
import type { BasemapVariant } from './lib/basemap'
import { buildModel } from './lib/engine'
import Guide from './components/Guide'
import { guideSeen, markGuideSeen } from './lib/guideStorage'
import { loadActivities, type ActivityFeed } from './lib/mapidApi'
import { buildRecommendations, type Recommendation } from './lib/recommend'
import MapView, { type MapMode } from './components/MapView'
import TimeSlider from './components/TimeSlider'
import AssistantPanel from './components/AssistantPanel'
import MethodPanel from './components/MethodPanel'
import RecPanel from './components/RecPanel'
import type { BlockId } from './lib/timeblocks'
import type { SimpulAnswer } from './lib/assistant'

import './App.css'

type Tab = 'rekomendasi' | 'ai' | 'metode'

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'rekomendasi', label: 'Kandidat', hint: 'Daftar kawasan yang perlu ditindaklanjuti' },
  { id: 'ai', label: 'Tanya', hint: 'Tanya dalam bahasa biasa, peta ikut bergerak' },
  { id: 'metode', label: 'Metode', hint: 'Dari mana angkanya, dan apa batasnya' },
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
  // Laporan warga ditarik live dari API MAPID lewat /api/activities (snapshot bila gagal).
  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  useEffect(() => {
    const ac = new AbortController()
    loadActivities(buildModel().region.bbox, ac.signal)
      .then(setFeed)
      .catch(() => {
        /* dibatalkan saat komponen dilepas — abaikan */
      })
    return () => ac.abort()
  }, [])
  const feedStatus = feed ? feed.status : 'memuat'

  // Seluruh model dihitung ulang saat feed tiba: bukti → sel×blok → kelas → gap.
  const model = useMemo(() => buildModel(feed?.items ?? [], feed?.note), [feed])
  const recs = useMemo(() => buildRecommendations(model), [model])

  const [block, setBlock] = useState<BlockId>('sore')
  const [mode, setMode] = useState<MapMode>('denyut')
  const [showRail, setShowRail] = useState(true)
  const [showStops, setShowStops] = useState(true)
  const [satellite, setSatellite] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom: number; nonce: number } | null>(null)
  const [tab, setTab] = useState<Tab>('rekomendasi')
  const [activeRecId, setActiveRecId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen())

  const isMobile = useIsMobile()
  const variant: BasemapVariant = satellite ? 'satellite' : theme

  const closeGuide = () => {
    markGuideSeen()
    setGuideOpen(false)
  }

  const flyTo = (lat: number, lon: number, zoom: number) =>
    setFocus((prev) => ({ lat, lon, zoom, nonce: (prev?.nonce ?? 0) + 1 }))

  const changeBlock = (b: BlockId) => {
    setBlock(b)
    setHintDismissed(true)
  }

  /** Dipakai oleh kartu kandidat DAN marker bernomor di peta. */
  const focusRec = (r: Recommendation) => {
    setMode('gap')
    if (r.block) setBlock(r.block)
    flyTo(r.focus.lat, r.focus.lon, r.focus.zoom)
    setActiveRecId(r.id)
    setHintDismissed(true)
  }

  const onRecMarkerClick = (r: Recommendation) => {
    focusRec(r)
    setTab('rekomendasi')
    if (isMobile) setSheetOpen(true)
  }

  const applyAnswer = (a: SimpulAnswer) => {
    if (a.setBlock) setBlock(a.setBlock)
    if (a.focus) flyTo(a.focus.lat, a.focus.lon, a.focus.zoom)
    setHintDismissed(true)
  }

  const panelFor = (t: Tab) => {
    switch (t) {
      case 'rekomendasi':
        return (
          <RecPanel
            model={model}
            recs={recs}
            block={block}
            mode={mode}
            loading={feedStatus === 'memuat'}
            activeRecId={activeRecId}
            onSetBlock={changeBlock}
            onFocus={focusRec}
            onShowGap={() => setMode('gap')}
          />
        )
      case 'ai':
        return <AssistantPanel model={model} recs={recs} onApply={applyAnswer} />
      case 'metode':
        return <MethodPanel model={model} feedStatus={feedStatus} />
    }
  }

  const feedLabel =
    feedStatus === 'memuat'
      ? 'memuat laporan warga…'
      : `${model.counts.activities.toLocaleString('id-ID')} laporan warga${
          feedStatus === 'live' ? ' · live' : feedStatus === 'snapshot' ? ' · snapshot' : ''
        }`

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`} data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <img src={logoImg} alt="SIMPUL Logo" className="brand-mark simpul-mark" />
          <div>
            <h1>SIMPUL</h1>
            <p>Kapan kota hidup — dan apakah transportasi massalnya hadir pada jam itu</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="data-note" title={model.sources.join('\n')}>
            <i className={`feed-status feed-${feedStatus}`} aria-hidden="true" />
            {feedLabel} · {model.nodes.length} stasiun · {model.stops.length.toLocaleString('id-ID')} halte
          </span>
          <button type="button" className="btn ghost btn-guide" onClick={() => setGuideOpen(true)} aria-label="Cara pakai">
            ? <span className="btn-txt">Cara pakai</span>
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Ganti terang/gelap"
            aria-label="Ganti tema terang/gelap"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="layout layout-simpul">
        <section className="map-area">
          <MapView
            model={model}
            recs={recs}
            block={block}
            mode={mode}
            showRail={showRail}
            showStops={showStops}
            variant={variant}
            focus={focus}
            onRecClick={onRecMarkerClick}
          />

          {/* Kontrol peta: dua kelompok berlabel supaya jelas mana "cerita" dan mana "lapisan". */}
          <div className="map-tools">
            <div className="tool-group" role="group" aria-label="Tampilan peta">
              <span className="tool-caption">Tampilan</span>
              <div className="tool-row mode-switch">
                <button
                  type="button"
                  className={mode === 'denyut' ? 'on' : undefined}
                  onClick={() => setMode('denyut')}
                  title="Seberapa hidup tiap kawasan pada blok waktu ini"
                >
                  🔥 Denyut
                </button>
                <button
                  type="button"
                  className={mode === 'gap' ? 'on' : undefined}
                  onClick={() => setMode('gap')}
                  title="Kawasan ramai yang layanan transitnya kurang"
                >
                  🚨 Kesenjangan
                </button>
              </div>
            </div>
            <div className="tool-group" role="group" aria-label="Lapisan peta">
              <span className="tool-caption">Lapisan</span>
              <div className="tool-row">
                <button
                  type="button"
                  className={`chip-toggle${showStops ? ' on' : ''}`}
                  aria-pressed={showStops}
                  onClick={() => setShowStops(!showStops)}
                  title="7.814 halte TransJakarta & JakLingko (GTFS resmi) — klik titiknya untuk keberangkatan per blok"
                >
                  <span className="chip-ico" aria-hidden="true">🚌</span>
                  <span className="chip-txt">Halte bus</span>
                </button>
                <button
                  type="button"
                  className={`chip-toggle${showRail ? ' on' : ''}`}
                  aria-pressed={showRail}
                  onClick={() => setShowRail(!showRail)}
                  title="Jalur KRL/MRT/LRT/Whoosh (geometri OpenStreetMap)"
                >
                  <span className="chip-ico" aria-hidden="true">🛤</span>
                  <span className="chip-txt">Jalur rel</span>
                </button>
                <button
                  type="button"
                  className={`chip-toggle${satellite ? ' on' : ''}`}
                  aria-pressed={satellite}
                  onClick={() => setSatellite(!satellite)}
                  title="Citra satelit (MAPID MAPS)"
                >
                  <span className="chip-ico" aria-hidden="true">🛰</span>
                  <span className="chip-txt">Satelit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Legenda ringkas, ikut mode */}
          <div className="simpul-legend-card">
            {mode === 'denyut' ? (
              <>
                <b className="legend-title">Denyut · seberapa hidup kawasan</b>
                <div className="ramp-bar" />
                <div className="ramp-labels">
                  <span>sepi</span>
                  <span>ramai</span>
                </div>
                <small>
                  Dari laporan lapangan warga pada blok waktu ini. Perbesar untuk melihat per kawasan.
                  Tanpa warna = <b>tidak ada data</b> (bukan sepi — SIMPUL tidak menebak).
                </small>
              </>
            ) : (
              <>
                <b className="legend-title">Kesenjangan · ramai tapi layanan kurang</b>
                <div className="gap-legend-row">
                  <i style={{ background: '#dc2626' }} /> Tak terjangkau — tidak ada stasiun/halte dalam 1 km
                </div>
                <div className="gap-legend-row">
                  <i style={{ background: '#f97316' }} /> Frekuensi rendah — ada layanan, jadwalnya tipis
                </div>
                <small>
                  Nomor di peta = nomor kandidat di panel. Angka di stasiun = keberangkatan terjadwal pada
                  blok ini.
                </small>
              </>
            )}
          </div>

          {!hintDismissed && !guideOpen && (
            <button type="button" className="coach-mark" onClick={() => setHintDismissed(true)}>
              👋 Geser blok waktu di bawah — lihat kota bernapas. <u>Oke</u>
            </button>
          )}

          <TimeSlider block={block} onChange={changeBlock} />
        </section>

        {!isMobile && (
          <aside className="rail rail-right">
            <nav className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? 'on' : undefined}
                  title={t.hint}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.id === 'rekomendasi' && recs.length > 0 && <span className="tab-count">{recs.length}</span>}
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
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={sheetOpen && tab === t.id ? 'on' : undefined}
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

      {guideOpen && <Guide onClose={closeGuide} />}
    </div>
  )
}
