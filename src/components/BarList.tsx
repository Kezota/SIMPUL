/** Bar horizontal sederhana — CSS murni, tanpa library chart. */

export interface BarDatum {
  label: string
  value: number
  color: string
  hint?: string
  active?: boolean
  onClick?: () => void
}

export function BarList({ data, suffix = '', max }: { data: BarDatum[]; suffix?: string; max?: number }) {
  const peak = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="barlist">
      {data.map((d) => (
        <li key={d.label} className={d.active ? 'is-active' : undefined}>
          <button
            type="button"
            onClick={d.onClick}
            disabled={!d.onClick}
            title={d.hint ?? `${d.label}: ${d.value}${suffix}`}
          >
            <span className="barlist-label">{d.label}</span>
            <span className="barlist-track">
              <span className="barlist-fill" style={{ width: `${(d.value / peak) * 100}%`, background: d.color }} />
            </span>
            <span className="barlist-value">
              {d.value}
              {suffix}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
