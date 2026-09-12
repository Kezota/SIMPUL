import type { BlockSummary } from '../lib/engine'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'
import type { MapMode } from './MapView'

/**
 * Pemilih blok waktu: lima tombol besar, tiap tombol membawa batang kecil
 * (seberapa banyak laporan warga) dan angka yang sesuai tampilan peta.
 */
export default function TimeSlider({
  block,
  mode,
  summaries,
  onChange,
}: {
  block: BlockId
  mode: MapMode
  summaries: BlockSummary[]
  onChange: (b: BlockId) => void
}) {
  const peak = Math.max(1, ...summaries.map((s) => s.totalPoints))
  return (
    <div className="tb" role="group" aria-label="Pilih blok waktu">
      <div className="tb-head">
        <b>Blok waktu</b>
        <small>{mode === 'gap' ? 'Angka = petak ramai yang layanannya kurang' : 'Angka = petak yang ada laporan warganya'}</small>
      </div>
      <div className="tb-row">
        {TIME_BLOCKS.map((b) => {
          const s = summaries.find((x) => x.block === b.id)
          const n = s ? (mode === 'gap' ? s.gapJadwal + s.gapJangkauan : s.activeCells) : 0
          const h = s ? Math.max(6, (s.totalPoints / peak) * 100) : 6
          return (
            <button
              key={b.id}
              type="button"
              className={`tb-btn${b.id === block ? ' on' : ''}`}
              aria-pressed={b.id === block}
              onClick={() => onChange(b.id)}
              title={`${b.label} ${b.range}${s ? `: ${s.activeCells} petak berdata, ${s.ramai} ramai, ${s.gapJadwal + s.gapJangkauan} layanan kurang` : ''}`}
            >
              <span className="tb-bar" aria-hidden="true">
                <i style={{ height: `${h}%` }} />
              </span>
              <span className="tb-lbl">{b.label}</span>
              <span className="tb-hr">{b.range.replace('–', '.00 - ')}.00</span>
              <span className={`tb-n${mode === 'gap' && n > 0 ? ' warn' : ''}`}>{n}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
