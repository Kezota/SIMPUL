import { useEffect, useRef, useState } from 'react'

import { BarList } from '../components/charts'
import { askLaju, LAJU_SUGGESTIONS, type LajuAnswer } from './assistant'
import { summarizeBlocks, WEIGHTS, type LajuModel } from './engine'
import type { Recommendation } from './recommend'
import { TIME_BLOCKS, type BlockId } from './timeblocks'

const blockMeta = (id: BlockId) => TIME_BLOCKS.find((b) => b.id === id)!

/* ── Panel Rekomendasi (default) ──────────────────────────────────────────── */

export function RecPanel({
  model,
  recs,
  block,
  activeRecId,
  onSetBlock,
  onFocus,
}: {
  model: LajuModel
  recs: Recommendation[]
  block: BlockId
  activeRecId: string | null
  onSetBlock: (b: BlockId) => void
  onFocus: (r: Recommendation) => void
}) {
  const summaries = summarizeBlocks(model)
  const listRef = useRef<HTMLUListElement>(null)

  // Marker bernomor di peta diklik → kartunya ikut tersorot dan digulir masuk.
  useEffect(() => {
    if (!activeRecId || !listRef.current) return
    listRef.current
      .querySelector(`[data-rec="${activeRecId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeRecId])

  return (
    <div className="panel">
      <section className="block">
        <h3>Kapan kota ini hidup?</h3>
        <p className="block-note">Total kegiatan terekam per blok waktu — klik untuk pindah.</p>
        <BarList
          data={summaries.map((s) => ({
            label: `${blockMeta(s.block).label} ${blockMeta(s.block).range}`,
            value: Math.round(s.totalPoints),
            color: s.block === block ? '#0ea5e9' : '#cbd5e1',
            active: s.block === block,
            onClick: () => onSetBlock(s.block),
          }))}
        />
      </section>

      <section className="block">
        <div className="block-head">
          <h3>Yang perlu ditindaklanjuti</h3>
          <span className="count-pill">{recs.length}</span>
        </div>
        <p className="block-note">
          Disusun otomatis dari hitungan — bukan karangan. Nomornya sama dengan nomor di
          peta (mode Kesenjangan).
        </p>
        <ul className="rec-list" ref={listRef}>
          {recs.map((r, i) => (
            <li
              key={r.id}
              data-rec={r.id}
              className={`rec-card rec-${r.kind}${activeRecId === r.id ? ' is-active' : ''}`}
            >
              <button type="button" className="rec-card-btn" onClick={() => onFocus(r)}>
                <span className={`rec-num rec-num-${r.kind}`}>{i + 1}</span>
                <span className="rec-main">
                  <span className="rec-target">
                    {r.kind === 'jangkauan' ? 'Tak terjangkau' : 'Jadwal menipis'} ·{' '}
                    {r.target}
                  </span>
                  <b>{r.title}</b>
                </span>
              </button>
              <div className="rec-stats">
                {r.facts.map((f) => (
                  <span key={f.label} className="rec-stat">
                    <b>{f.value}</b>
                    <small>{f.label}</small>
                  </span>
                ))}
              </div>
              <p>{r.body}</p>
              <p className="rec-action">{r.action}</p>
              {r.accessNote && <p className="rec-access">♿ {r.accessNote}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* ── Panel Asisten AI ─────────────────────────────────────────────────────── */

interface Turn {
  q: string
  r: LajuAnswer
}

export function LajuAssistantPanel({
  model,
  recs,
  onApply,
}: {
  model: LajuModel
  recs: Recommendation[]
  onApply: (r: LajuAnswer) => void
}) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [openTrace, setOpenTrace] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const submit = (q: string) => {
    const question = q.trim()
    if (!question) return
    const r = askLaju(question, model, recs)
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
        Jawabannya <b>tidak pernah mengarang angka</b> — semua ditarik dari hitungan yang
        sama dengan petanya. Jawaban juga langsung menggerakkan peta.
      </p>

      <div className="ai-log" ref={listRef}>
        {turns.length === 0 && (
          <div className="ai-empty">
            <p>Coba tanya:</p>
            <div className="chips">
              {LAJU_SUGGESTIONS.map((s) => (
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
          placeholder="Tanya apa saja soal peta ini…"
          aria-label="Pertanyaan untuk asisten LAJU"
        />
        <button type="submit" disabled={!input.trim()}>
          Tanya
        </button>
      </form>
    </div>
  )
}

/* ── Panel Metode ─────────────────────────────────────────────────────────── */

export function LajuMethodPanel({ model }: { model: LajuModel }) {
  return (
    <div className="panel">
      <p className="block-note dataset-blurb">
        Versi lengkap dengan alasan tiap angka: <b>PERHITUNGAN.md</b> di repo.
      </p>

      <section className="block">
        <h3>Cara hitungnya, singkat</h3>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <div>
              <b>Kumpulkan bukti kegiatan</b>
              <p>
                Jam transaksi Struk Go (bobot {WEIGHTS.struk}; e-commerce dibuang), jam
                laporan warga dari cap foto (bobot {WEIGHTS.community}), label ramai/sepi
                Menu Go ({WEIGHTS.menuRamai}/{WEIGHTS.menuSedang}/{WEIGHTS.menuSepi}) jadi
                pola jam kota.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">2</span>
            <div>
              <b>Kelompokkan per kawasan per waktu</b>
              <p>Sel ±500 m (jarak nyaman jalan kaki) × 5 blok waktu (4 jam).</p>
            </div>
          </li>
          <li>
            <span className="step-n">3</span>
            <div>
              <b>"Ramai" = dibandingkan se-kota, bukan angka mutlak</b>
              <p>
                Masuk 25% teratas = ramai. Kawasan tanpa data = abu-abu — <b>bukan</b>{' '}
                dianggap sepi. Kawasan dengan usaha tapi belum diamati diberi perkiraan
                dan digambar pudar.
              </p>
            </div>
          </li>
          <li>
            <span className="step-n">4</span>
            <div>
              <b>Tabrakkan dengan layanan transit</b>
              <p>
                Ramai + jauh dari semua simpul (&gt;2 km) = merah. Ramai + dekat tapi
                jadwal menipis = oranye. Dari situlah rekomendasi disusun.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="block">
        <h3>Yang jujur kami akui</h3>
        <ul className="caveats">
          <li>
            Data sample kecil ({model.counts.strukUsed} transaksi, {model.counts.communityTimed}{' '}
            laporan) — ini demo cara kerjanya; data penuh dibuka lewat API setelah lolos 50
            besar.
          </li>
          <li>Jam yang terekam = jam surveyor bekerja, jadi condong ke pagi-siang.</li>
          <li>Jadwal transit masih perkiraan — akan diganti Gapeka resmi.</li>
          <li>
            Ini bukan ramalan jumlah penumpang. Ini peta "kawasan hidup" vs "layanan ada" —
            data penumpang KAI tinggal masuk sebagai pengkalibrasi kalau tersedia.
          </li>
          <li>Pin akses ♿ baru 3 titik dinilai manual (bukti konsep).</li>
        </ul>
      </section>
    </div>
  )
}
