import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'

/** Penggeser blok waktu — kontrol utama SIMPUL. Diubah manual (tanpa putar otomatis). */
export default function TimeSlider({ block, onChange }: { block: BlockId; onChange: (b: BlockId) => void }) {
  const idx = TIME_BLOCKS.findIndex((b) => b.id === block)
  const cur = TIME_BLOCKS[idx]

  return (
    <div className="time-slider" role="group" aria-label="Pilih blok waktu">
      <div className="ts-now">
        <small>Blok waktu</small>
        <b>
          {cur.label} <span>{cur.range}</span>
        </b>
      </div>
      <div className="ts-track">
        <input
          type="range"
          min={0}
          max={TIME_BLOCKS.length - 1}
          step={1}
          value={idx}
          aria-label="Blok waktu"
          onChange={(e) => onChange(TIME_BLOCKS[Number(e.target.value)].id)}
        />
        <div className="ts-labels">
          {TIME_BLOCKS.map((b) => (
            <button key={b.id} type="button" className={b.id === block ? 'on' : undefined} onClick={() => onChange(b.id)}>
              <b>{b.label}</b>
              <small>{b.range}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
