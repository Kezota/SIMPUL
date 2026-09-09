import { useEffect, useMemo, useRef, useState } from 'react'

import { REGION, type SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'

/**
 * Pencarian lokasi di atas peta.
 *  - Lokal (instan): 129 stasiun, 7.8k halte, dan kandidat bernomor.
 *  - Tempat umum (kelurahan, mal, pasar, jalan): geocoder Nominatim (OSM),
 *    dibatasi bbox Jabodetabek. Dipanggil hanya kalau hasil lokal sedikit.
 */

export interface SearchHit {
  id: string
  label: string
  sub: string
  kind: 'stasiun' | 'halte' | 'kandidat' | 'tempat'
  lat: number
  lon: number
  zoom: number
  recId?: string
}

const KIND_ICON: Record<SearchHit['kind'], string> = { stasiun: '🚉', halte: '🚏', kandidat: '📍', tempat: '🗺' }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function localSearch(q: string, model: SimpulModel, recs: Recommendation[]): SearchHit[] {
  const n = norm(q)
  if (n.length < 2) return []
  const score = (name: string) => {
    const m = norm(name)
    if (m === n) return 3
    if (m.startsWith(n)) return 2
    if (m.includes(n)) return 1
    return 0
  }
  const out: { hit: SearchHit; s: number }[] = []
  recs.forEach((r, i) => {
    const s = Math.max(score(r.title), score(r.nearestNode.name), String(i + 1) === n ? 3 : 0)
    if (s) out.push({ hit: { id: r.id, label: `Kandidat ${i + 1}`, sub: r.title, kind: 'kandidat', lat: r.focus.lat, lon: r.focus.lon, zoom: 13.5, recId: r.id }, s: s + 0.5 })
  })
  for (const nd of model.nodes) {
    // Cocokkan tanpa awalan "Stasiun (MRT|LRT)" supaya "tanah abang" = stasiunnya, bukan cuma haltenya.
    const s = Math.max(score(nd.name), score(nd.name.replace(/^Stasiun (MRT |LRT )?|^Terminal /, '')))
    if (s) out.push({ hit: { id: nd.id, label: nd.name, sub: nd.lines?.length ? `Lintas ${nd.lines.join(', ')}` : 'Stasiun', kind: 'stasiun', lat: nd.lat, lon: nd.lon, zoom: 13.5 }, s: s + 0.4 })
  }
  let stopHits = 0
  for (const st of model.stops) {
    if (stopHits > 60) break
    const s = score(st.name)
    if (s) {
      stopHits++
      out.push({ hit: { id: st.id, label: st.name, sub: st.jak ? 'Halte JakLingko / Mikrotrans' : 'Halte TransJakarta', kind: 'halte', lat: st.lat, lon: st.lon, zoom: 14.5 }, s })
    }
  }
  return out
    .sort((a, b) => b.s - a.s || a.hit.label.length - b.hit.label.length)
    .slice(0, 8)
    .map((x) => x.hit)
}

async function geocode(q: string, signal: AbortSignal): Promise<SearchHit[]> {
  const [minLon, minLat, maxLon, maxLat] = REGION.bbox
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&bounded=1` +
    `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!res.ok) return []
  const rows = (await res.json()) as { place_id: number; display_name: string; name?: string; lat: string; lon: string; type?: string }[]
  return rows.map((r) => ({
    id: `osm-${r.place_id}`,
    label: r.name || r.display_name.split(',')[0],
    sub: r.display_name.split(',').slice(1, 4).join(',').trim() || (r.type ?? 'tempat'),
    kind: 'tempat',
    lat: Number(r.lat),
    lon: Number(r.lon),
    zoom: 14,
  }))
}

export default function LocationSearch({
  model,
  recs,
  onPick,
  onClear,
}: {
  model: SimpulModel
  recs: Recommendation[]
  onPick: (hit: SearchHit) => void
  onClear?: () => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  // Hasil geocoder disimpan bersama kata kuncinya supaya hasil lama tidak nyangkut di kata kunci baru.
  const [remote, setRemote] = useState<{ q: string; hits: SearchHit[]; busy: boolean }>({ q: '', hits: [], busy: false })
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => localSearch(q, model, recs), [q, model, recs])
  const remoteHits = remote.q === q.trim() ? remote.hits : []
  const busy = remote.q === q.trim() && remote.busy

  useEffect(() => {
    const key = q.trim()
    if (key.length < 3) return
    const ac = new AbortController()
    const t = setTimeout(async () => {
      setRemote({ q: key, hits: [], busy: true })
      try {
        const out = await geocode(key, ac.signal)
        if (!ac.signal.aborted) setRemote({ q: key, hits: out, busy: false })
      } catch {
        /* dibatalkan / offline — hasil lokal tetap tampil */
        if (!ac.signal.aborted) setRemote({ q: key, hits: [], busy: false })
      }
    }, 450)
    return () => {
      ac.abort()
      clearTimeout(t)
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const all = [...hits, ...remoteHits.filter((r) => !hits.some((h) => Math.abs(h.lat - r.lat) < 1e-4 && Math.abs(h.lon - r.lon) < 1e-4))]
  const cur = Math.min(cursor, Math.max(0, all.length - 1))

  const choose = (h: SearchHit) => {
    onPick(h)
    setQ(h.label)
    setOpen(false)
  }

  return (
    <div className="loc-search" ref={boxRef}>
      <input
        type="search"
        value={q}
        placeholder="Cari stasiun, halte, kawasan, atau nomor kandidat…"
        aria-label="Cari lokasi"
        onChange={(e) => {
          setQ(e.target.value)
          setCursor(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(all.length - 1, c + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(0, c - 1))
          } else if (e.key === 'Enter' && all[cur]) {
            e.preventDefault()
            choose(all[cur])
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {q && (
        <button
          type="button"
          className="loc-clear"
          aria-label="Hapus pencarian"
          title="Hapus"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQ('')
            setOpen(false)
            setCursor(0)
            onClear?.()
          }}
        >
          ×
        </button>
      )}
      {open && q.trim().length >= 2 && (
        <ul className="loc-results" role="listbox">
          {all.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === cur} className={i === cur ? 'on' : undefined}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(h)}>
                <span aria-hidden="true">{KIND_ICON[h.kind]}</span>
                <span>
                  <b>{h.label}</b>
                  <small>{h.sub}</small>
                </span>
              </button>
            </li>
          ))}
          {busy && <li className="loc-status">Mencari tempat lain…</li>}
          {!busy && all.length === 0 && <li className="loc-status">Tidak ditemukan. Coba nama stasiun, halte, atau kelurahan.</li>}
        </ul>
      )}
    </div>
  )
}
