import { useMemo, useState } from 'react'
import { ACCESS_META } from '../lib/analysis'
import { categoryOf } from '../data/datasets'
import { formatDistance } from '../lib/geo'
import type { DatasetDef, Observation } from '../lib/types'

type SortKey = 'title' | 'categoryId' | 'price' | 'when' | 'distanceM' | 'nearestNodeName' | 'mediaScore'

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

/** Baris yang dirender sekaligus. 590 <tr> tanpa virtualisasi terasa berat. */
const PAGE = 150

export default function DataTable({
  dataset,
  rows,
  selectedId,
  onSelect,
}: {
  dataset: DatasetDef
  rows: Observation[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'distanceM',
    dir: 1,
  })
  const [limit, setLimit] = useState(PAGE)

  /** Kolom mengikuti dataset aktif: harga & waktu hanya ada di sebagian. */
  const columns = useMemo(() => {
    const cols: { key: SortKey; label: string; align?: 'right' }[] = [
      { key: 'title', label: 'Judul' },
    ]
    for (const c of dataset.extraColumns) {
      if (c.key === 'category') cols.push({ key: 'categoryId', label: c.label })
      if (c.key === 'price') cols.push({ key: 'price', label: c.label, align: 'right' })
      if (c.key === 'when') cols.push({ key: 'when', label: c.label })
    }
    cols.push(
      { key: 'nearestNodeName', label: 'Simpul terdekat' },
      { key: 'distanceM', label: 'Jarak', align: 'right' },
      { key: 'mediaScore', label: 'Bukti', align: 'right' },
    )
    return cols
  }, [dataset])

  const sorted = useMemo(() => {
    const val = (o: Observation): string | number => {
      if (sort.key === 'when') return o.when ? `${o.when.date} ${o.when.time ?? ''}` : ''
      if (sort.key === 'price') return o.price ?? -1
      if (sort.key === 'categoryId') return categoryOf(dataset, o.categoryId).label
      return o[sort.key] as string | number
    }
    return [...rows].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv)) * sort.dir
    })
  }, [rows, sort, dataset])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))

  const shown = sorted.slice(0, limit)

  return (
    <div className="table-wrap">
      <table className="attr-table">
        <thead>
          <tr>
            {columns.map((c) => (
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
          {shown.map((o) => (
            <tr
              key={o.id}
              className={o.id === selectedId ? 'is-selected' : undefined}
              onClick={() => onSelect(o.id)}
            >
              {columns.map((c) => {
                if (c.key === 'title')
                  return (
                    <td key={c.key} title={o.subtitle || o.title}>
                      <span
                        className="dot"
                        style={{ background: categoryOf(dataset, o.categoryId).color }}
                      />
                      {o.title}
                      {o.highlighted && <span className="hl-dot" title={dataset.highlight.label} />}
                    </td>
                  )
                if (c.key === 'categoryId')
                  return (
                    <td key={c.key}>
                      <span
                        className="tag"
                        style={{ color: categoryOf(dataset, o.categoryId).color }}
                      >
                        {categoryOf(dataset, o.categoryId).label}
                      </span>
                    </td>
                  )
                if (c.key === 'price')
                  return (
                    <td key={c.key} className="ta-right">
                      {o.price !== null ? rupiah(o.price) : '—'}
                    </td>
                  )
                if (c.key === 'when')
                  return (
                    <td key={c.key}>
                      {o.when ? `${o.when.date}${o.when.time ? ` ${o.when.time}` : ''}` : '—'}
                    </td>
                  )
                if (c.key === 'distanceM')
                  return (
                    <td key={c.key} className="ta-right">
                      <span style={{ color: ACCESS_META[o.accessClass].color }}>
                        {formatDistance(o.distanceM)}
                      </span>
                    </td>
                  )
                if (c.key === 'mediaScore')
                  return (
                    <td key={c.key} className="ta-right">
                      {Math.round(o.mediaScore * 100)}%
                    </td>
                  )
                return <td key={c.key}>{o.nearestNodeName}</td>
              })}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                Tidak ada baris yang cocok dengan filter.
              </td>
            </tr>
          )}
          {sorted.length > limit && (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                Menampilkan {limit} dari {sorted.length} baris.{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setLimit((l) => l + PAGE)}
                >
                  Tampilkan {Math.min(PAGE, sorted.length - limit)} lagi
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
