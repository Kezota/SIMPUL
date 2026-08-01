import { useEffect, useMemo, useState } from 'react'

import type { BasemapVariant } from '../lib/basemap'
import { buildModel } from './engine'
import { buildRecommendations, type Recommendation } from './recommend'
import LajuMap, { type MapMode } from './LajuMap'
import TimeSlider from './TimeSlider'
import { LajuAssistantPanel, LajuMethodPanel, RecPanel } from './panels'
import type { BlockId } from './timeblocks'
import type { LajuAnswer } from './assistant'

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

export default function LajuApp({ onOpenExplorer }: { onOpenExplorer: () => void }) {
  // Seluruh model dihitung sekali di muka: bukti → sel×blok → kelas → gap.
  const model = useMemo(() => buildModel(), [])
  const recs = useMemo(() => buildRecommendations(model), [model])

  const [block, setBlock] = useState<BlockId>('pagi')
  const [mode, setMode] = useState<MapMode>('denyut')
  const [showAccess, setShowAccess] = useState(false)
  const [showRail, setShowRail] = useState(true)
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

  const applyAnswer = (a: LajuAnswer) => {
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
        return <LajuAssistantPanel model={model} recs={recs} onApply={applyAnswer} />
      case 'metode':
        return <LajuMethodPanel model={model} />
    }
  }

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`} data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark laju-mark" aria-hidden="true" />
          <div>
            <h1>LAJU</h1>
            <p>Lihat kapan kota hidup — dan di mana transportasinya belum hadir</p>
          </div>
        </div>
        <div className="topbar-actions">
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

      <main className="layout layout-laju">
        <section className="map-area">
          <LajuMap
            model={model}
            recs={recs}
            block={block}
            mode={mode}
            showAccess={showAccess}
            showRail={showRail}
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
              title="Citra satelit (Esri World Imagery)"
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
          <div className="laju-legend-card">
            {mode === 'denyut' ? (
              <>
                <div className="ramp-bar" />
                <div className="ramp-labels">
                  <span>sepi</span>
                  <span>ramai</span>
                </div>
                <small>
                  Dari jauh: permukaan panas. Perbesar untuk melihat per kawasan.
                  Pudar = perkiraan · tanpa warna = belum ada data (<b>bukan</b> sepi)
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
                  Nomor di peta = nomor rekomendasi di panel. Angka di stasiun = layanan
                  blok ini.
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
