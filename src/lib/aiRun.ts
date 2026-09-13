/**
 * Asisten "Tanya AI", Gemini (function calling) dipanggil langsung dari browser.
 *
 * Alur satu pertanyaan:
 *   1. kirim riwayat + konteks + daftar alat ke Gemini → model memilih alat;
 *   2. alat DIJALANKAN DI SINI terhadap model hitungan yang sedang tampil
 *      (angka tidak pernah dihitung LLM);
 *   3. hasil alat dikirim balik; ulang sampai model selesai bicara.
 * Tanpa kunci / kalau gagal (kuota, jaringan), jatuh ke asisten aturan
 * (assistant.ts) supaya panel tetap menjawab.
 */

import { askSimpul, type SimpulAnswer } from './assistant'
import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL, SIMPUL_TOOLS, buildSystemPrompt, type AssistantContext } from './aiTools'
import { summarizeBlocks, type HexCell, type SimpulModel } from './engine'
import type { Recommendation } from './recommend'
import { TIME_BLOCKS, type BlockId } from './timeblocks'

/** llm = Gemini; instan = pola rutin dijawab langsung tanpa AI; aturan = fallback saat AI gagal. */
export type AssistantEngine = 'llm' | 'instan' | 'aturan'

export interface AssistantResult extends SimpulAnswer {
  engine: AssistantEngine
  setMode: 'denyut' | 'gap' | null
  activeRec: string | null
  /** Alasan jatuh ke mode aturan (kalau ada), ditampilkan kecil di panel. */
  fallbackReason: string | null
}

const MAX_ROUNDS = 6
const HISTORY_TURNS = 8

const blockMeta = (id: BlockId) => TIME_BLOCKS.find((b) => b.id === id)!
const isBlock = (v: unknown): v is BlockId => TIME_BLOCKS.some((b) => b.id === v)

/* ── Pelaksana alat (angka dari mesin hitung) ─────────────────────────────── */

interface ToolEnv {
  model: SimpulModel
  recs: Recommendation[]
  ui: { setBlock: BlockId | null; setMode: 'denyut' | 'gap' | null; focus: SimpulAnswer['focus']; activeRec: string | null }
  trace: string[]
}

const recRow = (r: Recommendation, i: number) => ({
  nomor: i + 1,
  tingkat: r.tier === 'prioritas' ? 'prioritas (ramai + layanan kurang)' : 'perlu dipantau (keramaian sedang + layanan tipis)',
  judul: r.title,
  jenis: r.kind === 'jangkauan' ? 'jangkauan (tak terjangkau)' : 'jadwal (frekuensi rendah)',
  target: r.target,
  keyakinan: r.confidence,
  skor_peringkat: Number(r.score.toFixed(1)),
  blok_dominan: r.block ? `${blockMeta(r.block).label} ${blockMeta(r.block).range}` : null,
  sel_ramai: r.cellKeys.length,
  bukti_laporan: r.evidenceCount,
  fakta: r.facts,
})

const recDetail = (r: Recommendation, i: number) => ({
  ...recRow(r, i),
  dasar_peringkat: r.rankBasis,
  alasan_keyakinan:
    r.confidence === 'tinggi'
      ? '≥ 8 laporan di ≥ 2 sel bersebelahan'
      : r.confidence === 'sedang'
        ? '3–7 laporan'
        : '< 3 laporan, perlu survei lanjutan',
  penjelasan: r.body,
  usulan: r.proposal.summary,
  langkah_usulan: r.proposal.steps,
  perkiraan_indikatif: r.proposal.estimate.map((e) => `${e.label}: ${e.value}. ${e.how}`),
  catatan_usulan: r.proposal.caveat,
  stasiun_terdekat: r.nearestNode.name,
  pusat: { lat: Number(r.focus.lat.toFixed(5)), lon: Number(r.focus.lon.toFixed(5)) },
})

const cellRow = (c: HexCell, b: BlockId) => ({
  poin_kegiatan: Number(c.blocks[b].total.toFixed(1)),
  persentil: c.blocks[b].percentile,
  laporan: c.evidence.length,
  stasiun_terdekat: c.nearestNode.name,
  jarak_stasiun_m: Math.round(c.nearestNodeDistM),
  jarak_layanan_terdekat_m: Math.round(c.nearestTransitM),
  skor_layanan: Math.round(c.blocks[b].service * 100),
  kesenjangan: c.blocks[b].gap,
  pusat: { lat: Number(c.center.lat.toFixed(5)), lon: Number(c.center.lon.toFixed(5)) },
})

