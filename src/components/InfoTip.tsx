import { useEffect, useId, useRef, useState } from 'react'

import { GLOSSARY, type GlossaryKey } from '../lib/glossary'

/** Tombol "i" kecil: klik → penjelasan singkat "angka ini dari mana". */
export default function InfoTip({ k, text, corner }: { k?: GlossaryKey; text?: string; corner?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  const body = text ?? (k ? GLOSSARY[k] : '')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className={`infotip${corner ? ' corner' : ''}`} ref={ref}>
      <button
        type="button"
        className={`infotip-btn${open ? ' on' : ''}`}
        aria-label="Penjelasan"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        i
      </button>
      {open && (
        <span className="infotip-pop" role="tooltip" id={id} onClick={(e) => e.stopPropagation()}>
          {body}
        </span>
      )}
    </span>
  )
}
