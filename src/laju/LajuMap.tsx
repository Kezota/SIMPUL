import { useEffect, useMemo, useRef } from 'react'
import {
  GeoJSONSource,
  Map as MLMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import railLines from '../data/railLines.json' with { type: 'json' }
import { getBasemapStyle, type BasemapVariant } from '../lib/basemap'
import { formatDistance } from '../lib/geo'
import { hexPolygon } from './hexgrid'
import { SERVICE_PROFILE } from './serviceProfiles'
import { TIME_BLOCKS, type BlockId } from './timeblocks'
import { ACCESS_PINS } from './accessPins'
import type { LajuModel } from './engine'
import type { Recommendation } from './recommend'

/** Dua cerita, dua tampilan — supaya layar tidak menceritakan semuanya sekaligus. */
export type MapMode = 'denyut' | 'gap'

interface Props {
  model: LajuModel
  recs: Recommendation[]
  block: BlockId
  mode: MapMode
  showAccess: boolean
  showRail: boolean
  variant: BasemapVariant
  focus: { lat: number; lon: number; zoom: number; nonce: number } | null
  onRecClick: (rec: Recommendation, index: number) => void
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const blockLabel = (id: BlockId) => {
  const b = TIME_BLOCKS.find((x) => x.id === id)!
  return `${b.label} (${b.range})`
}

/**
 * Batas zoom peralihan tampilan Denyut:
 * jauh = permukaan heatmap halus (pola kota), dekat = sel heksagon (inspeksi).
 * Ini jawaban untuk masalah "bintik-bintik tanpa makna" — dari jauh yang
 * terlihat adalah BENTUK keramaian, bukan konfeti sel.
 */
const HEX_MIN_ZOOM = 12.8
const HEAT_FADE_START = 12.4
const HEAT_FADE_END = 13.4

export default function LajuMap({
  model,
  recs,
  block,
  mode,
  showAccess,
  showRail,
  variant,
  focus,
  onRecClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const pinMarkersRef = useRef<Marker[]>([])
  const recMarkersRef = useRef<Marker[]>([])
  const popupRef = useRef<Popup | null>(null)
  const readyRef = useRef(false)

  /** FeatureCollection hex + titik pusat (untuk heatmap), per blok. */
  const fcByBlock = useMemo(() => {
    const out = {} as Record<
      BlockId,
      { hex: GeoJSON.FeatureCollection; heat: GeoJSON.FeatureCollection }
    >
    for (const b of TIME_BLOCKS) {
      const active = model.cells.filter((c) => c.blocks[b.id].total > 0)
      out[b.id] = {
        hex: {
          type: 'FeatureCollection',
          features: active.map((c) => {
            const hb = c.blocks[b.id]
            return {
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: hexPolygon(c.id) },
              properties: {
                key: c.key,
                percentile: hb.percentile,
                gap: hb.gap ?? '',
                estimatedOnly: c.hasObservation ? 0 : 1,
              },
            }
          }),
        },
        heat: {
          type: 'FeatureCollection',
          features: active.map((c) => {
            const hb = c.blocks[b.id]
            return {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [c.center.lon, c.center.lat],
              },
              // perkiraan diredam supaya permukaan panasnya tetap didominasi
              // pengamatan asli
              properties: { w: c.hasObservation ? hb.total : hb.total * 0.55 },
            }
          }),
        },
      }
    }
    return out
  }, [model])

  const latest = useRef({ fcByBlock, block, mode, model, showRail })
  latest.current = { fcByBlock, block, mode, model, showRail }

  /* ── Init peta (sekali) ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MLMap({
      container: containerRef.current,
      style: getBasemapStyle(variant),
      center: [107.594, -6.918],
      zoom: 11.4,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map?: MLMap }).__map = map

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    // 'style.load' (bukan 'load'/isStyleLoaded) — dua yang terakhir menunggu
    // seluruh tile, jadi basemap lambat = layer data tak pernah terpasang.
    map.on('style.load', () => {
      readyRef.current = true
      installLayers(map)
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      pinMarkersRef.current.forEach((m) => m.remove())
      recMarkersRef.current.forEach((m) => m.remove())
      popupRef.current?.remove()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function installLayers(map: MLMap) {
    /* Jalur rel — geometri asli OpenStreetMap (way railway=rail, bbox Bandung). */
    if (!map.getSource('rail')) {
      map.addSource('rail', { type: 'geojson', data: railLines as GeoJSON.FeatureCollection })
      map.addLayer({
        id: 'rail-casing',
        type: 'line',
        source: 'rail',
        paint: { 'line-color': '#ffffff', 'line-width': 3.2, 'line-opacity': 0.85 },
      })
      map.addLayer({
        id: 'rail-ka',
        type: 'line',
        source: 'rail',
        filter: ['==', ['get', 'kind'], 'ka'],
        paint: { 'line-color': '#334155', 'line-width': 1.6 },
      })
      map.addLayer({
        id: 'rail-kcic',
        type: 'line',
        source: 'rail',
        filter: ['==', ['get', 'kind'], 'kcic'],
        paint: {
          'line-color': '#b91c1c',
          'line-width': 1.6,
          'line-dasharray': [2.2, 1.4],
        },
      })
    }

    if (!map.getSource('hex')) {
      const cur = latest.current.fcByBlock[latest.current.block]
      map.addSource('hex', { type: 'geojson', data: cur.hex })
      map.addSource('heat-pts', { type: 'geojson', data: cur.heat })

      // Mode DENYUT, zoom jauh: permukaan panas halus — pola kota, bukan konfeti.
      map.addLayer({
        id: 'hex-heat',
        type: 'heatmap',
        source: 'heat-pts',
        maxzoom: HEAT_FADE_END,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 0.35, 4, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 13, 1.6],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 13, 46],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, 'rgba(254,243,199,0.55)',
            0.4, 'rgba(253,186,116,0.7)',
            0.7, 'rgba(248,113,113,0.8)',
            1, 'rgba(185,28,28,0.9)',
          ],
          'heatmap-opacity': [
            'interpolate', ['linear'], ['zoom'],
            HEAT_FADE_START, 0.9,
            HEAT_FADE_END, 0,
          ],
        },
      })

      // Mode DENYUT, zoom dekat: sel heksagon untuk inspeksi per kawasan.
      map.addLayer({
        id: 'hex-denyut',
        type: 'fill',
        source: 'hex',
        minzoom: HEX_MIN_ZOOM,
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'percentile'],
            0, '#fef3c7',
            50, '#fdba74',
            75, '#f87171',
            100, '#b91c1c',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'estimatedOnly'], 1],
            0.3,
            0.65,
          ],
        },
      })
      map.addLayer({
        id: 'hex-denyut-line',
        type: 'line',
        source: 'hex',
        minzoom: HEX_MIN_ZOOM,
        paint: { 'line-color': '#ffffff', 'line-width': 0.7, 'line-opacity': 0.5 },
      })

      // Mode KESENJANGAN: hanya sel bermasalah yang berwarna, sisanya redup.
      map.addLayer({
        id: 'hex-gap-ghost',
        type: 'fill',
        source: 'hex',
        filter: ['==', ['get', 'gap'], ''],
        paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.1 },
      })
      map.addLayer({
        id: 'hex-gap-fill',
        type: 'fill',
        source: 'hex',
        filter: ['!=', ['get', 'gap'], ''],
        paint: {
          'fill-color': ['case', ['==', ['get', 'gap'], 'jangkauan'], '#dc2626', '#f97316'],
          'fill-opacity': 0.7,
        },
      })
      map.addLayer({
        id: 'hex-gap-line',
        type: 'line',
        source: 'hex',
        filter: ['!=', ['get', 'gap'], ''],
        paint: { 'line-color': '#7f1d1d', 'line-width': 1.2, 'line-opacity': 0.7 },
      })

      // Klik sel → popup ringkas di tempat (tidak membajak panel kanan).
      const clickable = ['hex-denyut', 'hex-gap-fill', 'hex-gap-ghost']
      for (const layerId of clickable) {
        map.on('click', layerId, (e) => {
          const f = e.features?.[0]
          if (!f) return
          const cell = latest.current.model.cellByKey.get(String(f.properties?.key))
          if (!cell) return
          const hb = cell.blocks[latest.current.block]
          const clsLabel =
            hb.cls === 'ramai'
              ? `🔴 Ramai — lebih hidup dari ${hb.percentile}% kawasan lain`
              : hb.cls === 'sedang'
                ? '🟠 Sedang'
                : hb.cls === 'sepi'
                  ? '🔵 Cenderung sepi'
                  : '⚪ Belum ada data'
          const gapLabel =
            hb.gap === 'jangkauan'
              ? `<p class="pop-gap">Ramai tapi <b>jauh dari semua simpul</b> (${formatDistance(cell.nearestNodeDistM)} ke ${escapeHtml(cell.nearestNode.name)}).</p>`
              : hb.gap === 'jadwal'
                ? `<p class="pop-gap">Ramai tapi <b>jadwal sedang menipis</b> pada blok ini.</p>`
                : ''
          const bukti = cell.hasObservation
            ? `${cell.evidence.length} bukti kegiatan${cell.propertyCount ? ` · ${cell.propertyCount} titik usaha` : ''}`
            : `perkiraan dari ${cell.propertyCount} titik usaha (belum ada pengamatan langsung)`
          popupRef.current?.remove()
          popupRef.current = new Popup({ offset: 8, closeButton: true, maxWidth: '260px', className: 'wg-popup' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="pop">
                 <h4>${clsLabel}</h4>
                 <p>Blok ${escapeHtml(blockLabel(latest.current.block))} · ${escapeHtml(bukti)}.</p>
                 ${gapLabel}
                 <small>${formatDistance(cell.nearestNodeDistM)} dari ${escapeHtml(cell.nearestNode.name)}</small>
               </div>`,
            )
            .addTo(map)
        })
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = ''
        })
      }
    }

    applyBlock(map)
    applyMode(map)
    applyRail(map)
  }

  function applyBlock(map: MLMap) {
    const cur = latest.current.fcByBlock[latest.current.block]
    ;(map.getSource('hex') as GeoJSONSource | undefined)?.setData(cur.hex)
    ;(map.getSource('heat-pts') as GeoJSONSource | undefined)?.setData(cur.heat)
  }

  function applyMode(map: MLMap) {
    const denyut = latest.current.mode === 'denyut'
    const set = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    set('hex-heat', denyut)
    set('hex-denyut', denyut)
    set('hex-denyut-line', denyut)
    set('hex-gap-ghost', !denyut)
    set('hex-gap-fill', !denyut)
    set('hex-gap-line', !denyut)
  }

  function applyRail(map: MLMap) {
    const on = latest.current.showRail
    for (const id of ['rail-casing', 'rail-ka', 'rail-kcic']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
  }

  /* ── Marker simpul: nama selalu; skor layanan hanya di mode kesenjangan ── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = model.nodes.map((n) => {
      const service = SERVICE_PROFILE[n.kind][block]
      const el = document.createElement('div')
      el.className = `laju-node laju-node-${n.kind}`
      const badge =
        mode === 'gap'
          ? `<em class="${service <= 0.35 ? 'low' : ''}">${Math.round(service * 100)}%</em>`
          : ''
      el.innerHTML = `<span class="laju-node-dot"></span><span class="laju-node-label">${escapeHtml(
        n.name.replace(/^Stasiun |^Terminal /, ''),
      )}${badge}</span>`
      el.title =
        mode === 'gap'
          ? `${n.name} — layanan blok ini ±${Math.round(service * 100)}% dari jam sibuk (perkiraan jadwal)`
          : n.name
      return new Marker({ element: el, anchor: 'center' })
        .setLngLat([n.lon, n.lat])
        .addTo(map)
    })
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
     
  }, [model, block, mode])

  /* ── Marker rekomendasi bernomor — nomor di peta = nomor di kartu ─────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    recMarkersRef.current.forEach((m) => m.remove())
    if (mode !== 'gap') {
      recMarkersRef.current = []
      return
    }
    recMarkersRef.current = recs.map((r, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `laju-rec-badge laju-rec-badge-${r.kind}`
      el.textContent = `${i + 1}`
      el.title = r.title
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onRecClick(r, i)
      })
      return new Marker({ element: el, anchor: 'center' })
        .setLngLat([r.focus.lon, r.focus.lat])
        .addTo(map)
    })
    return () => {
      recMarkersRef.current.forEach((m) => m.remove())
      recMarkersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, recs, mode])

  /* ── Pin aksesibilitas (bukti konsep) ─────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    pinMarkersRef.current.forEach((m) => m.remove())
    if (!showAccess) {
      pinMarkersRef.current = []
      return
    }
    pinMarkersRef.current = ACCESS_PINS.map((p) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `laju-pin laju-pin-${p.status}`
      el.textContent = p.status === 'ramah' ? '♿' : p.status === 'tidak-ramah' ? '!' : '?'
      el.title = p.name
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        popupRef.current?.remove()
        popupRef.current = new Popup({ offset: 12, closeButton: true, maxWidth: '280px', className: 'wg-popup' })
          .setLngLat([p.lon, p.lat])
          .setHTML(
            `<div class="pop">
               <span class="pop-theme" style="background:${
                 p.status === 'tidak-ramah' ? '#dc2626' : p.status === 'ramah' ? '#16a34a' : '#64748b'
               }">${p.status === 'belum-dinilai' ? 'belum bisa dinilai' : p.status === 'tidak-ramah' ? 'sulit diakses' : 'ramah akses'}</span>
               <h4>${escapeHtml(p.name)}</h4>
               <p>${escapeHtml(p.reason)}</p>
               ${p.photoUrl ? `<a href="${p.photoUrl}" target="_blank" rel="noreferrer">Lihat fotonya</a> · ` : ''}<small>${
                 p.photoDate ? `foto ${escapeHtml(p.photoDate)}` : ''
               } · dinilai manual (bukti konsep)</small>
             </div>`,
          )
          .addTo(map)
      })
      return new Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(map)
    })
    return () => {
      pinMarkersRef.current.forEach((m) => m.remove())
      pinMarkersRef.current = []
    }
     
  }, [model, showAccess])

  /* ── Sinkronisasi ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyBlock(map)
     
  }, [block, fcByBlock])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyMode(map)
     
  }, [mode])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyRail(map)
     
  }, [showRail])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: 900 })
  }, [focus])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setStyle(getBasemapStyle(variant))
  }, [variant])

  return <div className="map-canvas" ref={containerRef} />
}