function findNode(model: SimpulModel, nama: string) {
  const q = nama.toLowerCase().replace(/stasiun|terminal|mrt|lrt/g, '').trim()
  if (!q) return null
  const scored = model.nodes
    .map((n) => {
      const nm = n.name.toLowerCase()
      const s = nm.includes(q) ? 2 : q.split(/\s+/).some((w) => w.length > 3 && nm.includes(w)) ? 1 : 0
      return { n, s }
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n.name.length - b.n.name.length)
  return scored[0]?.n ?? null
}

function runTool(name: string, input: Record<string, unknown>, env: ToolEnv): unknown {
  const { model, recs } = env
  switch (name) {
    case 'ringkasan_kota': {
      const s = summarizeBlocks(model)
      return {
        kandidat_prioritas: recs.filter((r) => r.tier === 'prioritas').length,
        kawasan_perlu_dipantau: recs.filter((r) => r.tier === 'pantau').length,
        laporan_warga: model.counts.activities,
        sumber_data: model.sources,
        stasiun: model.nodes.length,
        halte: model.stops.length,
        per_blok: s.map((x) => ({
          blok: `${blockMeta(x.block).label} ${blockMeta(x.block).range}`,
          poin_kegiatan: Math.round(x.totalPoints),
          sel_ada_data: x.activeCells,
          sel_ramai: x.ramai,
          sel_gap_jadwal: x.gapJadwal,
          sel_gap_jangkauan: x.gapJangkauan,
        })),
        blok_paling_hidup: blockMeta(s.reduce((a, b) => (b.totalPoints > a.totalPoints ? b : a)).block).label,
        jumlah_kandidat: recs.length,
        kandidat_jangkauan: recs.filter((r) => r.kind === 'jangkauan').length,
        kandidat_jadwal: recs.filter((r) => r.kind === 'jadwal').length,
        kandidat_untuk_kai: recs.filter((r) => /KAI/.test(r.target)).length,
        kandidat_untuk_transjakarta: recs.filter((r) => /TransJakarta/.test(r.target)).length,
        catatan: 'Sel tanpa laporan = tidak ada data (bukan sepi). Sebaran laporan mengikuti lokasi surveyor.',
      }
    }
    case 'sel_ramai': {
      const b = isBlock(input.blok) ? input.blok : 'sore'
      const limit = Math.min(20, Math.max(1, Number(input.limit) || 8))
      const busy = model.cells.filter((c) => c.blocks[b].cls === 'ramai').sort((x, y) => y.blocks[b].total - x.blocks[b].total)
      return {
        blok: `${blockMeta(b).label} ${blockMeta(b).range}`,
        jumlah_sel_ramai: busy.length,
        jumlah_ber_gap: busy.filter((c) => c.blocks[b].gap).length,
        teratas: busy.slice(0, limit).map((c) => cellRow(c, b)),
      }
    }
    case 'daftar_kandidat': {
      const jenis = input.jenis === 'jadwal' || input.jenis === 'jangkauan' ? input.jenis : null
      const target = input.target === 'kai' ? /KAI/ : input.target === 'transjakarta' ? /TransJakarta/ : null
      const rows = recs
        .map(recRow)
        .filter((_, i) => (!jenis || recs[i].kind === jenis) && (!target || target.test(recs[i].target)))
      return { jumlah: rows.length, kandidat: rows }
    }
    case 'detail_kandidat': {
      const i = Number(input.nomor) - 1
      const r = recs[i]
      return r ? recDetail(r, i) : { error: `Tidak ada kandidat nomor ${input.nomor}; tersedia 1–${recs.length}.` }
    }
    case 'bandingkan_kandidat': {
      const ia = Number(input.nomor_a) - 1
      const ib = Number(input.nomor_b) - 1
      const a = recs[ia]
      const b = recs[ib]
      if (!a || !b) return { error: `Nomor kandidat harus 1–${recs.length}.` }
      return {
        a: recDetail(a, ia),
        b: recDetail(b, ib),
        selisih_skor: Number((a.score - b.score).toFixed(1)),
        catatan: 'Peringkat = skor tertinggi lebih dulu. Rumus ada di dasar_peringkat masing-masing.',
      }
    }
    case 'profil_kawasan': {
      const node = findNode(model, String(input.nama ?? ''))
      if (!node) return { error: `Stasiun "${input.nama}" tidak ditemukan. Coba nama lain, mis. Tanah Abang, Blok M, Serpong, Cisauk.` }
      const near = model.cells.filter((c) => c.nearestNode.id === node.id && c.nearestNodeDistM <= 2000)
      const per = TIME_BLOCKS.map((b) => ({
        blok: `${b.label} ${b.range}`,
        id: b.id,
        poin_kegiatan: Number(near.reduce((s, c) => s + c.blocks[b.id].total, 0).toFixed(1)),
        sel_ramai: near.filter((c) => c.blocks[b.id].cls === 'ramai').length,
        sel_gap: near.filter((c) => c.blocks[b.id].gap).length,
        keberangkatan_terjadwal: node.depByBlock?.[b.id] ?? 0,
      }))
      const peak = per.reduce((a, b) => (b.poin_kegiatan > a.poin_kegiatan ? b : a))
      env.ui.focus = { lat: node.lat, lon: node.lon, zoom: 13.5 }
      return {
        stasiun: node.name,
        lintas: node.lines ?? [],
        sumber_jadwal: node.scheduleSource,
        sel_dalam_2km: near.length,
        laporan_warga: near.reduce((s, c) => s + c.evidence.length, 0),
        per_blok: per.map((x) => ({ blok: x.blok, poin_kegiatan: x.poin_kegiatan, sel_ramai: x.sel_ramai, sel_gap: x.sel_gap, keberangkatan_terjadwal: x.keberangkatan_terjadwal })),
        blok_puncak: peak.blok,
        koordinat: { lat: node.lat, lon: node.lon },
      }
    }
    case 'tampilkan_di_peta': {
      if (isBlock(input.blok)) env.ui.setBlock = input.blok
      if (input.mode === 'denyut' || input.mode === 'gap') env.ui.setMode = input.mode
      const k = Number(input.kandidat)
      if (k >= 1 && recs[k - 1]) {
        const r = recs[k - 1]
        env.ui.activeRec = r.id
        env.ui.setMode = 'gap'
        env.ui.focus = r.focus
        if (r.block && !isBlock(input.blok)) env.ui.setBlock = r.block
      } else if (typeof input.lat === 'number' && typeof input.lon === 'number') {
        env.ui.focus = { lat: input.lat, lon: input.lon, zoom: 13 }
      }
      return { ok: true }
    }
    default:
      return { error: `Alat ${name} tidak dikenal` }
  }
}

const JENIS_LABEL = { jadwal: 'frekuensi rendah', jangkauan: 'tak terjangkau' } as const
const TARGET_LABEL = { kai: 'KAI Commuter', transjakarta: 'TransJakarta' } as const

/** Kalimat manusiawi untuk jejak "cara jawaban ini disusun" — bukan dump nama fungsi + argumen mentah. */
function describeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'ringkasan_kota':
      return 'Mengambil ringkasan kondisi se-Jabodetabek'
    case 'sel_ramai':
      return `Mencari petak ramai pada blok ${isBlock(input.blok) ? blockMeta(input.blok).label : 'yang diminta'}`
    case 'daftar_kandidat': {
      const jenis = input.jenis === 'jadwal' || input.jenis === 'jangkauan' ? ` jenis ${JENIS_LABEL[input.jenis]}` : ''
      const target = input.target === 'kai' || input.target === 'transjakarta' ? ` untuk ${TARGET_LABEL[input.target]}` : ''
      return `Mengambil daftar kandidat${jenis}${target}`
    }
    case 'detail_kandidat':
      return `Membuka detail kandidat nomor ${input.nomor}`
    case 'bandingkan_kandidat':
      return `Membandingkan kandidat nomor ${input.nomor_a} dan nomor ${input.nomor_b}`
    case 'profil_kawasan':
      return `Mencari profil kawasan sekitar "${input.nama}"`
    case 'tampilkan_di_peta': {
      const parts: string[] = []
      if (isBlock(input.blok)) parts.push(`pindah ke blok ${blockMeta(input.blok).label}`)
      if (input.mode === 'denyut' || input.mode === 'gap') parts.push(`tampilan ${input.mode === 'gap' ? 'Kesenjangan' : 'Keramaian'}`)
      if (Number(input.kandidat) >= 1) parts.push(`sorot kandidat nomor ${input.kandidat}`)
      if (typeof input.lat === 'number' && typeof input.lon === 'number') parts.push('terbang ke lokasi')
      return parts.length ? `Menggerakkan peta: ${parts.join(', ')}` : 'Menggerakkan peta'
    }
    default:
      return `Menjalankan alat ${name}`
  }
}

