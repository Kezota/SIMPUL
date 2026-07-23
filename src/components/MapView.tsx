import { useEffect, useMemo, useRef } from 'react'
import {
  GeolocateControl,
  GeoJSONSource,
  Map as MLMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { boundsOf, toFeatureCollection } from '../lib/analysis'
import { getBasemapStyle, type BasemapVariant } from '../lib/basemap'
import { circlePolygon, formatDistance } from '../lib/geo'
import { categoryOf } from '../data/datasets'
import { NODE_KIND_LABEL } from '../data/transitNodes'
import type { DatasetDef, NodeStats, Observation } from '../lib/types'

export interface LayerVisibility {
  points: boolean
  heatmap: boolean
  nodes: boolean
  radius: boolean
  links: boolean
}

interface Props {
  dataset: DatasetDef
  observations: Observation[]
  allObservations: Observation[]
  nodeStats: NodeStats[]
  layers: LayerVisibility
  variant: BasemapVariant
  selectedId: string | null
  focus: { lat: number; lon: number; zoom: number; nonce: number } | null
  onSelect: (id: string | null) => void
  onSelectNode: (nodeId: string) => void
}

const SRC_PTS = 'src-points'
const SRC_RADIUS = 'src-radius'
const SRC_LINKS = 'src-links'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export default function MapView({
  dataset,
  observations,
  allObservations,
  nodeStats,
  layers,
  variant,
  selectedId,
  focus,
  onSelect,
  onSelectNode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const popupRef = useRef<Popup | null>(null)
  const readyRef = useRef(false)

  const ptsFC = useMemo(
    () => toFeatureCollection(observations, dataset),
    [observations, dataset],
  )

  /** Buffer radius layanan tiap simpul — hasil geo.circlePolygon(). */
  const radiusFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: nodeStats.map((n) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: circlePolygon(n.node.lat, n.node.lon, n.node.serviceRadiusM),
        },
        properties: { id: n.node.id, name: n.node.name, pulse: n.pulseIndex },
      })),
    }),
    [nodeStats],
  )

  /** Garis penghubung titik jauh ke simpul terdekatnya. */
  const linksFC = useMemo<GeoJSON.FeatureCollection>(() => {
    const byId = new Map(nodeStats.map((n) => [n.node.id, n.node]))
    return {
      type: 'FeatureCollection',
      features: observations
        .filter((o) => o.accessClass === 'luar' || o.accessClass === 'sedang')
        .flatMap((o) => {
          const n = byId.get(o.nearestNodeId)
          if (!n) return []
          return [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [o.lon, o.lat],
                  [n.lon, n.lat],
                ],
              },
              properties: { far: o.accessClass === 'luar' ? 1 : 0 },
            },
          ]
        }),
    }
  }, [observations, nodeStats])

  // installLayers() dipanggil ulang tiap kali basemap berganti, jadi ia harus
  // membaca state terbaru — bukan nilai yang ter-capture saat peta dibuat.
  const latest = useRef({ ptsFC, radiusFC, linksFC, layers, onSelect })
  latest.current = { ptsFC, radiusFC, linksFC, layers, onSelect }

  /* ── Init peta (sekali) ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MLMap({
      container: containerRef.current,
      style: getBasemapStyle(variant),
      center: [107.55, -6.92],
      zoom: 10.5,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map?: MLMap }).__map = map

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
    map.addControl(new GeolocateControl({ trackUserLocation: false }), 'top-right')

    // Layer custom dipasang begitu style siap, dan dipasang ulang tiap kali
    // basemap diganti (setStyle membuang semua source/layer custom).
    //
    // 'style.load' menyala begitu spesifikasi style selesai di-parse — beda dari
    // 'load' dan isStyleLoaded() yang keduanya baru siap setelah seluruh tile
    // masuk. Bedanya penting: kalau basemap lambat atau diblokir, dua gate yang
    // terakhir tidak pernah terpenuhi dan layer data ikut tidak pernah terpasang.
    // installLayers() sendiri idempoten.
    map.on('style.load', () => {
      readyRef.current = true
      installLayers(map)
    })

    // Container peta ikut berubah ukuran tiap rail dibuka/ditutup, tabel atribut
    // di-toggle, atau layar diputar. Tanpa resize(), MapLibre tetap memakai
    // ukuran saat inisialisasi: kanvasnya melebar tapi tile hanya diminta untuk
    // area lama, jadi ada pita kosong di tepi peta.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      popupRef.current?.remove()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function installLayers(map: MLMap) {
    if (!map.getSource(SRC_RADIUS)) {
      map.addSource(SRC_RADIUS, { type: 'geojson', data: latest.current.radiusFC })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: SRC_RADIUS,
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': ['interpolate', ['linear'], ['get', 'pulse'], 0, 0.04, 100, 0.22],
        },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: SRC_RADIUS,
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1,
          'line-dasharray': [2, 2],
          'line-opacity': 0.7,
        },
      })
    }

    if (!map.getSource(SRC_LINKS)) {
      map.addSource(SRC_LINKS, { type: 'geojson', data: latest.current.linksFC })
      map.addLayer({
        id: 'links-line',
        type: 'line',
        source: SRC_LINKS,
        paint: {
          'line-color': ['case', ['==', ['get', 'far'], 1], '#ef4444', '#f59e0b'],
          'line-width': 1.2,
          'line-opacity': 0.4,
          'line-dasharray': [1, 2],
        },
      })
    }

    if (!map.getSource(SRC_PTS)) {
      map.addSource(SRC_PTS, { type: 'geojson', data: latest.current.ptsFC })

      map.addLayer({
        id: 'pts-heat',
        type: 'heatmap',
        source: SRC_PTS,
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'relevance'], 0, 0.3, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(56,189,248,0.35)',
            0.45, 'rgba(129,230,217,0.55)',
            0.7, 'rgba(250,204,21,0.7)',
            1, 'rgba(239,68,68,0.85)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 18, 15, 55],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.9, 15, 0],
        },
      })

      map.addLayer({
        id: 'pts-halo',
        type: 'circle',
        source: SRC_PTS,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 7, 16, 18],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.16,
        },
      })

      map.addLayer({
        id: 'pts-circle',
        type: 'circle',
        source: SRC_PTS,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 16, 9],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'highlighted'], 1], 2.5, 1.2],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'highlighted'], 1],
            '#0f172a',
            '#ffffff',
          ],
        },
      })

      map.addLayer({
        id: 'pts-selected',
        type: 'circle',
        source: SRC_PTS,
        filter: ['==', ['get', 'id'], '___none___'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 12, 16, 24],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0f172a',
        },
      })

      map.on('click', 'pts-circle', (e) => {
        const f = e.features?.[0]
        if (f) latest.current.onSelect(String(f.properties?.id))
      })
      map.on('mouseenter', 'pts-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'pts-circle', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['pts-circle'] })
        if (!hits.length) latest.current.onSelect(null)
      })
    }

    applyVisibility(map)
  }

  function applyVisibility(map: MLMap) {
    const vis = latest.current.layers
    const set = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    set('pts-heat', vis.heatmap)
    set('pts-halo', vis.points)
    set('pts-circle', vis.points)
    set('pts-selected', vis.points)
    set('radius-fill', vis.radius)
    set('radius-line', vis.radius)
    set('links-line', vis.links)
    markersRef.current.forEach((m) => {
      m.getElement().style.display = vis.nodes ? '' : 'none'
    })
  }

  /* ── Marker simpul transit (HTML, biar bisa dilabeli tanpa font glyph) ─── */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = nodeStats.map((n) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `node-marker node-${n.node.kind}${n.count === 0 ? ' node-silent' : ''}`
      el.innerHTML = `<span class="node-dot"></span><span class="node-label">${escapeHtml(
        n.node.name.replace(/^Stasiun |^Terminal /, ''),
      )}<em>${n.count}</em></span>`
      el.title = `${n.node.name} — ${NODE_KIND_LABEL[n.node.kind]} · Indeks Denyut ${n.pulseIndex}/100`
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onSelectNode(n.node.id)
      })
      if (!layers.nodes) el.style.display = 'none'
      return new Marker({ element: el, anchor: 'center' })
        .setLngLat([n.node.lon, n.node.lat])
        .addTo(map)
    })
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeStats])

  /* ── Sinkronisasi data & visibility ───────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource(SRC_PTS) as GeoJSONSource | undefined)?.setData(ptsFC)
    ;(map.getSource(SRC_LINKS) as GeoJSONSource | undefined)?.setData(linksFC)
    ;(map.getSource(SRC_RADIUS) as GeoJSONSource | undefined)?.setData(radiusFC)
  }, [ptsFC, linksFC, radiusFC])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyVisibility(map)
     
  }, [layers])

  /** Ganti dataset → rapatkan viewport ke sebaran datanya (bisa beda kota). */
  useEffect(() => {
    const map = mapRef.current
    const b = boundsOf(allObservations)
    if (!map || !b) return
    map.fitBounds(b, { padding: 70, duration: 800, maxZoom: 14 })
    popupRef.current?.remove()
  }, [dataset.id, allObservations])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (map.getLayer('pts-selected')) {
      map.setFilter('pts-selected', ['==', ['get', 'id'], selectedId ?? '___none___'])
    }
    popupRef.current?.remove()
    if (!selectedId) return
    const o = observations.find((x) => x.id === selectedId)
    if (!o) return
    const cat = categoryOf(dataset, o.categoryId)
    popupRef.current = new Popup({
      offset: 14,
      closeButton: false,
      maxWidth: '260px',
      className: 'wg-popup',
    })
      .setLngLat([o.lon, o.lat])
      .setHTML(
        `<div class="pop">
           <span class="pop-theme" style="background:${cat.color}">${escapeHtml(cat.label)}</span>
           <h4>${escapeHtml(o.title)}</h4>
           ${o.subtitle ? `<p>${escapeHtml(o.subtitle)}</p>` : ''}
           <small>${formatDistance(o.distanceM)} dari ${escapeHtml(o.nearestNodeName)}</small>
         </div>`,
      )
      .addTo(map)
  }, [selectedId, observations, dataset])

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
