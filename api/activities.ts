/**
 * Backend tipis untuk produksi (Vercel Edge Function): meneruskan permintaan
 * Community Maps "Activities" ke server MAPID.
 *
 * Kenapa perlu: endpoint kompetisi MAPID menolak permintaan yang membawa header
 * `Origin` ("server-to-server only"). Dari sini key juga tidak pernah sampai ke
 * browser — set `MAPID_API_KEY` di Environment Variables proyek Vercel.
 *
 * Body diteruskan apa adanya (feature Polygon + rentang tanggal), lihat
 * src/simpul/mapidApi.ts untuk bentuknya.
 */

export const config = { runtime: 'edge' }

const UPSTREAM = 'https://server.mapid.io/web/competition/activities'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'POST only' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }
  const key = process.env.MAPID_API_KEY || process.env.VITE_MAPID_API_KEY
  if (!key) {
    return new Response(
      JSON.stringify({ success: false, message: 'MAPID_API_KEY belum diset di server' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
  const body = await req.text()
  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body,
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      // Hasil boleh di-cache CDN sebentar: data lapangan tidak berubah tiap detik.
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