/* ── Jalur instan (tanpa AI) ──────────────────────────────────────────────── */

const QUICK_ROUTES = new Set([
  'Rute: banding dua kandidat',
  'Rute: detail satu kandidat',
  'Rute: ringkasan kota',
  'Rute: petak ramai per blok',
  'Rute: kawasan tak terjangkau',
  'Rute: kandidat menurut keyakinan',
  'Rute: jumlah kandidat per instansi',
  'Rute: blok dengan kesenjangan terbanyak',
  'Rute: kandidat frekuensi rendah',
  'Rute: kandidat tak terjangkau',
])

/**
 * Jalankan asisten aturan; terima jawabannya hanya kalau polanya jelas
 * (bukan tebakan). Pertanyaan bebas/"kenapa"/"bagaimana" tetap ke AI.
 */
function quickAnswer(question: string, model: SimpulModel, recs: Recommendation[]): SimpulAnswer | null {
  const q = question.toLowerCase()
  const openEnded = /kenapa|mengapa|bagaimana|jelaskan|apakah|sebaiknya|saran|menurut|kalau|jika|bandingkan dengan|apa bedanya/.test(q)
  const r = askSimpul(question, model, recs)
  const route = r.trace.find((t) => t.startsWith('Rute:')) ?? ''
  if (route === 'Rute: banding dua kandidat' || route === 'Rute: detail satu kandidat') return r
  if (openEnded) return null
  if (QUICK_ROUTES.has(route)) return r
  if (route === 'Rute: profil kawasan satu stasiun' && /sekitar|stasiun|kawasan|daerah/.test(q)) return r
  if (route === 'Rute: daftar kandidat' && q.split(/\s+/).length <= 6) return r
  return null
}

