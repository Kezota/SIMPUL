import { useEffect, useMemo, useState } from 'react'

import logoImg from '../assets/logo.jpeg'
import type { BasemapVariant } from '../lib/basemap'
import { buildModel, BUNDLED_SOURCES, REGIONS } from './engine'
import { loadActivities, type ActivityFeed } from './mapidApi'
import { buildRecommendations, type Recommendation } from './recommend'
import SimpulMap, { type MapMode } from './SimpulMap'
import TimeSlider from './TimeSlider'
import { SimpulAssistantPanel, SimpulMethodPanel, RecPanel } from './panels'
import type { BlockId } from './timeblocks'
import type { RegionId } from '../lib/types'
import type { SimpulAnswer } from './assistant'

type Tab = 'rekomendasi' | 'ai' | 'metode'

const TABS: { id: Tab; label: string }[] = [
  { id: 'rekomendasi', label: 'Rekomendasi' },
  { id: 'ai', label: 'Tanya AI' },
  { id: 'metode', label: 'Metode' },
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

export default function SimpulApp({ onOpenExplorer }: { onOpenExplorer: () => void }) {
  // Seluruh model dihitung sekali di muka: bukti → sel×blok → kelas → gap.
  const [regionId, setRegionId] = useState<RegionId>('jabodetabek')
  // Laporan warga ditarik live dari API Activities MAPID per wilayah (snapshot bila gagal).
  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  const regionBbox = REGIONS[regionId].bbox
  useEffect(() => {
    const ac = new AbortController()
    loadActivities(regionBbox, ac.signal)
      .then((f) => setFeed(f))
      .catch(() => {
        /* dibatalkan karena wilayah berganti — abaikan */
      })
    return () => ac.abort()
  }, [regionBbox])
  // Feed wilayah lama tidak dipakai untuk wilayah baru; selama memuat model dibangun tanpa aktivitas.
  const regionFeed = feed && feed.bboxKey === regionBbox.join(',') ? feed : null
  const feedStatus = regionFeed ? regionFeed.status : 'memuat'
  // Seluruh model dihitung ulang saat wilayah/feed berganti: bukti → sel×blok → kelas → gap.
  const model = useMemo(
    () =>
      buildModel(
        regionId,
        regionFeed
          ? { ...BUNDLED_SOURCES, activities: regionFeed.items, activitiesNote: regionFeed.note }
          : BUNDLED_SOURCES,
      ),
    [regionId, regionFeed],
  )
  const recs = useMemo(() => buildRecommendations(model), [model])

  const [block, setBlock] = useState<BlockId>('pagi')
  const [mode, setMode] = useState<MapMode>('denyut')
  const [showAccess, setShowAccess] = useState(false)
  const [showRail, setShowRail] = useState(true)
  const [showStops, setShowStops] = useState(true)
  const [satellite, setSatellite] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [focus, setFocus] = useState<
    { lat: number; lon: number; zoom: number; nonce: number } | null
  >(null)
  const [tab, setTab] = useState<Tab>('rekomendasi')
  const [activeRecId, setActiveRecId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

  const isMobile = useIsMobile()

  const variant: BasemapVariant = satellite ? 'satellite' : theme

  const flyTo = (lat: number, lon: number, zoom: number) =>
    setFocus((prev) => ({ lat, lon, zoom, nonce: (prev?.nonce ?? 0) + 1 }))

  const changeBlock = (b: BlockId) => {
    setBlock(b)
    setHintDismissed(true) // begitu slider disentuh, petunjuknya sudah tersampaikan
  }

  /** Dipakai oleh kartu rekomendasi DAN marker bernomor di peta. */
  const focusRec = (r: Recommendation) => {
    setMode('gap') // rekomendasi adalah cerita kesenjangan — peta ikut bercerita
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
            activeRecId={activeRecId}
            onSetBlock={changeBlock}
            onFocus={focusRec}
          />
        )
      case 'ai':
        return <SimpulAssistantPanel model={model} recs={recs} onApply={applyAnswer} />
      case 'metode':
        return <SimpulMethodPanel model={model} />
    }
  }

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`} data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <img src={logoImg} alt="SIMPUL Logo" className="brand-mark simpul-mark" />
          <div>
            <h1>SIMPUL</h1>
            <p>Lihat kapan kota hidup — dan di mana transportasinya belum hadir</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="data-note" title={model.sources.join(' · ')}>
            <i className={`feed-status feed-${feedStatus}`} aria-label={`Community Maps: ${feedStatus}`} />
            {feedStatus === 'memuat'
              ? 'memuat Community Maps…'
              : `${model.counts.activities.toLocaleString('id-ID')} laporan warga${feedStatus === 'live' ? ' (live)' : feedStatus === 'snapshot' ? ' (snapshot)' : ''}`}{' '}
            · {model.nodes.length} stasiun · {model.stops.length.toLocaleString('id-ID')} halte
          </span>
          <button type="button" className="btn ghost" onClick={onOpenExplorer}>
            Eksplorasi Data
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Ganti terang/gelap"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="layout layout-simpul">
        <section className="map-area">
          <SimpulMap
            model={model}
            recs={recs}
            block={block}
            mode={mode}
            showAccess={showAccess}
            showRail={showRail}
            showStops={showStops}
            region={model.region}
            variant={variant}
            focus={focus}
            onRecClick={onRecMarkerClick}
          />

          {/* Pemilih cerita: satu layar satu cerita */}
          <div className="mode-switch" role="group" aria-label="Pilih tampilan">
            <button
              type="button"
              className={mode === 'denyut' ? 'on' : undefined}
              onClick={() => setMode('denyut')}
            >
              🔥 Denyut
            </button>
            <button
              type="button"
              className={mode === 'gap' ? 'on' : undefined}
              onClick={() => setMode('gap')}
            >
              🚨 Kesenjangan
            </button>
            <span className="mode-sep" aria-hidden="true" />
            <select
              className="region-select"
              aria-label="Wilayah studi"
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value as RegionId)
                setActiveRecId(null)
                setHintDismissed(true)
              }}
            >
              {Object.values(REGIONS).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="mode-sep" aria-hidden="true" />
            <button
              type="button"
              className={`icon-chip${showStops ? ' on' : ''}`}
              onClick={() => setShowStops(!showStops)}
              title="Halte TransJakarta & JakLingko (GTFS resmi) — klik titik untuk keberangkatan per blok"
            >
              🚌
            </button>
            <button
              type="button"
              className={`icon-chip${showRail ? ' on' : ''}`}
              onClick={() => setShowRail(!showRail)}
              title="Jalur rel (geometri asli OpenStreetMap) — garis putus merah = Whoosh"
            >
              🛤
            </button>
            <button
              type="button"
              className={`icon-chip${satellite ? ' on' : ''}`}
              onClick={() => setSatellite(!satellite)}
              title="Citra satelit (MAPID MAPS bila key tersedia; cadangan Esri World Imagery)"
            >
              🛰
            </button>
            <button
              type="button"
              className={`icon-chip${showAccess ? ' on purple' : ''}`}
              onClick={() => setShowAccess(!showAccess)}
              title="Pin aksesibilitas — bukti konsep, 3 titik dinilai manual dari foto"
            >
              ♿
            </button>
          </div>

          {/* Legenda ringkas, ikut mode */}
          <div className="simpul-legend-card">
            {mode === 'denyut' ? (
              <>
                <div className="ramp-bar" />
                <div className="ramp-labels">
                  <span>sepi</span>
                  <span>ramai</span>
                </div>
                <small>
                  Dari jauh: permukaan panas. Perbesar untuk melihat per kawasan.
                  Tanpa warna = <b>Tidak Ada Data</b> (bukan sepi — tidak ada perkiraan)
                </small>
              </>
            ) : (
              <>
                <div className="gap-legend-row">
                  <i style={{ background: '#dc2626' }} /> Ramai, jauh dari semua simpul
                </div>
                <div className="gap-legend-row">
                  <i style={{ background: '#f97316' }} /> Ramai, jadwal menipis
                </div>
                <small>
                  Nomor di peta = nomor kandidat di panel. Angka di stasiun = keberangkatan
                  terjadwal pada blok ini (Gapeka/headway resmi).
                </small>
              </>
            )}
          </div>

          {!hintDismissed && (
            <button
              type="button"
              className="coach-mark"
              onClick={() => setHintDismissed(true)}
            >
              👋 Geser waktunya — lihat kota bernapas. <u>Oke, paham</u>
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
    </div>
  )
}
