/**
 * Grid heksagon sederhana (pointy-top, koordinat axial).
 *
 * Ditulis manual (bukan library H3) supaya rumusnya terlihat dan bundle kecil.
 * Proyeksi memakai pendekatan meter-per-derajat lokal — cukup akurat untuk
 * wilayah sekecil Bandung Raya (galat < 0,1%).
 */

/** Titik pusat proyeksi lokal (tengah wilayah studi Bandung). */
const LAT0 = -6.92
const LON0 = 107.58

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180)

/** Jari-jari hex (pusat ke sudut). Lebar hex = √3·R ≈ 500 m. */
export const HEX_RADIUS_M = 500 / Math.sqrt(3)

export interface HexId {
  q: number
  r: number
}

export const hexKey = (h: HexId) => `${h.q},${h.r}`

const toXY = (lat: number, lon: number) => ({
  x: (lon - LON0) * M_PER_DEG_LON,
  y: (lat - LAT0) * M_PER_DEG_LAT,
})

const toLatLon = (x: number, y: number) => ({
  lat: LAT0 + y / M_PER_DEG_LAT,
  lon: LON0 + x / M_PER_DEG_LON,
})

/** lat/lon -> sel hex (axial + pembulatan kubik standar). */
export function hexAt(lat: number, lon: number): HexId {
  const { x, y } = toXY(lat, lon)
  const R = HEX_RADIUS_M
  const qf = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / R
  const rf = ((2 / 3) * y) / R

  // cube rounding
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

/** Pusat sel hex dalam lat/lon. */
export function hexCenter(h: HexId): { lat: number; lon: number } {
  const R = HEX_RADIUS_M
  const x = R * Math.sqrt(3) * (h.q + h.r / 2)
  const y = R * 1.5 * h.r
  return toLatLon(x, y)
}

/** Poligon sel hex (GeoJSON ring, [lon,lat]). */
export function hexPolygon(h: HexId): GeoJSON.Position[][] {
  const R = HEX_RADIUS_M
  const cx = R * Math.sqrt(3) * (h.q + h.r / 2)
  const cy = R * 1.5 * h.r
  const ring: GeoJSON.Position[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180
    const { lat, lon } = toLatLon(cx + R * Math.cos(angle), cy + R * Math.sin(angle))
    ring.push([lon, lat])
  }
  ring.push(ring[0])
  return [ring]
}

const NEIGHBOR_DIRS: [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
]

export function hexNeighbors(h: HexId): HexId[] {
  return NEIGHBOR_DIRS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }))
}