/* ── Gemini REST ──────────────────────────────────────────────────────────── */

interface GPart {
  text?: string
  thought?: boolean
  thoughtSignature?: string
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string }
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string }
}
interface GContent {
  role: 'user' | 'model'
  parts: GPart[]
}

const ENDPOINT = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

/* ── Sesi percakapan ──────────────────────────────────────────────────────── */

export class AssistantSession {
  private history: GContent[] = []
  /** false = tidak ada kunci → langsung mode aturan. */
  private llmAvailable: boolean | null = GEMINI_API_KEY ? null : false

  get engine(): AssistantEngine | null {
    return this.llmAvailable === null ? null : this.llmAvailable ? 'llm' : 'aturan'
  }

  reset() {
    this.history = []
  }

  async ask(
    question: string,
    model: SimpulModel,
    recs: Recommendation[],
    ctx: AssistantContext,
    onProgress?: (step: string) => void,
  ): Promise<AssistantResult> {
    // 1) Pertanyaan rutin (banding/detail kandidat, ringkasan, sel ramai per blok,
    //    profil stasiun) dijawab langsung dari mesin hitung, instan, tanpa kuota AI.
    const quick = quickAnswer(question, model, recs)
    if (quick) return { ...quick, engine: 'instan', setMode: null, activeRec: null, fallbackReason: null }
    // 2) Sisanya ke Gemini; 3) kalau gagal, mode aturan.
    if (this.llmAvailable === false) return this.rules(question, model, recs, GEMINI_API_KEY ? 'Kunci API Gemini tidak diterima' : 'Kunci API Gemini belum dipasang')
    try {
      return await this.llm(question, model, recs, ctx, onProgress)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return this.rules(question, model, recs, reason)
    }
  }

  private rules(question: string, model: SimpulModel, recs: Recommendation[], reason: string): AssistantResult {
    const r = askSimpul(question, model, recs)
    return { ...r, engine: 'aturan', setMode: null, activeRec: null, fallbackReason: reason }
  }

