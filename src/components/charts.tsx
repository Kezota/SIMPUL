/**
 * Chart primitif — SVG/CSS murni, tanpa library.
 * Cuma dua bentuk yang benar-benar dibutuhkan: perbandingan kategori (bar)
 * dan komposisi bagian-dari-keseluruhan (donut).
 */

export interface BarDatum {
  label: string
  value: number
  color: string
  hint?: string
  active?: boolean
  onClick?: () => void
}

export function BarList({
  data,
  suffix = '',
  max,
}: {
  data: BarDatum[]
  suffix?: string
  max?: number
}) {
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
              <span
                className="barlist-fill"
                style={{
                  width: `${(d.value / peak) * 100}%`,
                  background: d.color,
                }}
              />
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

export function Donut({
  data,
  size = 132,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = size / 2 - 12
  const c = 2 * Math.PI * r

  // Panjang busur + offset kumulatifnya dihitung lebih dulu, bukan lewat
  // variabel yang diakumulasi di dalam map() — akumulasi seperti itu bocor ke
  // luar render dan bisa memberi hasil berbeda pada render berikutnya.
  const arcs = data.reduce<{ d: (typeof data)[number]; len: number; offset: number }[]>(
    (acc, d) => {
      const prev = acc[acc.length - 1]
      const offset = prev ? prev.offset + prev.len : 0
      return [...acc, { d, len: (d.value / total) * c, offset }]
    },
    [],
  )

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map(({ d, len, offset }) => (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={16}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          ))}
        </g>
        {centerValue && (
          <>
            <text x="50%" y="47%" className="donut-value" textAnchor="middle">
              {centerValue}
            </text>
            <text x="50%" y="62%" className="donut-label" textAnchor="middle">
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <i style={{ background: d.color }} />
            {d.label}
            <b>{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}
