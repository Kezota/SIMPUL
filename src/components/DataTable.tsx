import { useMemo, useState } from 'react'
import { ACCESS_META } from '../lib/analysis'
import { themeMeta } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import type { Activity } from '../lib/types'

type SortKey = 'title' | 'theme' | 'distanceM' | 'sentiment' | 'nearestNodeName' | 'mediaScore'

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'title', label: 'Judul aktivitas' },
  { key: 'theme', label: 'Tema (AI)' },
  { key: 'sentiment', label: 'Nada' },
  { key: 'nearestNodeName', label: 'Simpul terdekat' },
  { key: 'distanceM', label: 'Jarak', align: 'right' },
  { key: 'mediaScore', label: 'Bukti', align: 'right' },
]

export default function DataTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Activity[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'distanceM',
    dir: 1,
  })

  const sorted = useMemo(() => {
    const v = (a: Activity) => a[sort.key]
    return [...rows].sort((a, b) => {
      const av = v(a)
      const bv = v(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv)) * sort.dir
    })
  }, [rows, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))

  return (
    <div className="table-wrap">
      <table className="attr-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'ta-right' : undefined}
                onClick={() => toggle(c.key)}
                title="Klik untuk mengurutkan"
              >
                {c.label}
                {sort.key === c.key && <i>{sort.dir === 1 ? ' ▲' : ' ▼'}</i>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr
              key={a.id}
              className={a.id === selectedId ? 'is-selected' : undefined}
              onClick={() => onSelect(a.id)}
            >
              <td>
                <span className="dot" style={{ background: themeMeta(a.theme).color }} />
                {a.title}
              </td>
              <td>
                <span className="tag" style={{ color: themeMeta(a.theme).color }}>
                  {themeMeta(a.theme).short}
                </span>
              </td>
              <td>
                <span className={`nada nada-${a.sentiment}`}>{a.sentiment}</span>
              </td>
              <td>{a.nearestNodeName}</td>
              <td className="ta-right">
                <span style={{ color: ACCESS_META[a.accessClass].color }}>
                  {formatDistance(a.distanceM)}
                </span>
              </td>
              <td className="ta-right">{Math.round(a.mediaScore * 100)}%</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="empty-row">
                Tidak ada baris yang cocok dengan filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
