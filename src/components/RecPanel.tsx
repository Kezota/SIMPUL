import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, MapPin } from 'lucide-react'

import type { SimpulModel } from '../lib/engine'
import type { Recommendation } from '../lib/recommend'
import type { Role } from '../lib/roles'
import { TIME_BLOCKS } from '../lib/timeblocks'
import type { MapMode } from './MapView'
import InfoTip from './InfoTip'
import RecDetail from './RecDetail'

const KIND_LABEL = { jangkauan: 'Tak terjangkau', jadwal: 'Frekuensi rendah' } as const
const CONF_LABEL = { tinggi: 'Yakin: tinggi', sedang: 'Yakin: sedang', rendah: 'Yakin: rendah' } as const

type GroupKey = 'instansi' | 'jenis' | 'waktu' | 'keyakinan'
const GROUPS: { id: GroupKey; label: string }[] = [
  { id: 'instansi', label: 'Instansi' },
  { id: 'jenis', label: 'Jenis masalah' },
  { id: 'waktu', label: 'Blok waktu' },
  { id: 'keyakinan', label: 'Keyakinan' },
]

const isScopedRole = (roleId: string) => roleId === 'kai' || roleId === 'tj'

const groupOf = (r: Recommendation, g: GroupKey) =>
  g === 'instansi'
    ? r.targetShort === 'KAI Commuter'
      ? 'KAI Commuter: frekuensi kereta'
      : 'TransJakarta / JakLingko: rute pengumpan dan frekuensi bus'
    : g === 'jenis'
      ? KIND_LABEL[r.kind]
      : g === 'waktu'
        ? `Blok ${TIME_BLOCKS.find((b) => b.id === r.block)?.label ?? '-'}`
        : `Keyakinan ${r.confidence}`

/* ── Panel Kandidat ───────────────────────────────────────────────────────── */

