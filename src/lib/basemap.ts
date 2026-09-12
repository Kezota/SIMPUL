import type { MapOptions } from 'maplibre-gl'

/** Tipe style yang diterima MapLibre, tanpa impor paket style-spec langsung. */
type Style = NonNullable<MapOptions['style']>

/**
 * BASEMAP, MAPID MAPS (wajib menurut ketentuan lomba) dengan cadangan publik.
 *
 * MAPID Maps menyediakan style vektor di
 *   https://basemap.mapid.io/styles/<nama>/style.json?key=<API key Map Services>
 * Nama style yang terverifikasi (9 Sep 2026): street-2d-building, basic, light,
 * dark, satellite. Tanpa key → 401.
 *
 * Konfigurasi lewat `.env.local` (di-gitignore):
 *   VITE_MAPID_API_KEY=...            ← key dari Dashboard → Map Services → API Keys
 *   VITE_MAPID_STYLE_URL=...          ← (opsional) style URL lengkap; mengalahkan key
 *
 * Catatan keamanan: key basemap memang dipakai di browser (seperti token Mapbox);
 * batasi domainnya di dashboard MAPID bila fitur itu tersedia, dan pantau
 * pemakaiannya di tab Analytics.
 */

const MAPID_STYLE_URL = import.meta.env.VITE_MAPID_STYLE_URL as string | undefined
const MAPID_API_KEY = import.meta.env.VITE_MAPID_API_KEY as string | undefined

export const usingMapidBasemap = Boolean(MAPID_STYLE_URL || MAPID_API_KEY)

const MAPID_STYLE: Record<BasemapVariant, string> = {
  light: 'light',
  dark: 'dark',
  satellite: 'satellite',
}

const mapidStyleUrl = (variant: BasemapVariant) =>
  MAPID_STYLE_URL && variant === 'light'
    ? MAPID_STYLE_URL
    : `https://basemap.mapid.io/styles/${MAPID_STYLE[variant]}/style.json?key=${MAPID_API_KEY}`

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'

const SATELLITE_ATTRIBUTION =
  'Citra: Esri, Maxar, Earthstar Geographics & GIS User Community'

function rasterStyle(variant: 'light' | 'dark'): Style {
  const name = variant === 'dark' ? 'dark_all' : 'light_all'
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/${name}/{z}/{x}/{y}@2x.png`,
          `https://b.basemaps.cartocdn.com/${name}/{z}/{x}/{y}@2x.png`,
          `https://c.basemaps.cartocdn.com/${name}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATTRIBUTION,
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-opacity': 1 } }],
  }
}

function esriSatelliteStyle(): Style {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: SATELLITE_ATTRIBUTION,
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  }
}

export type BasemapVariant = 'light' | 'dark' | 'satellite'

export function getBasemapStyle(variant: BasemapVariant): Style {
  if (MAPID_API_KEY || (MAPID_STYLE_URL && variant === 'light')) return mapidStyleUrl(variant)
  if (variant === 'satellite') return esriSatelliteStyle()
  return rasterStyle(variant)
}

export const BASEMAP_NOTE = usingMapidBasemap
  ? 'Basemap: MAPID MAPS (basemap.mapid.io)'
  : 'Basemap sementara: CARTO/OSM, isi VITE_MAPID_API_KEY untuk MAPID MAPS'