  private async llm(
    question: string,
    model: SimpulModel,
    recs: Recommendation[],
    ctx: AssistantContext,
    onProgress?: (step: string) => void,
  ): Promise<AssistantResult> {
    const env: ToolEnv = {
      model,
      recs,
      ui: { setBlock: null, setMode: null, focus: null, activeRec: null },
      trace: [`Pertanyaan: "${question}"`],
    }
    const contents: GContent[] = [...this.history.slice(-HISTORY_TURNS * 2), { role: 'user', parts: [{ text: question }] }]
    let answer = ''

    const body = () =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
        contents,
        tools: [{ functionDeclarations: SIMPUL_TOOLS }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'low' } },
      })
    type GResp = {
      error?: { message?: string; status?: string }
      candidates?: { content?: GContent; finishReason?: string }[]
      promptFeedback?: { blockReason?: string }
    }
    let modelName = GEMINI_MODEL
    const call = async (): Promise<{ res: Response; data: GResp }> => {
      const res = await fetch(ENDPOINT(modelName, GEMINI_API_KEY), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body(),
        signal: AbortSignal.timeout(30_000),
      })
      return { res, data: (await res.json().catch(() => ({}))) as GResp }
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      onProgress?.(round === 0 ? 'Memahami pertanyaan…' : 'Merangkai jawaban dari hasil alat…')
      let { res, data } = await call()
      // Gemini free tier kadang 429/503 sesaat, coba sekali lagi setelah jeda pendek.
      if (res.status === 429 || res.status === 503) {
        onProgress?.('Gemini sibuk, mencoba lagi…')
        await new Promise((r) => setTimeout(r, 2000))
        ;({ res, data } = await call())
      }
      // Masih gagal dan ada model cadangan: coba sekali dengan model itu.
      if (!res.ok && GEMINI_FALLBACK_MODEL && modelName !== GEMINI_FALLBACK_MODEL && res.status !== 400 && res.status !== 403) {
        modelName = GEMINI_FALLBACK_MODEL
        onProgress?.('Mencoba model cadangan…')
        ;({ res, data } = await call())
      }
      if (!res.ok) {
        const msg = data.error?.message || `HTTP ${res.status}`
        if (res.status === 400 || res.status === 403) this.llmAvailable = false // kunci salah / model tidak tersedia
        throw new Error(
          res.status === 429 ? 'Kuota Gemini sedang habis' : res.status === 503 ? 'Server Gemini sedang sibuk' : res.status === 403 || res.status === 400 ? 'Kunci API Gemini tidak diterima' : `Gemini tidak bisa dihubungi (${msg})`,
        )
      }
      this.llmAvailable = true

      const cand = data.candidates?.[0]
      const parts = cand?.content?.parts ?? []
      if (!parts.length) {
        if (data.promptFeedback?.blockReason) answer = 'Maaf, pertanyaan itu tidak bisa dijawab oleh asisten ini.'
        break
      }
      contents.push({ role: 'model', parts })
      for (const p of parts) if (p.text?.trim() && !p.thought) answer = answer ? `${answer}\n\n${p.text.trim()}` : p.text.trim()

      const calls = parts.filter((p) => p.functionCall)
      if (calls.length === 0) break

      const responses: GPart[] = calls.map((p) => {
        const name = p.functionCall!.name
        const input = (p.functionCall!.args ?? {}) as Record<string, unknown>
        const out = runTool(name, input, env)
        env.trace.push(describeTool(name, input))
        onProgress?.(`Menjalankan alat ${name}…`)
        const fr: GPart['functionResponse'] = { name, response: { result: out } }
        if (p.functionCall!.id) fr.id = p.functionCall!.id
        return { functionResponse: fr }
      })
      contents.push({ role: 'user', parts: responses })
    }

    if (!answer) answer = 'Asisten tidak menghasilkan jawaban. Coba ulangi dengan pertanyaan yang lebih spesifik.'
    const langkah = env.trace.length - 1
    env.trace.push(
      `Jawaban dirangkai AI dari ${langkah} langkah pencarian data di atas` +
        (env.ui.setBlock ? `, lalu peta dipindah ke blok ${blockMeta(env.ui.setBlock).label}` : '') +
        (env.ui.focus ? ', dan peta bergeser ke lokasi terkait' : '') +
        '.',
    )

    // Simpan ringkasan giliran (tanpa hasil alat) supaya pertanyaan lanjutan nyambung.
    const turn: GContent[] = [
      { role: 'user', parts: [{ text: question }] },
      { role: 'model', parts: [{ text: answer }] },
    ]
    this.history = [...this.history, ...turn].slice(-HISTORY_TURNS * 2)

    return {
      answer,
      setBlock: env.ui.setBlock,
      setMode: env.ui.setMode,
      focus: env.ui.focus,
      activeRec: env.ui.activeRec,
      trace: env.trace,
      facts: [],
      engine: 'llm',
      fallbackReason: null,
    }
  }
}
