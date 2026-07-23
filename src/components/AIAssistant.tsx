import { useRef, useState } from 'react'
import { ask, suggestedQuestions, type AIContext, type AIResponse } from '../lib/ai'
import type { Filters } from '../lib/types'

interface Props {
  ctx: AIContext
  onApply: (patch: Partial<Filters>, focus: AIResponse['focus']) => void
}

interface Turn {
  q: string
  r: AIResponse
}

export default function AIAssistant({ ctx, onApply }: Props) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [openTrace, setOpenTrace] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Riwayat percakapan direset saat dataset berganti — dilakukan lewat `key`
  // di App.tsx (komponen di-remount), bukan lewat effect yang memanggil
  // setState dan memicu render berantai.

  const submit = (q: string) => {
    const question = q.trim()
    if (!question) return
    const r = ask(question, ctx)
    setTurns((t) => [...t, { q: question, r }])
    setInput('')
    onApply(r.filters, r.focus)
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <div className="panel ai-panel">
      <div className="panel-head">
        <h2>Asisten Spasial</h2>
        <span className="count-pill ai-pill">AI di dalam peta</span>
      </div>

      <p className="ai-disclaimer">
        Jawaban di bawah <b>tidak pernah mengarang angka</b> — semuanya ditarik dari
        hasil analisis yang sama dengan yang dipetakan. Tiap jawaban juga mengubah
        filter peta, jadi hasilnya bisa langsung dilihat, bukan cuma dibaca.
        Sekarang menjawab untuk dataset <b>{ctx.dataset.label}</b>.
      </p>

      <div className="ai-log" ref={listRef}>
        {turns.length === 0 && (
          <div className="ai-empty">
            <p>Coba salah satu:</p>
            <div className="chips">
              {suggestedQuestions(ctx.dataset, ctx.nodeStats).map((s) => (
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
              {t.r.answer.split('\n\n').map((para, j) => (
                <p key={j}>{para}</p>
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

              <button
                type="button"
                className="link-btn"
                onClick={() => setOpenTrace(openTrace === i ? null : i)}
              >
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
          placeholder="Tanya soal peta ini…"
          aria-label="Pertanyaan untuk asisten spasial"
        />
        <button type="submit" disabled={!input.trim()}>
          Tanya
        </button>
      </form>
    </div>
  )
}
