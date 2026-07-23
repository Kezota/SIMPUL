import type { RegionId, TransitNode } from '../lib/types'

/**
 * ⚠️ DATA DEMO — BUKAN DATA RESMI.
 *
 * Koordinat simpul transit di bawah ini diketik manual sebagai perkiraan
 * (akurasi ± ratusan meter) supaya prototipe jalan tanpa dependensi eksternal.
 * Untuk proposal/final WAJIB diganti data resmi dan sumbernya dicantumkan:
 *
 *   - OpenStreetMap  : railway=station, amenity=bus_station (Overpass/QGIS)
 *   - BIG / Satu Data: titik stasiun & terminal
 *   - Data KAI       : titik & pintu keluar stasiun
 *
 * Ada dua kelompok wilayah karena datasetnya memang berada di dua kota:
 * Community Maps, Struk Go, dan Properti Go di Bandung Raya; Menu Go di Depok.
 *
 * serviceRadiusM = radius layanan pejalan kaki. 1.000 m dipakai sebagai ambang
 * walkable catchment yang lazim di literatur TOD (±10-12 menit jalan kaki).
 */
export const TRANSIT_NODES: TransitNode[] = [
  // ── Bandung Raya ────────────────────────────────────────────────────────
  { id: 'st-bandung', name: 'Stasiun Bandung', kind: 'stasiun', region: 'bandung', lat: -6.9147, lon: 107.6021, serviceRadiusM: 1000 },
  { id: 'st-kiaracondong', name: 'Stasiun Kiaracondong', kind: 'stasiun', region: 'bandung', lat: -6.9265, lon: 107.6398, serviceRadiusM: 1000 },
  { id: 'st-cimindi', name: 'Stasiun Cimindi', kind: 'stasiun', region: 'bandung', lat: -6.8949, lon: 107.5622, serviceRadiusM: 1000 },
  { id: 'st-cimahi', name: 'Stasiun Cimahi', kind: 'stasiun', region: 'bandung', lat: -6.8878, lon: 107.5424, serviceRadiusM: 1000 },
  { id: 'st-gadobangkong', name: 'Stasiun Gadobangkong', kind: 'stasiun', region: 'bandung', lat: -6.8676, lon: 107.5158, serviceRadiusM: 1000 },
  { id: 'st-padalarang', name: 'Stasiun Padalarang', kind: 'stasiun', region: 'bandung', lat: -6.8434, lon: 107.4826, serviceRadiusM: 1000 },
  { id: 'st-whoosh-padalarang', name: 'Stasiun Whoosh Padalarang', kind: 'kcic', region: 'bandung', lat: -6.8348, lon: 107.487, serviceRadiusM: 1200 },
  { id: 'st-cikudapateuh', name: 'Stasiun Cikudapateuh', kind: 'stasiun', region: 'bandung', lat: -6.9207, lon: 107.6252, serviceRadiusM: 1000 },
  { id: 'tm-leuwipanjang', name: 'Terminal Leuwipanjang', kind: 'terminal', region: 'bandung', lat: -6.9484, lon: 107.5905, serviceRadiusM: 1000 },
  { id: 'tm-cicaheum', name: 'Terminal Cicaheum', kind: 'terminal', region: 'bandung', lat: -6.9089, lon: 107.6553, serviceRadiusM: 1000 },
  { id: 'tm-ledeng', name: 'Terminal Ledeng', kind: 'terminal', region: 'bandung', lat: -6.8622, lon: 107.5966, serviceRadiusM: 1000 },

  // ── Jabodetabek (koridor Depok, tempat sampel Menu Go berada) ───────────
  { id: 'st-ui', name: 'Stasiun Universitas Indonesia', kind: 'krl', region: 'jabodetabek', lat: -6.3606, lon: 106.8318, serviceRadiusM: 1000 },
  { id: 'st-pondok-cina', name: 'Stasiun Pondok Cina', kind: 'krl', region: 'jabodetabek', lat: -6.3689, lon: 106.8317, serviceRadiusM: 1000 },
  { id: 'st-depok-baru', name: 'Stasiun Depok Baru', kind: 'krl', region: 'jabodetabek', lat: -6.3919, lon: 106.823, serviceRadiusM: 1000 },
  { id: 'st-depok-lama', name: 'Stasiun Depok (Lama)', kind: 'krl', region: 'jabodetabek', lat: -6.402, lon: 106.8195, serviceRadiusM: 1000 },
  { id: 'st-citayam', name: 'Stasiun Citayam', kind: 'krl', region: 'jabodetabek', lat: -6.4436, lon: 106.8028, serviceRadiusM: 1000 },
  { id: 'tm-depok', name: 'Terminal Depok', kind: 'terminal', region: 'jabodetabek', lat: -6.3925, lon: 106.8265, serviceRadiusM: 1000 },
]

export const nodesForRegion = (region: RegionId) =>
  TRANSIT_NODES.filter((n) => n.region === region)

export const NODE_KIND_LABEL: Record<TransitNode['kind'], string> = {
  stasiun: 'Stasiun KA',
  terminal: 'Terminal Bus',
  kcic: 'Kereta Cepat',
  krl: 'Stasiun KRL',
}

export const REGION_LABEL: Record<RegionId, string> = {
  bandung: 'Bandung Raya',
  jabodetabek: 'Depok / Jabodetabek',
}
