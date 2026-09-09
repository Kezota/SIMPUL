import { useRef, useState } from 'react'

import { AssistantSession, type AssistantEngine, type AssistantResult } from '../lib/aiRun'
import type { SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'
import type { Role } from '../lib/roles'
import type { BlockId } from '../lib/timeblocks'

/* ── Panel Tanya AI ───────────────────────────────────────────────────────── */

/** Render minimal: paragraf, daftar bernomor "1. … 2. …", dan **tebal**. Tanpa HTML mentah. */
function renderAnswer(text: string) {
  const inline = (t: string) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
      seg.startsWith('**') && seg.endsWith('**') ? <b key={i}>{seg.slice(2, -2)}</b> : <span key={i}>{seg}</span>,
    )
  return text
    .split(/\n{2,}/)
    .flatMap((para) => {
      // "1. a 2. b 3. c" dalam satu paragraf → dipecah jadi daftar.
      const items = para.split(/(?:^|\s)(?=\d{1,2}\.\s)/).filter((x) => x.trim())
      if (items.length > 1 && items.every((x) => /^\d{1,2}\.\s/.test(x.trim()))) {
        return [<ol key={para.slice(0, 20)}>{items.map((it, i) => <li key={i}>{inline(it.trim().replace(/^\d{1,2}\.\s/, ''))}</li>)}</ol>]
      }
      return para.split('\n').map((line, i) => <p key={`${para.slice(0, 12)}-${i}`}>{inline(line)}</p>)
    })
}

interface Turn {
  q: string
  r: AssistantResult | null
  /** Langkah yang sedang berjalan (selama menunggu). */
  step?: string
}

export default function AssistantPanel({
  model,
  recs,
  role,
  block,
  mode,
  onApply,
}: {
  model: SimpulModel
  recs: Recommendation[]
  role: Role
  block: BlockId
  mode: 'denyut' | 'gap'
  onApply: (r: AssistantResult) => void
}) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [openTrace, setOpenTrace] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [engine, setEngine] = useState<AssistantEngine | null>(null)
  const sessionRef = useRef(new AssistantSession())
  const listRef = useRef<HTMLDivElement>(null)

  const scrollDown = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }))

  const submit = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)
    setTurns((t) => [...t, { q: question, r: null }])
    scrollDown()
    const r = await sessionRef.current.ask(
      question,
      model,
      recs,
      { roleLabel: role.label, roleOrg: role.org, blok: block, mode },
      (step) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, step } : x))),
    )
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r } : x)))
    if (r.engine !== 'instan') setEngine(r.engine)
    setBusy(false)
    onApply(r)
    scrollDown()
  }

  const last = turns[turns.length - 1]?.r

  return (
    <div className="panel ai-panel">
      <div className="ai-status">
        <span
          className={`ai-engine ai-engine-${engine ?? 'llm'}`}
          title={
            engine === 'aturan'
              ? 'Server belum punya kunci API — jawaban dari pencocokan pola sederhana. Angka tetap dari mesin hitung.'
              : 'AI hanya memilih alat dan merangkai kalimat; setiap angka dijalankan mesin hitung SIMPUL. Jawaban ikut menggerakkan peta.'
          }
        >
          {engine === 'aturan' ? 'Mode aturan' : 'AI + alat hitung'}
        </span>
        <span className="ai-status-note">pertanyaan rutin dijawab langsung tanpa AI</span>
      </div>

      <div className="ai-log" ref={listRef}>
        {turns.length === 0 && (
          <div className="ai-empty">
            <p>Coba tanya:</p>
            <div className="chips">
              {role.suggestions.map((s) => (
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
              {t.r === null ? (
                <p className="ai-thinking">{t.step ?? 'Memahami pertanyaan…'}</p>
              ) : (
                <>
                  {renderAnswer(t.r.answer)}
                  {t.r.facts.length > 0 && (
                    <div className="ai-facts">
                      {t.r.facts.map((f) => (
                        <span key={f.label}>
                          {f.label} <b>{f.value}</b>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ai-meta">
                    <button type="button" className="link-btn" onClick={() => setOpenTrace(openTrace === i ? null : i)}>
                      {openTrace === i ? 'Sembunyikan' : 'Lihat'} alat yang dipakai
                    </button>
                    <span className={`ai-engine ai-engine-${t.r.engine}`}>
                      {t.r.engine === 'llm' ? 'Gemini + alat hitung' : t.r.engine === 'instan' ? 'langsung dari hitungan' : 'mode aturan'}
                    </span>
                  </div>
                  {openTrace === i && (
                    <ol className="ai-trace">
                      {t.r.trace.map((s, k) => (
                        <li key={k}>{s}</li>
                      ))}
                      {t.r.fallbackReason && <li className="warn">Alasan mode aturan: {t.r.fallbackReason}</li>}
                    </ol>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {turns.length > 0 && last && (
        <div className="chips ai-followups">
          {role.suggestions
            .filter((s) => !turns.some((t) => t.q === s))
            .slice(0, 2)
            .map((s) => (
              <button key={s} type="button" className="chip suggest" onClick={() => submit(s)} disabled={busy}>
                {s}
              </button>
            ))}
        </div>
      )}

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
          placeholder="Tanya soal kawasan, stasiun, atau kandidat…"
          aria-label="Pertanyaan untuk asisten SIMPUL"
          disabled={busy}
        />
        <button type="submit" disabled={!input.trim() || busy}>
          {busy ? '…' : 'Tanya'}
        </button>
      </form>
    </div>
  )
}
