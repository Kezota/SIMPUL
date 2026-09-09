/**
 * Peran pengguna SIMPUL — login dummy berbasis peran (tanpa kata sandi).
 *
 * Tiga persona diambil langsung dari PRD §4 (perencana operator kereta,
 * analis jaringan bus, regulator daerah) ditambah "tamu" untuk juri/publik
 * (PRD §13: URL publik bisa dibuka tanpa login). Peran hanya mengubah SUDUT
 * PANDANG tampilan — data dan hitungannya sama untuk semua orang.
 */

import type { Recommendation } from './recommend'

export type RoleId = 'kai' | 'tj' | 'dishub' | 'tamu'

export interface Role {
  id: RoleId
  /** Nama pendek yang tampil di topbar. */
  label: string
  /** Instansi. */
  org: string
  /** Nama persona dummy (dari PRD) — supaya login terasa nyata saat demo. */
  persona: string
  icon: string
  /** Satu kalimat: apa yang dilihat peran ini. */
  focus: string
  /** Tampilan peta awal setelah masuk. */
  defaultMode: 'denyut' | 'gap'
  defaultRail: boolean
  /** Halte TransJakarta (BRT/non-BRT). */
  defaultTj: boolean
  /** Halte JakLingko / Mikrotrans — ribuan titik, dimatikan kecuali perlu. */
  defaultJak: boolean
  /** Kandidat yang menjadi wewenang peran ini ditampilkan lebih dulu. */
  owns: (r: Recommendation) => boolean
  /** Judul daftar kandidat "milik" peran. */
  ownedTitle: string
  /** Pertanyaan contoh untuk asisten. */
  suggestions: string[]
}

const isRail = (r: Recommendation) => r.kind === 'jadwal' && /KAI/.test(r.target)
const isBus = (r: Recommendation) => r.kind === 'jadwal' && /TransJakarta/.test(r.target)

export const ROLES: Role[] = [
  {
    id: 'kai',
    label: 'Perencana KAI Commuter',
    org: 'KAI Commuter · Perencanaan Operasi',
    persona: 'Andri Prasetyo',
    icon: '🚆',
    focus: 'Stasiun mana yang kawasannya ramai saat frekuensi kereta rendah.',
    defaultMode: 'gap',
    defaultRail: true,
    defaultTj: false,
    defaultJak: false,
    owns: isRail,
    ownedTitle: 'Kandidat penambahan frekuensi kereta',
    suggestions: [
      'Stasiun mana yang perlu tambahan frekuensi?',
      'Bagaimana aktivitas sekitar Stasiun Tanah Abang per blok waktu?',
      'Kenapa kandidat nomor 1 di atas nomor 2?',
      'Kawasan mana yang masih ramai setelah jam 22?',
    ],
  },
  {
    id: 'tj',
    label: 'Analis Jaringan TransJakarta',
    org: 'TransJakarta · Pengembangan Jaringan',
    persona: 'Rina Kusumawardani',
    icon: '🚌',
    focus: 'Kantong ramai yang lebih dari 1 km dari halte, dan halte yang jadwalnya tipis.',
    defaultMode: 'gap',
    defaultRail: false,
    defaultTj: true,
    defaultJak: false,
    owns: (r) => r.kind === 'jangkauan' || isBus(r),
    ownedTitle: 'Kandidat rute pengumpan & penambahan frekuensi bus',
    suggestions: [
      'Mana kantong ramai yang tak terjangkau halte?',
      'Kandidat mana yang cocok untuk rute Mikrotrans baru?',
      'Bandingkan kandidat 1 dan 2',
      'Kawasan mana yang ramai sore hari?',
    ],
  },
  {
    id: 'dishub',
    label: 'Regulator Dishub',
    org: 'Dishub DKI Jakarta · Perencanaan Transportasi',
    persona: 'Bayu Nugroho',
    icon: '🏛️',
    focus: 'Peta kesenjangan lintas moda dalam satu tampilan, siap dibawa ke rapat.',
    defaultMode: 'gap',
    defaultRail: true,
    defaultTj: true,
    defaultJak: false,
    owns: () => true,
    ownedTitle: 'Semua kandidat lintas moda',
    suggestions: [
      'Ringkas kondisi kesenjangan layanan se-Jabodetabek',
      'Berapa kandidat untuk KAI dan berapa untuk TransJakarta?',
      'Kandidat mana yang keyakinannya tinggi?',
      'Blok waktu mana yang paling banyak kesenjangannya?',
    ],
  },
  {
    id: 'tamu',
    label: 'Tamu',
    org: 'Akses publik · hanya melihat',
    persona: 'Pengunjung',
    icon: '👤',
    focus: 'Lihat semua peta dan kandidat tanpa sudut pandang operator tertentu.',
    defaultMode: 'denyut',
    defaultRail: true,
    defaultTj: false,
    defaultJak: false,
    owns: () => true,
    ownedTitle: 'Semua kandidat',
    suggestions: [
      'Ringkas kondisinya',
      'Kawasan mana yang paling ramai malam hari?',
      'Bagaimana sekitar Blok M?',
      'Apa saja kandidat yang ditemukan?',
    ],
  },
]

export const roleById = (id: RoleId | null | undefined) => ROLES.find((r) => r.id === id) ?? null

const STORAGE_KEY = 'simpul-role-v1'

export function loadRole(): Role | null {
  try {
    return roleById(localStorage.getItem(STORAGE_KEY) as RoleId | null)
  } catch {
    return null
  }
}

export function saveRole(id: RoleId | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* penyimpanan diblokir — peran hanya bertahan selama tab terbuka */
  }
}
