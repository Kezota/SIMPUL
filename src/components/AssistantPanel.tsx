import { useRef, useState } from 'react'

import { askSimpul, SIMPUL_SUGGESTIONS, type SimpulAnswer } from '../lib/assistant'
import type { SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'

/* ── Panel Asisten ────────────────────────────────────────────────────────── */

interface Turn {
  q: string
  r: SimpulAnswer
}

export default function AssistantPanel({
  model,
  recs,
  onApply,
}: {
  model: SimpulModel
  recs: Recommendation[]
  onApply: (r: SimpulAnswer) => void
}) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [openTrace, setOpenTrace] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const submit = (q: string) => {
    const question = q.trim()
    if (!question) return
    const r = askSimpul(question, model, recs)
    setTurns((t) => [...t, { q: question, r }])
    setInput('')
    onApply(r)
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <div className="panel ai-panel">
      <p className="ai-disclaimer">
        Asisten ini <b>tidak pernah mengarang angka</b> — semua ditarik dari hitungan yang sama
        dengan petanya, dan jawabannya langsung menggerakkan peta. Versi ini masih berbasis aturan;
        rencana LLM ada di tab Metode.
      </p>

      <div className="ai-log" ref={listRef}>
        {turns.length === 0 && (
          <div className="ai-empty">
            <p>Coba tanya:</p>
            <div className="chips">
              {SIMPUL_SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip suggest" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="ai-turn">
            <div className="ai-q">{t.q}</div>
            <div className="ai-a">
              {t.r.answer.split('\n\n').map((p, j) => (
                <p key={j}>{p}</p>
              ))}
              {t.r.facts.length > 0 && (
                <div className="ai-facts">
                  {t.r.facts.map((f) => (
                    <span key={f.label}>
                      {f.label} <b>{f.value}</b>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className="link-btn" onClick={() => setOpenTrace(openTrace === i ? null : i)}>
                {openTrace === i ? 'Sembunyikan' : 'Lihat'} jejak nalar
              </button>
              {openTrace === i && (
                <ol className="ai-trace">
                  {t.r.trace.map((s, k) => (
                    <li key={k}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="ai-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya apa saja soal peta ini…"
          aria-label="Pertanyaan untuk asisten SIMPUL"
        />
        <button type="submit" disabled={!input.trim()}>
          Tanya
        </button>
      </form>
    </div>
  )
}

