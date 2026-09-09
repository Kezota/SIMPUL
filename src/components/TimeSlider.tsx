import { useEffect, useState } from 'react'
import { TIME_BLOCKS, type BlockId } from '../lib/timeblocks'

/**
 * Penggeser blok waktu — kontrol utama SIMPUL. Tombol ▶ memutar blok otomatis
 * supaya "kota bernapas" terlihat tanpa disentuh (enak buat demo).
 */
export default function TimeSlider({
  block,
  onChange,
}: {
  block: BlockId
  onChange: (b: BlockId) => void
}) {
  const [playing, setPlaying] = useState(false)

  // Interval dibuat ulang tiap blok berganti — sederhana dan bebas dari
  // membaca ref saat render.
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      const idx = TIME_BLOCKS.findIndex((b) => b.id === block)
      onChange(TIME_BLOCKS[(idx + 1) % TIME_BLOCKS.length].id)
    }, 1800)
    return () => clearTimeout(t)
  }, [playing, block, onChange])

  const idx = TIME_BLOCKS.findIndex((b) => b.id === block)

  return (
    <div className="time-slider" role="group" aria-label="Pilih blok waktu">
      <button
        type="button"
        className={`ts-play${playing ? ' on' : ''}`}
        title={playing ? 'Berhenti' : 'Putar otomatis'}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <div className="ts-track">
        <input
          type="range"
          min={0}
          max={TIME_BLOCKS.length - 1}
          step={1}
          value={idx}
          aria-label="Blok waktu"
          onChange={(e) => {
            setPlaying(false)
            onChange(TIME_BLOCKS[Number(e.target.value)].id)
          }}
        />
        <div className="ts-labels">
          {TIME_BLOCKS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={b.id === block ? 'on' : undefined}
              onClick={() => {
                setPlaying(false)
                onChange(b.id)
              }}
            >
              <b>{b.label}</b>
              <small>{b.range}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
