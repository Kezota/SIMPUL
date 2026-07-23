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

import { toFeatureCollection } from '../lib/analysis'
import { getBasemapStyle, type BasemapVariant } from '../lib/basemap'
import { themeMeta } from '../lib/enrich'
import { circlePolygon, formatDistance } from '../lib/geo'
import { NODE_KIND_LABEL } from '../data/transitNodes'
import type { Activity, NodeStats } from '../lib/types'

export interface LayerVisibility {
  activities: boolean
  heatmap: boolean
  nodes: boolean
  radius: boolean
  links: boolean
}

interface Props {
  activities: Activity[]
  nodeStats: NodeStats[]
  layers: LayerVisibility
  variant: BasemapVariant
  selectedId: string | null
  focus: { lat: number; lon: number; zoom: number; nonce: number } | null
  onSelect: (id: string | null) => void
  onSelectNode: (nodeId: string) => void
}

const SRC_ACT = 'src-activities'
const SRC_RADIUS = 'src-radius'
const SRC_LINKS = 'src-links'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export default function MapView({
  activities,
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

  const actFC = useMemo(() => toFeatureCollection(activities), [activities])

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
        properties: { id: n.node.id, name: n.node.name, pulse: n.pulseIndex, count: n.count },
      })),
    }),
    [nodeStats],
  )

  /** Garis penghubung titik "luar jangkauan" ke simpul terdekatnya. */
  const linksFC = useMemo<GeoJSON.FeatureCollection>(() => {
    const byId = new Map(nodeStats.map((n) => [n.node.id, n.node]))
    return {
      type: 'FeatureCollection',
      features: activities
        .filter((a) => a.accessClass === 'luar' || a.accessClass === 'sedang')
        .flatMap((a) => {
          const n = byId.get(a.nearestNodeId)
          if (!n) return []
          return [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [a.lon, a.lat],
                  [n.lon, n.lat],
                ],
              },
              properties: { d: a.distanceM, far: a.accessClass === 'luar' ? 1 : 0 },
            },
          ]
        }),
    }
  }, [activities, nodeStats])

  // installLayers() dipanggil ulang tiap kali basemap berganti, jadi ia harus
  // membaca state terbaru — bukan nilai yang ter-capture saat peta dibuat.
  const latest = useRef({ actFC, radiusFC, linksFC, layers, onSelect })
  latest.current = { actFC, radiusFC, linksFC, layers, onSelect }

  /* ── Init peta (sekali) ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MLMap({
      container: containerRef.current,
      style: getBasemapStyle(variant),
      center: [107.55, -6.92],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
    map.addControl(new GeolocateControl({ trackUserLocation: false }), 'top-right')

    map.on('load', () => {
      readyRef.current = true
      installLayers(map)
    })

    // Setelah ganti basemap, semua source/layer custom ikut hilang → pasang ulang.
    map.on('styledata', () => {
      if (readyRef.current && !map.getSource(SRC_ACT)) installLayers(map)
    })

    return () => {
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
        paint: { 'line-color': '#38bdf8', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
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
          'line-opacity': 0.45,
          'line-dasharray': [1, 2],
        },
      })
    }

    if (!map.getSource(SRC_ACT)) {
      map.addSource(SRC_ACT, { type: 'geojson', data: latest.current.actFC })

      map.addLayer({
        id: 'act-heat',
        type: 'heatmap',
        source: SRC_ACT,
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
        id: 'act-halo',
        type: 'circle',
        source: SRC_ACT,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 9, 16, 22],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
        },
      })

      map.addLayer({
        id: 'act-circle',
        type: 'circle',
        source: SRC_ACT,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4.5, 16, 10],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['==', ['get', 'sentiment'], 'keluhan'], 2.5, 1.5],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'sentiment'], 'keluhan'],
            '#fca5a5',
            '#ffffff',
          ],
        },
      })

      map.addLayer({
        id: 'act-selected',
        type: 'circle',
        source: SRC_ACT,
        filter: ['==', ['get', 'id'], '___none___'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 12, 16, 24],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0f172a',
        },
      })

      map.on('click', 'act-circle', (e) => {
        const f = e.features?.[0]
        if (!f) return
        latest.current.onSelect(String(f.properties?.id))
      })
      map.on('mouseenter', 'act-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'act-circle', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['act-circle'] })
        if (!hits.length) latest.current.onSelect(null)
      })
    }

    applyVisibility(map)
  }

  function applyVisibility(map: MLMap) {
    const layers = latest.current.layers
    const set = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    set('act-heat', layers.heatmap)
    set('act-halo', layers.activities)
    set('act-circle', layers.activities)
    set('act-selected', layers.activities)
    set('radius-fill', layers.radius)
    set('radius-line', layers.radius)
    set('links-line', layers.links)
    markersRef.current.forEach((m) => {
      m.getElement().style.display = layers.nodes ? '' : 'none'
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
    ;(map.getSource(SRC_ACT) as GeoJSONSource | undefined)?.setData(actFC)
    ;(map.getSource(SRC_LINKS) as GeoJSONSource | undefined)?.setData(linksFC)
    ;(map.getSource(SRC_RADIUS) as GeoJSONSource | undefined)?.setData(radiusFC)
  }, [actFC, linksFC, radiusFC])

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (map.getLayer('act-selected')) {
      map.setFilter('act-selected', ['==', ['get', 'id'], selectedId ?? '___none___'])
    }
    popupRef.current?.remove()
    if (!selectedId) return
    const a = activities.find((x) => x.id === selectedId)
    if (!a) return
    const meta = themeMeta(a.theme)
    popupRef.current = new Popup({
      offset: 14,
      closeButton: false,
      maxWidth: '260px',
      className: 'wg-popup',
    })
      .setLngLat([a.lon, a.lat])
      .setHTML(
        `<div class="pop">
           <span class="pop-theme" style="background:${meta.color}">${escapeHtml(meta.short)}</span>
           <h4>${escapeHtml(a.title)}</h4>
           <p>${escapeHtml(a.aiSummary)}</p>
           <small>${formatDistance(a.distanceM)} dari ${escapeHtml(a.nearestNodeName)}</small>
         </div>`,
      )
      .addTo(map)
  }, [selectedId, activities])

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