export default function RecPanel({
  model,
  recs,
  role,
  mode,
  loading,
  activeRecId,
  onFocus,
  onShowGap,
}: {
  model: SimpulModel
  recs: Recommendation[]
  role: Role
  mode: MapMode
  loading: boolean
  activeRecId: string | null
  onFocus: (r: Recommendation) => void
  onShowGap: () => void
}) {
  const scoped = isScopedRole(role.id)
  const listRef = useRef<HTMLDivElement>(null)
  const [group, setGroup] = useState<GroupKey>(scoped ? 'jenis' : 'instansi')
  const [showPantau, setShowPantau] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  // Setelah difilter per peran, mengelompokkan lagi per instansi cuma menghasilkan satu grup.
  const groups = scoped ? GROUPS.filter((g) => g.id !== 'instansi') : GROUPS

  const numbered = useMemo(() => recs.map((r, i) => ({ r, n: i + 1 })), [recs])
  const prioritas = numbered.filter((x) => x.r.tier === 'prioritas')
  const pantau = numbered.filter((x) => x.r.tier === 'pantau')
  const activeIsPantau = activeRecId !== null && pantau.some((x) => x.r.id === activeRecId)
  const pantauVisible = showPantau || activeIsPantau

  const grouped = (items: typeof numbered) => {
    const m = new Map<string, typeof numbered>()
    for (const x of items) {
      const k = groupOf(x.r, group)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(x)
    }
    return [...m.entries()]
  }

  useEffect(() => {
    if (!activeRecId || !listRef.current) return
    const raf = requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-rec="${activeRecId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    )
    return () => cancelAnimationFrame(raf)
  }, [activeRecId])

  const card = ({ r, n }: { r: Recommendation; n: number }) => {
    const active = activeRecId === r.id
    const blockMeta = r.block ? TIME_BLOCKS.find((b) => b.id === r.block) : null
    return (
      <li key={r.id} data-rec={r.id} className={`cd cd-${r.kind} cd-${r.tier}${active ? ' is-active' : ''}`}>
        <button type="button" className="cd-main" onClick={() => onFocus(r)} aria-pressed={active} title="Tampilkan di peta">
          <span className="cd-num">{n}</span>
          <span className="cd-txt">
            <span className="cd-place">{r.place}</span>
            <span className="cd-line">{r.headline}</span>
            <span className="cd-tags">
              <i className="cd-tag cd-tag-kind">{KIND_LABEL[r.kind]}</i>
              {blockMeta && <i className="cd-tag">{blockMeta.label}</i>}
              <i className={`cd-tag cd-tag-conf-${r.confidence}`}>{CONF_LABEL[r.confidence]}</i>
            </span>
          </span>
        </button>
        {active && (
          <div className="cd-prop">
            <b>{r.proposal.headline}</b>
            <ul>
              {r.proposal.points.map((pt) => (
                <li key={pt.label}>
                  <span>{pt.label}</span> {pt.value}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="cd-foot">
          <span className="cd-ev">
            {r.evidenceCount} laporan · {r.cellKeys.length} petak
          </span>
          <span className="cd-btns">
            {!active && (
              <button type="button" className="cd-btn ghost" onClick={() => onFocus(r)}>
                <MapPin size={14} /> Peta
              </button>
            )}
            <button type="button" className="cd-btn" onClick={() => setDetailId(r.id)}>
              <FileText size={14} /> Detail
            </button>
          </span>
        </div>
      </li>
    )
  }

  const section = (items: typeof numbered) =>
    grouped(items).map(([title, xs]) => (
      <div key={title} className="cd-group">
        <h4>
          {title} <span className="cd-count">{xs.length}</span>
        </h4>
        <ul className="cd-list">{xs.map(card)}</ul>
      </div>
    ))

  return (
    <div className="panel cd-panel" ref={listRef}>
      <header className="cd-top">
        <h2>Kandidat</h2>
        <p>
          Kawasan yang ramai menurut warga tetapi layanan transitnya kurang.{' '}
          {loading ? 'Sedang dihitung.' : `${prioritas.length} prioritas, ${pantau.length} perlu dipantau.`}
          {!loading && scoped && ` Khusus untuk ${role.label}.`}
        </p>
        {mode !== 'gap' && recs.length > 0 && (
          <button type="button" className="btn small" onClick={onShowGap}>
            Tampilkan nomornya di peta
          </button>
        )}
      </header>

      <div className="cd-tools">
        <label>
          <span>Kelompokkan</span>
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="cd-tier">
        <h3>
          Prioritas <span className="cd-count">{prioritas.length}</span> <InfoTip k="prioritas" />
        </h3>
        {loading && <p className="skeleton-line">Menghitung kandidat…</p>}
        {!loading && prioritas.length === 0 && <p className="empty-state">Belum ada kawasan ramai yang layanannya kurang.</p>}
        {section(prioritas)}
      </section>

      {pantau.length > 0 && (
        <section className="cd-tier cd-tier-pantau">
          <h3>
            Perlu dipantau <span className="cd-count">{pantau.length}</span> <InfoTip k="pantau" />
          </h3>
          <p className="cd-tier-note">Keramaiannya baru tingkat sedang, tetapi layanannya sudah tipis. Belum mendesak.</p>
          {pantauVisible ? (
            section(pantau)
          ) : (
            <button type="button" className="btn small ghost" onClick={() => setShowPantau(true)}>
              Tampilkan {pantau.length} kawasan
            </button>
          )}
        </section>
      )}

      <p className="foot-note">
        Urutan dari bukti paling kuat, bukan urutan biaya. <InfoTip k="skor_peringkat" />
      </p>

      {detailId !== null &&
        (() => {
          const i = recs.findIndex((r) => r.id === detailId)
          return i >= 0 ? <RecDetail rec={recs[i]} index={i} model={model} onClose={() => setDetailId(null)} onFocus={onFocus} /> : null
        })()}
    </div>
  )
}
