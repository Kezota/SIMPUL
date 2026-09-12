/**
 * API MAPID untuk kompetisi, Community Maps "Activities".
 *
 * Dokumentasi: maps.mapid.io/docs → Guides → Activities.
 *   POST https://server.mapid.io/web/competition/activities
 *   header x-api-key: <API key>      (key yang sama dengan basemap MAPID MAPS)
 *   body   { feature: Polygon, start_date?, end_date? }
 *
 * Perilaku server yang penting (diverifikasi 9 Sep 2026):
 *   - tanpa rentang tanggal → maksimal 60 aktivitas terbaru;
 *   - dengan rentang tanggal → SEMUA aktivitas dalam rentang itu;
 *   - permintaan yang membawa header `Origin` ditolak 403 ("server-to-server
 *     only"). Karena itu browser memanggil /api/activities milik kita sendiri:
 *     saat dev diproksi Vite (vite.config.ts), di produksi oleh Vercel Edge
 *     Function (api/activities.ts). Key ikut dipasang di sisi server itu.
 *
 * Kalau server tidak bisa dihubungi (offline, key kosong), aplikasi memakai
 * snapshot `src/data/activitiesJabodetabek.json` (unduhan 9 Sep 2026) supaya
 * demo tetap jalan, dan status "snapshot" ditampilkan jujur di topbar.
 */

export interface MapidActivity {
  id: string
  title: string
  description: string
  lat: number
  lon: number
  /** ISO 8601, UTC. */
  createdAt: string
  mediaCount: number
}

export type ActivityFeedStatus = 'live' | 'snapshot' | 'kosong'

export interface ActivityFeed {
  items: MapidActivity[]
  status: ActivityFeedStatus
  /** Kalimat sumber untuk panel Metode. */
  note: string
  /** Kunci wilayah supaya feed lama tidak dipakai untuk wilayah baru. */
  bboxKey: string
}

/** Endpoint asli MAPID (dipanggil oleh proxy/server, bukan browser). */
export const ACTIVITIES_UPSTREAM = 'https://server.mapid.io/web/competition/activities'
/** Endpoint yang dipanggil browser, backend tipis kita sendiri. */
export const ACTIVITIES_ENDPOINT = '/api/activities'

type Bbox = [number, number, number, number]

const bboxKey = (b: Bbox) => b.join(',')

function polygonOf([minLon, minLat, maxLon, maxLat]: Bbox) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

interface RawActivity {
  _id?: string
  title?: string
  description?: string
  geometry?: { type?: string; coordinates?: unknown }
  medias?: unknown[]
  created_at?: string
}

function normalize(raw: RawActivity): MapidActivity | null {
  const c = raw.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  const lon = Number(c[0])
  const lat = Number(c[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return {
    id: String(raw._id ?? `${lon},${lat},${raw.created_at ?? ''}`),
    title: String(raw.title ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    lat,
    lon,
    createdAt: String(raw.created_at ?? ''),
    mediaCount: Array.isArray(raw.medias) ? raw.medias.length : 0,
  }
}

/** Tarik semua aktivitas di dalam bbox lewat /api/activities. Melempar error kalau gagal. */
export async function fetchActivities(bbox: Bbox, signal?: AbortSignal): Promise<MapidActivity[]> {
  const end = new Date()
  end.setDate(end.getDate() + 1)
  const res = await fetch(ACTIVITIES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feature: polygonOf(bbox),
      start_date: '2020-01-01',
      end_date: isoDate(end),
    }),
    signal,
  })
  if (!res.ok) throw new Error(`MAPID activities HTTP ${res.status}`)
  const json = (await res.json()) as {
    success?: boolean
    data?: { activities?: RawActivity[] }
  }
  if (!json.success) throw new Error('MAPID activities: success=false')
  const items: MapidActivity[] = []
  for (const raw of json.data?.activities ?? []) {
    const a = normalize(raw)
    if (a) items.push(a)
  }
  return items
}

interface SnapshotItem {
  id: string
  t: string
  d: string
  lon: number
  lat: number
  at: string
  m: number
}

/** Snapshot lokal (dimuat malas supaya tidak membebani bundle utama). */
export async function loadActivitySnapshot(bbox: Bbox): Promise<{ items: MapidActivity[]; fetched: string }> {
  const mod = await import('../data/activitiesJabodetabek.json')
  const snap = mod.default as { fetched: string; items: SnapshotItem[] }
  const [minLon, minLat, maxLon, maxLat] = bbox
  const items = snap.items
    .filter((s) => s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat)
    .map<MapidActivity>((s) => ({
      id: s.id,
      title: s.t,
      description: s.d,
      lat: s.lat,
      lon: s.lon,
      createdAt: s.at,
      mediaCount: s.m,
    }))
  return { items, fetched: snap.fetched }
}

/** Coba live dulu; kalau gagal, snapshot; kalau snapshot pun kosong → 'kosong'. */
export async function loadActivities(bbox: Bbox, signal?: AbortSignal): Promise<ActivityFeed> {
  const key = bboxKey(bbox)
  try {
    const items = await fetchActivities(bbox, signal)
    return {
      items,
      status: 'live',
      note: `Community Maps: API MAPID kompetisi (live, ${items.length.toLocaleString('id-ID')} aktivitas, ${isoDate(new Date())})`,
      bboxKey: key,
    }
  } catch (err) {
    if (signal?.aborted) throw err
    const { items, fetched } = await loadActivitySnapshot(bbox)
    return {
      items,
      status: items.length ? 'snapshot' : 'kosong',
      note: items.length
        ? `Community Maps: snapshot API MAPID kompetisi (${fetched}, ${items.length.toLocaleString('id-ID')} aktivitas), server tidak terjangkau saat dimuat`
        : 'Community Maps: API MAPID tidak terjangkau dan tidak ada snapshot untuk wilayah ini',
      bboxKey: key,
    }
  }
}
