/**
 * Helper geospasial minimal, ditulis manual (bukan turf.js) supaya rumusnya
 * terlihat jelas dan bundle tetap kecil. Semua jarak dalam meter.
 */

const R_EARTH = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Jarak great-circle antara dua titik (haversine). */
export function haversineM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(h))
}

/**
 * Poligon lingkaran geodesik (buffer) di sekitar satu titik.
 * Dipakai untuk menggambar radius layanan simpul transit.
 */
export function circlePolygon(
  lat: number,
  lon: number,
  radiusM: number,
  steps = 64,
): GeoJSON.Position[][] {
  const ring: GeoJSON.Position[] = []
  const angular = radiusM / R_EARTH
  const lat1 = toRad(lat)
  const lon1 = toRad(lon)

  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(brng),
    )
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      )
    ring.push([toDeg(lon2), toDeg(lat2)])
  }
  return [ring]
}

export function bboxOf(points: { lat: number; lon: number }[]) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const p of points) {
    if (p.lon < minLon) minLon = p.lon
    if (p.lat < minLat) minLat = p.lat
    if (p.lon > maxLon) maxLon = p.lon
    if (p.lat > maxLat) maxLat = p.lat
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ] as [[number, number], [number, number]]
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Min-max normalisasi ke rentang 0-1; aman untuk array konstan. */
export function normalize(value: number, min: number, max: number): number {
  if (max - min < 1e-9) return 0
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
}
