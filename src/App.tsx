import { useEffect, useMemo, useState } from 'react'

import logoImg from './assets/logo.jpeg'
import type { BasemapVariant } from './lib/basemap'
import { buildModel } from './lib/engine'
import Guide from './components/Guide'
import Login from './components/Login'
import LocationSearch, { type SearchHit } from './components/LocationSearch'
import { guideSeen, markGuideSeen } from './lib/guideStorage'
import { loadActivities, type ActivityFeed } from './lib/mapidApi'
import { buildRecommendations, type Recommendation } from './lib/recommend'
import { loadRole, saveRole, type Role } from './lib/roles'
import MapView, { type MapMode } from './components/MapView'
import TimeSlider from './components/TimeSlider'
import AssistantPanel from './components/AssistantPanel'
import MethodPanel from './components/MethodPanel'
import RecPanel from './components/RecPanel'
import StationDetail from './components/StationDetail'
import type { TransitNode } from './lib/types'
import type { BlockId } from './lib/timeblocks'
import type { AssistantResult } from './lib/aiRun'

import './App.css'

type Tab = 'rekomendasi' | 'ai' | 'metode'

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'rekomendasi', label: 'Kandidat', hint: 'Daftar kawasan yang perlu ditinjau' },
  { id: 'ai', label: 'Tanya AI', hint: 'Tanya dalam bahasa biasa, peta ikut bergerak' },
  { id: 'metode', label: 'Metode & data', hint: 'Dari mana angkanya, dan apa batasnya' },
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
  // Login dummy berbasis peran — hanya mengubah sudut pandang tampilan.
  const [role, setRole] = useState<Role | null>(() => loadRole())

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
  const [mode, setMode] = useState<MapMode>(role?.defaultMode ?? 'denyut')
  const [showKrl, setShowKrl] = useState(role?.defaultRail ?? true)
  const [showMrt, setShowMrt] = useState(role?.defaultRail ?? true)
  const [showLrt, setShowLrt] = useState(role?.defaultRail ?? true)
  const [detailNode, setDetailNode] = useState<TransitNode | null>(null)
  const [showTjRoutes, setShowTjRoutes] = useState(role?.defaultTj ?? false)
  const [showTjStops, setShowTjStops] = useState(role?.defaultTj ?? false)
  const [showJak, setShowJak] = useState(role?.defaultJak ?? false)
  const [satellite, setSatellite] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom: number; nonce: number } | null>(null)
  const [pin, setPin] = useState<{ lat: number; lon: number; label: string } | null>(null)
  const [tab, setTab] = useState<Tab>('rekomendasi')
  const [activeRecId, setActiveRecId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen())

  const isMobile = useIsMobile()
  const variant: BasemapVariant = satellite ? 'satellite' : theme

  const enterAs = (r: Role) => {
    saveRole(r.id)
    setRole(r)
    setMode(r.defaultMode)
    setShowKrl(r.defaultRail)
    setShowMrt(r.defaultRail)
    setShowLrt(r.defaultRail)
    setShowTjRoutes(r.defaultTj)
    setShowTjStops(r.defaultTj)
    setShowJak(r.defaultJak)
    setTab('rekomendasi')
    setActiveRecId(null)
  }

  const logout = () => {
    saveRole(null)
    setRole(null)
  }

  const closeGuide = () => {
    markGuideSeen()
    setGuideOpen(false)
  }

  const flyTo = (lat: number, lon: number, zoom: number) =>
    setFocus((prev) => ({ lat, lon, zoom, nonce: (prev?.nonce ?? 0) + 1 }))

  const changeBlock = (b: BlockId) => {
    setBlock(b)
  }

  /** Dipakai oleh kartu kandidat DAN marker bernomor di peta. */
  const focusRec = (r: Recommendation) => {
    setMode('gap')
    if (r.block) setBlock(r.block)
    flyTo(r.focus.lat, r.focus.lon, r.focus.zoom)
    setActiveRecId(r.id)
    setPin(null)
  }

  const onRecMarkerClick = (r: Recommendation) => {
    focusRec(r)
    setTab('rekomendasi')
    if (isMobile) setSheetOpen(true)
  }

  const onSearchPick = (h: SearchHit) => {
    if (h.recId) {
      const r = recs.find((x) => x.id === h.recId)
      if (r) {
        focusRec(r)
        return
      }
    }
    flyTo(h.lat, h.lon, h.zoom)
    setPin({ lat: h.lat, lon: h.lon, label: h.label })
  }

  const applyAnswer = (a: AssistantResult) => {
    if (a.setBlock) setBlock(a.setBlock)
    if (a.setMode) setMode(a.setMode)
    if (a.activeRec) setActiveRecId(a.activeRec)
    if (a.focus) flyTo(a.focus.lat, a.focus.lon, a.focus.zoom)
  }

  if (!role) return <Login onEnter={enterAs} />

  const panelFor = (t: Tab) => {
    switch (t) {
      case 'rekomendasi':
        return (
          <RecPanel
            model={model}
            recs={recs}
            role={role}
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
        return <AssistantPanel model={model} recs={recs} role={role} block={block} mode={mode} onApply={applyAnswer} />
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

  const ownedCount = recs.filter(role.owns).length

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`} data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <img src={logoImg} alt="SIMPUL Logo" className="brand-mark simpul-mark" />
          <div>
            <h1>SIMPUL</h1>
            <p>Kawasan ramai vs. layanan transit, per blok waktu · Jabodetabek</p>
          </div>
        </div>
        {!isMobile && (
          <div className="topbar-search">
            <LocationSearch model={model} recs={recs} onPick={onSearchPick} onClear={() => setPin(null)} />
          </div>
        )}
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
          <button type="button" className="role-badge" onClick={logout} title="Klik untuk ganti peran">
            <span aria-hidden="true">{role.icon}</span>
            <span className="role-badge-txt">
              <b>{role.label}</b>
              <small>Ganti peran</small>
            </span>
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
            showKrl={showKrl}
            showMrt={showMrt}
            showLrt={showLrt}
            showTjRoutes={showTjRoutes}
            showTjStops={showTjStops}
            showJak={showJak}
            variant={variant}
            focus={focus}
            activeRecId={activeRecId}
            pin={pin}
            onRecClick={onRecMarkerClick}
            onNodeClick={setDetailNode}
          />

          {isMobile && (
            <div className="map-search">
              <LocationSearch model={model} recs={recs} onPick={onSearchPick} onClear={() => setPin(null)} />
            </div>
          )}

          <div className="map-top">
            {/* Kontrol peta: dua kelompok berlabel supaya jelas mana "cerita" dan mana "lapisan". */}
            <div className="map-tools">
              <div className="tool-group" role="group" aria-label="Tampilan peta">
                <span className="tool-caption">Tampilan</span>
                <div className="tool-row mode-switch">
                  <button
                    type="button"
                    className={mode === 'denyut' ? 'on' : undefined}
                    onClick={() => setMode('denyut')}
                    title="Seberapa ramai tiap kawasan pada blok waktu ini (dari laporan warga)"
                  >
                    🔥 Aktivitas warga
                  </button>
                  <button
                    type="button"
                    className={mode === 'gap' ? 'on' : undefined}
                    onClick={() => setMode('gap')}
                    title="Hanya kawasan ramai yang layanan transitnya kurang"
                  >
                    ⚠️ Kesenjangan
                  </button>
                </div>
              </div>
              <div className="tool-group" role="group" aria-label="Lapisan rel">
                <span className="tool-caption">Rel</span>
                <div className="tool-row">
                  <button
                    type="button"
                    className={`chip-toggle${showKrl ? ' on' : ''}`}
                    aria-pressed={showKrl}
                    onClick={() => setShowKrl(!showKrl)}
                    title="Stasiun & jalur KRL Commuter (juga Whoosh). Klik stasiun untuk jadwal per blok."
                  >
                    <span className="chip-ico dot-line" style={{ background: '#e11d2b' }} aria-hidden="true" />
                    <span className="chip-txt">KRL</span>
                  </button>
                  <button
                    type="button"
                    className={`chip-toggle${showMrt ? ' on' : ''}`}
                    aria-pressed={showMrt}
                    onClick={() => setShowMrt(!showMrt)}
                    title="Stasiun & jalur MRT Jakarta"
                  >
                    <span className="chip-ico dot-line" style={{ background: '#0d9488' }} aria-hidden="true" />
                    <span className="chip-txt">MRT</span>
                  </button>
                  <button
                    type="button"
                    className={`chip-toggle${showLrt ? ' on' : ''}`}
                    aria-pressed={showLrt}
                    onClick={() => setShowLrt(!showLrt)}
                    title="Stasiun & jalur LRT Jakarta dan LRT Jabodebek"
                  >
                    <span className="chip-ico dot-line" style={{ background: '#7c3aed' }} aria-hidden="true" />
                    <span className="chip-txt">LRT</span>
                  </button>
                </div>
              </div>
              <div className="tool-group" role="group" aria-label="Lapisan bus">
                <span className="tool-caption">Bus</span>
                <div className="tool-row">
                  <button
                    type="button"
                    className={`chip-toggle${showTjRoutes ? ' on' : ''}`}
                    aria-pressed={showTjRoutes}
                    onClick={() => setShowTjRoutes(!showTjRoutes)}
                    title="Garis koridor BRT TransJakarta 1–14 (GTFS resmi). Klik garisnya untuk nama koridor."
                  >
                    <span className="chip-ico line-ico" aria-hidden="true" />
                    <span className="chip-txt">Koridor TJ</span>
                  </button>
                  <button
                    type="button"
                    className={`chip-toggle${showTjStops ? ' on' : ''}`}
                    aria-pressed={showTjStops}
                    onClick={() => setShowTjStops(!showTjStops)}
                    title="Titik halte TransJakarta BRT & non-BRT. Klik haltenya untuk jumlah bus per blok."
                  >
                    <span className="chip-ico dot-tj" aria-hidden="true" />
                    <span className="chip-txt">Halte TJ</span>
                  </button>
                  <button
                    type="button"
                    className={`chip-toggle${showJak ? ' on' : ''}`}
                    aria-pressed={showJak}
                    onClick={() => setShowJak(!showJak)}
                    title="Halte JakLingko / Mikrotrans — ribuan titik, tampil saat peta diperbesar"
                  >
                    <span className="chip-ico dot-jak" aria-hidden="true" />
                    <span className="chip-txt">JakLingko</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Peta dasar bukan lapisan data — tombol terpisah di bawah kontrol zoom. */}
          <button
            type="button"
            className={`basemap-toggle${satellite ? ' on' : ''}`}
            aria-pressed={satellite}
            onClick={() => setSatellite(!satellite)}
            title={satellite ? 'Kembali ke peta jalan' : 'Ganti ke citra satelit (MAPID MAPS)'}
          >
            {satellite ? '🗺' : '🛰'}
            <span>{satellite ? 'Peta jalan' : 'Satelit'}</span>
          </button>

          {/* Legenda ringkas, ikut mode */}
          <div className="simpul-legend-card">
            {mode === 'denyut' ? (
              <>
                <b className="legend-title">Aktivitas warga · blok ini</b>
                <div className="ramp-bar" />
                <div className="ramp-labels">
                  <span>sepi</span>
                  <span>ramai</span>
                </div>
                <small>
                  Kuning = sedikit laporan, merah = paling ramai (relatif se-wilayah). Tanpa warna = <b>tidak ada data</b>, bukan sepi.
                </small>
              </>
            ) : (
              <>
                <b className="legend-title">Kesenjangan · ramai tapi layanan kurang</b>
                <div className="gap-legend-row" title="Kawasan ramai tanpa stasiun/halte dalam 1 km">
                  <i style={{ background: '#dc2626' }} /> Tak terjangkau (&gt; 1 km)
                </div>
                <div className="gap-legend-row" title="Kawasan ramai, ada layanan, tetapi jadwalnya tipis pada blok ini">
                  <i style={{ background: '#f97316' }} /> Frekuensi rendah
                </div>
                <div className="gap-legend-row" title="Ada laporan warga, tetapi tidak tergolong kesenjangan pada blok ini">
                  <i style={{ background: '#cbd5e1' }} /> Ada data, layanan cukup
                </div>
                <small>Nomor = kandidat di panel · garis putus biru = usulan rute pengumpan kandidat yang dipilih · klik stasiun/jalur untuk detail.</small>
              </>
            )}
            {(showKrl || showMrt || showLrt || showTjRoutes) && (
              <details className="line-legend-details">
                <summary>Warna jalur</summary>
                <div className="line-legend">
                  {showKrl && (
                    <>
                      <span><i style={{ background: '#e11d2b' }} /> KRL Bogor</span>
                      <span><i style={{ background: '#0d6bbf' }} /> KRL Cikarang</span>
                      <span><i style={{ background: '#16a34a' }} /> KRL Rangkasbitung</span>
                      <span><i style={{ background: '#8b5a2b' }} /> KRL Tangerang</span>
                      <span><i style={{ background: '#ec4899' }} /> KRL Tj. Priuk</span>
                      <span><i style={{ background: '#2e2f70' }} /> KRL Bandara</span>
                      <span><i className="dash" style={{ color: '#8C0023' }} /> Whoosh</span>
                    </>
                  )}
                  {showMrt && <span><i style={{ background: '#0d9488' }} /> MRT</span>}
                  {showLrt && <span><i style={{ background: '#7c3aed' }} /> LRT (Jakarta & Jabodebek)</span>}
                  {showTjRoutes && <span><i style={{ background: '#d97706' }} /> Koridor BRT TransJakarta</span>}
                </div>
              </details>
            )}
          </div>

          <TimeSlider block={block} onChange={changeBlock} />
        </section>

        {!isMobile && (
          <aside className="rail rail-right">
            <nav className="tabs">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={tab === t.id ? 'on' : undefined} title={t.hint} onClick={() => setTab(t.id)}>
                  {t.label}
                  {t.id === 'rekomendasi' && ownedCount > 0 && <span className="tab-count">{ownedCount}</span>}
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

      {guideOpen && <Guide role={role} onClose={closeGuide} />}
      {detailNode && (
        <StationDetail
          node={detailNode}
          model={model}
          recs={recs}
          block={block}
          onClose={() => setDetailNode(null)}
          onFocus={() => {
            flyTo(detailNode.lat, detailNode.lon, 14)
            setDetailNode(null)
          }}
          onOpenRec={(r) => {
            setDetailNode(null)
            onRecMarkerClick(r)
          }}
        />
      )}
    </div>
  )
}
