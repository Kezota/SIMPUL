import type { TransitNode } from '../lib/types'

/**
 * ⚠️ DATA DEMO — BUKAN DATA RESMI.
 *
 * Koordinat simpul transit di bawah ini diketik manual sebagai perkiraan
 * (akurasi ± ratusan meter) hanya supaya prototipe ini bisa jalan tanpa
 * dependensi eksternal. Untuk proposal/final WAJIB diganti dengan data resmi
 * dan sumbernya dicantumkan, misalnya:
 *
 *   - OpenStreetMap  : railway=station, amenity=bus_station (ekspor via Overpass/QGIS)
 *   - BIG / Satu Data: titik stasiun & terminal
 *   - Data KAI       : titik & pintu keluar stasiun
 *
 * serviceRadiusM = radius layanan pejalan kaki yang dipakai untuk spatial join.
 * 1.000 m dipakai sebagai ambang "transit-oriented walkable catchment" yang
 * lazim di literatur TOD (kira-kira 10-12 menit jalan kaki).
 */
export const TRANSIT_NODES: TransitNode[] = [
  { id: 'st-bandung', name: 'Stasiun Bandung', kind: 'stasiun', lat: -6.9147, lon: 107.6021, serviceRadiusM: 1000 },
  { id: 'st-kiaracondong', name: 'Stasiun Kiaracondong', kind: 'stasiun', lat: -6.9265, lon: 107.6398, serviceRadiusM: 1000 },
  { id: 'st-cimindi', name: 'Stasiun Cimindi', kind: 'stasiun', lat: -6.8949, lon: 107.5622, serviceRadiusM: 1000 },
  { id: 'st-cimahi', name: 'Stasiun Cimahi', kind: 'stasiun', lat: -6.8878, lon: 107.5424, serviceRadiusM: 1000 },
  { id: 'st-gadobangkong', name: 'Stasiun Gadobangkong', kind: 'stasiun', lat: -6.8676, lon: 107.5158, serviceRadiusM: 1000 },
  { id: 'st-padalarang', name: 'Stasiun Padalarang', kind: 'stasiun', lat: -6.8434, lon: 107.4826, serviceRadiusM: 1000 },
  { id: 'st-whoosh-padalarang', name: 'Stasiun Whoosh Padalarang', kind: 'kcic', lat: -6.8348, lon: 107.487, serviceRadiusM: 1200 },
  { id: 'tm-leuwipanjang', name: 'Terminal Leuwipanjang', kind: 'terminal', lat: -6.9484, lon: 107.5905, serviceRadiusM: 1000 },
  { id: 'tm-cicaheum', name: 'Terminal Cicaheum', kind: 'terminal', lat: -6.9089, lon: 107.6553, serviceRadiusM: 1000 },
  { id: 'tm-ledeng', name: 'Terminal Ledeng', kind: 'terminal', lat: -6.8622, lon: 107.5966, serviceRadiusM: 1000 },
]

export const NODE_KIND_LABEL: Record<TransitNode['kind'], string> = {
  stasiun: 'Stasiun KA',
  terminal: 'Terminal Bus',
  kcic: 'Kereta Cepat',
}
