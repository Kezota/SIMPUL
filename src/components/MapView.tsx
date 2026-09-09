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
import { hexPolygon } from '../lib/hexgrid'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'
import { REGION, type SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'
import type { TransitNode } from '../lib/types'

/** Dua cerita, dua tampilan — supaya layar tidak menceritakan semuanya sekaligus. */
export type MapMode = 'denyut' | 'gap'

interface Props {
  model: SimpulModel
  recs: Recommendation[]
  block: BlockId
  mode: MapMode
  showRail: boolean
  /** Marker stasiun/terminal. */
  showNodes: boolean
  /** Halte BRT/non-BRT TransJakarta. */
  showTj: boolean
  /** Halte JakLingko / Mikrotrans (jumlahnya ribuan — dipisah supaya peta tidak penuh titik). */
  showJak: boolean
  variant: BasemapVariant
  focus: { lat: number; lon: number; zoom: number; nonce: number } | null
  /** Penanda hasil pencarian lokasi. */
  pin: { lat: number; lon: number; label: string } | null
  onRecClick: (rec: Recommendation, index: number) => void
  onNodeClick: (node: TransitNode) => void
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

export default function MapView({
  model,
  recs,
  block,
  mode,
  showRail,
  showNodes,
  showTj,
  showJak,
  variant,
  focus,
  pin,
  onRecClick,
  onNodeClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const recMarkersRef = useRef<Marker[]>([])
  const popupRef = useRef<Popup | null>(null)
  const pinRef = useRef<Marker | null>(null)
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
              properties: { w: hb.total },
            }
          }),
        },
      }
    }
    return out
  }, [model])

  /** Halte TJ/JakLingko sebagai titik (dari GTFS) — untuk layer & popup. */
  const stopsFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: model.stops.map((st) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [st.lon, st.lat] },
        properties: {
          id: st.id,
          name: st.name,
          jak: st.jak ? 1 : 0,
          pagi: st.dep.pagi, siang: st.dep.siang, sore: st.dep.sore, malam: st.dep.malam, larut: st.dep.larut,
        },
      })),
    }),
    [model],
  )

  /** sel → kandidat (nomor & objek) supaya popup sel bisa menunjuk kartunya. */
  const recByCell = useMemo(() => {
    const m = new Map<string, { rec: Recommendation; index: number }>()
    recs.forEach((rec, index) => rec.cellKeys.forEach((k) => m.set(k, { rec, index })))
    return m
  }, [recs])

  const latest = useRef({ fcByBlock, stopsFC, block, mode, model, showRail, showTj, showJak, recByCell, onRecClick, onNodeClick })
  latest.current = { fcByBlock, stopsFC, block, mode, model, showRail, showTj, showJak, recByCell, onRecClick, onNodeClick }

  /* ── Init peta (sekali) ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MLMap({
      container: containerRef.current,
      style: getBasemapStyle(variant),
      center: REGION.center,
      zoom: REGION.zoom,
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

    // Label stasiun disembunyikan saat zoom jauh (129 stasiun + 7.8k halte akan
    // saling tumpuk); titiknya tetap tampil. Dikontrol lewat atribut data + CSS.
    const syncZoomClass = () => {
      const z = map.getZoom()
      containerRef.current?.setAttribute('data-zoom', z < 11.8 ? 'far' : z < 13 ? 'mid' : 'near')
    }
    syncZoomClass()
    map.on('zoom', syncZoomClass)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      recMarkersRef.current.forEach((m) => m.remove())
      pinRef.current?.remove()
      popupRef.current?.remove()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function installLayers(map: MLMap) {
    /* Jalur rel — geometri asli OpenStreetMap (KRL/KA, MRT, LRT, Whoosh) se-Jabodetabek. */
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
        filter: ['in', ['get', 'kind'], ['literal', ['kcic', 'mrt', 'lrt']]],
        paint: {
          'line-color': '#b91c1c',
          'line-width': 1.6,
          'line-dasharray': [2.2, 1.4],
        },
      })
    }

    if (!map.getSource('stops')) {
      map.addSource('stops', { type: 'geojson', data: latest.current.stopsFC })
      // Dua layer dari satu sumber: TransJakarta (biru tua, lebih besar) dan JakLingko (biru muda, kecil).
      map.addLayer({
        id: 'stops-tj',
        type: 'circle',
        source: 'stops',
        filter: ['==', ['get', 'jak'], 0],
        minzoom: 10.5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 14, 5.5],
          'circle-color': '#1d4ed8',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.2],
          'circle-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'stops-jak',
        type: 'circle',
        source: 'stops',
        filter: ['==', ['get', 'jak'], 1],
        minzoom: 12,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 15, 4],
          'circle-color': '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 15, 1],
          'circle-opacity': 0.8,
        },
      })
      for (const id of ['stops-tj', 'stops-jak']) map.on('click', id, (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties ?? {}
        const b = latest.current.block
        popupRef.current?.remove()
        popupRef.current = new Popup({ offset: 8, closeButton: true, maxWidth: '240px', className: 'wg-popup' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="pop"><small class="pop-kicker">${p.jak === 1 ? 'Halte JakLingko / Mikrotrans' : 'Halte TransJakarta'}</small>
             <h4>${escapeHtml(String(p.name ?? 'Halte'))}</h4>
             <div class="pop-grid"><span><b>±${p[b]}</b><small>bus/blok ${escapeHtml(blockLabel(b))}</small></span></div>
             <small>Jadwal hari kerja dari GTFS resmi TransJakarta.</small></div>`,
          )
          .addTo(map)
      })
      for (const id of ['stops-tj', 'stops-jak']) {
        map.on('mouseenter', id, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = ''
        })
      }
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
          'fill-opacity': 0.65,
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

      // Klik sel → popup yang menjawab "ini apa, kenapa, lalu saya harus apa".
      const clickable = ['hex-denyut', 'hex-gap-fill', 'hex-gap-ghost']
      for (const layerId of clickable) {
        map.on('click', layerId, (e) => {
          const f = e.features?.[0]
          if (!f) return
          const cell = latest.current.model.cellByKey.get(String(f.properties?.key))
          if (!cell) return
          const b = latest.current.block
          const hb = cell.blocks[b]
          const hit = latest.current.recByCell.get(cell.key)
          const clsLabel =
            hb.cls === 'ramai'
              ? `Ramai — lebih hidup dari ${hb.percentile}% kawasan lain`
              : hb.cls === 'sedang'
                ? 'Sedang'
                : hb.cls === 'sepi'
                  ? 'Cenderung sepi'
                  : 'Tidak ada data'
          const dot = hb.cls === 'ramai' ? '#dc2626' : hb.cls === 'sedang' ? '#f97316' : hb.cls === 'sepi' ? '#3b82f6' : '#94a3b8'
          const ramaiN = cell.evidence.filter((ev) => ev.crowd === 'ramai').length
          const nearestKind = cell.nearestStop && cell.nearestStopDistM <= cell.nearestNodeDistM ? 'halte' : 'stasiun'
          const nearestName = nearestKind === 'halte' ? cell.nearestStop!.name : cell.nearestNode.name

          let why: string
          let next: string
          if (hb.gap === 'jangkauan') {
            why = `Ramai, tetapi <b>tidak ada stasiun/halte dalam 1 km</b> — yang terdekat ${formatDistance(cell.nearestTransitM)}.`
            next = 'Kandidat rute pengumpan / halte baru.'
          } else if (hb.gap === 'jadwal') {
            why = `Ramai, tetapi <b>jadwalnya tipis</b>: skor layanan ${Math.round(hb.service * 100)}/100 (±${hb.railDep} kereta, ±${hb.busDep} bus pada blok ini).`
            next = 'Kandidat penambahan frekuensi pada blok ini.'
          } else if (hb.cls === 'ramai') {
            why = `Ramai dan <b>layanannya memadai</b> (skor ${Math.round(hb.service * 100)}/100). Bukan kandidat pada blok ini.`
            next = 'Coba geser ke blok lain — kesenjangan bisa muncul pada jam berbeda.'
          } else if (hb.cls) {
            why = 'Belum tergolong ramai pada blok ini, jadi tidak dinilai kesenjangannya.'
            next = 'Geser blok waktu untuk melihat kapan kawasan ini paling hidup.'
          } else {
            why = 'Tidak ada laporan warga pada blok ini. SIMPUL tidak menebak — ini bukan berarti sepi.'
            next = 'Kawasan seperti ini prioritas untuk survei lapangan berikutnya.'
          }
          const action = hit
            ? `<button type="button" class="pop-btn" data-rec="${escapeHtml(hit.rec.id)}">Buka kandidat #${hit.index + 1} →</button>`
            : `<p class="pop-next">${next}</p>`

          popupRef.current?.remove()
          const popup = new Popup({ offset: 8, closeButton: true, maxWidth: '300px', className: 'wg-popup' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="pop">
                 <small class="pop-kicker">Kawasan ±500 m · blok ${escapeHtml(blockLabel(b))}</small>
                 <h4><i class="pop-dot" style="background:${dot}"></i>${clsLabel}</h4>
                 <div class="pop-grid">
                   <span><b>${cell.evidence.length}</b><small>laporan warga</small></span>
                   <span><b>${ramaiN}</b><small>menyebut ramai</small></span>
                   <span><b>${formatDistance(cell.nearestTransitM)}</b><small>ke ${nearestKind} terdekat</small></span>
                 </div>
                 <p>${why}</p>
                 <small>Terdekat: ${escapeHtml(nearestName)}${nearestKind === 'halte' ? ` · stasiun ${formatDistance(cell.nearestNodeDistM)} (${escapeHtml(cell.nearestNode.name)})` : ''}</small>
                 ${action}
               </div>`,
            )
            .addTo(map)
          popupRef.current = popup
          popup.getElement()?.querySelector<HTMLButtonElement>('.pop-btn')?.addEventListener('click', () => {
            if (hit) latest.current.onRecClick(hit.rec, hit.index)
            popup.remove()
          })
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
      if (!map.getLayer(id)) continue
      map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    if (map.getLayer('stops-tj')) map.setLayoutProperty('stops-tj', 'visibility', latest.current.showTj ? 'visible' : 'none')
    if (map.getLayer('stops-jak')) map.setLayoutProperty('stops-jak', 'visibility', latest.current.showJak ? 'visible' : 'none')
  }

  /* ── Marker simpul: nama saja; detail (jadwal, kawasan) muncul saat diklik ── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    if (!showNodes) {
      markersRef.current = []
      return
    }
    markersRef.current = model.nodes.map((n) => {
      const dep = n.depByBlock?.[block] ?? 0
      const service = Math.min(1, dep / model.refDep.rail[block])
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `simpul-node simpul-node-${n.kind}${mode === 'gap' && service <= 0.35 ? ' low' : ''}`
      el.innerHTML = `<span class="simpul-node-dot"></span><span class="simpul-node-label">${escapeHtml(
        n.name.replace(/^Stasiun (MRT |LRT )?|^Terminal /, ''),
      )}</span>`
      el.title = `${n.name} — klik untuk jadwal & kawasan sekitarnya`
      el.setAttribute('aria-label', el.title)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        latest.current.onNodeClick(n)
      })
      return new Marker({ element: el, anchor: 'center' })
        .setLngLat([n.lon, n.lat])
        .addTo(map)
    })
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
     
  }, [model, block, mode, showNodes])

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
      el.className = `simpul-rec-badge simpul-rec-badge-${r.kind}`
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
     
  }, [showRail, showTj, showJak])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current)
      (map.getSource('stops') as GeoJSONSource | undefined)?.setData(stopsFC)
  }, [stopsFC])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, duration: 900 })
  }, [focus])

  /* ── Penanda hasil pencarian ───────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    pinRef.current?.remove()
    pinRef.current = null
    if (!map || !pin) return
    const el = document.createElement('div')
    el.className = 'simpul-pin'
    el.innerHTML = `<span class="simpul-pin-dot"></span><span class="simpul-pin-label">${escapeHtml(pin.label)}</span>`
    pinRef.current = new Marker({ element: el, anchor: 'bottom' }).setLngLat([pin.lon, pin.lat]).addTo(map)
  }, [pin])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setStyle(getBasemapStyle(variant))
  }, [variant])

  return <div className="map-canvas" ref={containerRef} />
}
