import type { MapOptions } from 'maplibre-gl'

/** Tipe style yang diterima MapLibre, tanpa impor paket style-spec langsung. */
type Style = NonNullable<MapOptions['style']>

/**
 * BASEMAP.
 *
 * ⚠️ Ketentuan B (checklist WebGIS) mewajibkan **MAPID MAPS** sebagai basemap
 * utama di versi kompetisi. Style URL + API key-nya baru didapat setelah
 * registrasi/kurasi, jadi belum bisa dipakai di prototipe ini.
 *
 * Yang sudah disiapkan: begitu kamu punya style URL-nya, isi `.env.local`
 *
 *     VITE_MAPID_STYLE_URL=<style url dari MAPID MAPS>
 *
 * dan aplikasi otomatis memakainya sebagai basemap utama — tidak ada kode lain
 * yang perlu diubah. Selama env itu kosong, dipakai basemap cadangan di bawah
 * (CARTO raster, gratis & publik) HANYA untuk keperluan eksplorasi lokal.
 */

const MAPID_STYLE_URL = import.meta.env.VITE_MAPID_STYLE_URL as string | undefined

export const usingMapidBasemap = Boolean(MAPID_STYLE_URL)

const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'

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
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: { 'raster-opacity': 1 },
      },
    ],
  }
}

export type BasemapVariant = 'light' | 'dark'

export function getBasemapStyle(variant: BasemapVariant): Style {
  return MAPID_STYLE_URL ?? rasterStyle(variant)
}

export const BASEMAP_NOTE = usingMapidBasemap
  ? 'Basemap: MAPID MAPS'
  : 'Basemap sementara: CARTO/OSM — ganti ke MAPID MAPS via VITE_MAPID_STYLE_URL'
