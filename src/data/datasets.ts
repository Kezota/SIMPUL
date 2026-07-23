/**
 * REGISTRY DATASET + ADAPTER.
 *
 * Empat dataset panitia punya skema yang sama sekali berbeda. Modul ini yang
 * menormalkan keempatnya jadi satu bentuk (`Observation`), sehingga seluruh
 * mesin analisis — nearest-node join, kelas keterjangkauan, Indeks Denyut,
 * asisten AI — bisa dipakai ulang tanpa percabangan per dataset.
 *
 * Yang TIDAK dilakukan: menggabungkan datanya. Menggabungkan 590 titik properti
 * dengan 15 struk belanja akan membuat agregat apa pun didominasi properti dan
 * menyembunyikan yang lain. Pengguna memilih satu dataset aktif lewat tombol
 * di header; perbandingan antar dataset dilakukan dengan berpindah, bukan
 * dengan menumpuk.
 */

import communityRaw from './community.json' with { type: 'json' }
import menugoRaw from './menugo.json' with { type: 'json' }
import strukgoRaw from './strukgo.json' with { type: 'json' }
import propertigoRaw from './propertigo.json' with { type: 'json' }

import {
  classifyCommunityText,
  COMMUNITY_CATEGORIES,
  enrich,
  isComplaint,
} from '../lib/enrich'
import type {
  Category,
  DatasetDef,
  DatasetId,
  Observation,
  SpatialAttrs,
} from '../lib/types'

/* ── Utilitas bersama ────────────────────────────────────────────────────── */

type Props = Record<string, unknown>

const str = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim()

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Buang nilai kosong dan kumpulkan URL foto yang benar-benar ada. */
const photos = (p: Props, keys: string[]): string[] =>
  keys.map((k) => str(p[k])).filter((u) => u.startsWith('http'))

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'lainnya'

/** Palet 10 warna; kategori diwarnai berdasarkan urutan, jadi deterministik. */
const PALETTE = [
  '#0ea5e9', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444',
  '#ec4899', '#14b8a6', '#a3a3a3', '#6366f1', '#84cc16',
]

/** Bangun palet kategori dari nilai yang benar-benar ada di data. */
function buildCategories(
  values: string[],
  weights: Record<string, number> = {},
): { categories: Category[]; weightOf: (id: string) => number } {
  const counts = new Map<string, { label: string; n: number }>()
  for (const v of values) {
    const label = v || 'Tidak diisi'
    const id = slug(label)
    const cur = counts.get(id)
    if (cur) cur.n++
    else counts.set(id, { label, n: 1 })
  }
  const categories = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([id, { label }], i) => ({ id, label, color: PALETTE[i % PALETTE.length] }))

  return {
    categories,
    weightOf: (id) => weights[id] ?? 0.7,
  }
}

/** Koordinat di dalam bbox kasar Indonesia — menangkap lat/lon tertukar. */
const validCoord = (lat: number | null, lon: number | null): lat is number =>
  lat !== null &&
  lon !== null &&
  lat > -11 &&
  lat < 6 &&
  lon > 95 &&
  lon < 141

/** Observasi sebelum spatial join — semua kolom kecuali atribut spasial. */
type PreSpatial = Omit<Observation, keyof SpatialAttrs>

interface RowSeed {
  key: string
  /** Lolos uji DatasetDef.highlight — dihitung di adapter, bukan di luar. */
  highlighted: boolean
  title: string
  subtitle: string
  description: string
  lat: number
  lon: number
  images: string[]
  videos: string[]
  categoryId: string
  categoryLabel: string
  categoryConfidence: number
  categoryWeight: number
  price: number | null
  when: { date: string; time: string | null } | null
  attributes: { label: string; value: string }[]
  extraText?: string
  extraTags?: string[]
}

/**
 * Bagian cleaning yang sama untuk semua dataset: validasi koordinat, dedupe,
 * lalu enrichment teks. Yang berbeda per dataset hanya cara membaca kolomnya.
 */
function buildObservations(
  datasetId: DatasetId,
  features: GeoJSON.Feature[],
  toSeed: (p: Props, geom: [number, number] | null) => RowSeed | null,
): { rows: PreSpatial[]; dropped: number } {
  const seen = new Set<string>()
  const rows: PreSpatial[] = []
  let dropped = 0

  features.forEach((f, i) => {
    const p = (f.properties ?? {}) as Props
    const c = f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null
    const geom: [number, number] | null =
      c && c.length >= 2 ? [Number(c[0]), Number(c[1])] : null

    const seed = toSeed(p, geom)
    if (!seed) {
      dropped++
      return
    }
    if (seen.has(seed.key)) {
      dropped++
      return
    }
    seen.add(seed.key)

    rows.push({
      id: `${datasetId}-${i}`,
      datasetId,
      title: seed.title || '(tanpa judul)',
      subtitle: seed.subtitle,
      description: seed.description,
      lat: seed.lat,
      lon: seed.lon,
      images: seed.images,
      videos: seed.videos,
      categoryId: seed.categoryId,
      categorySource: datasetId === 'community' ? 'ai' : 'data',
      price: seed.price,
      when: seed.when,
      attributes: seed.attributes,
      highlighted: seed.highlighted,
      ...enrich({
        title: seed.title,
        description: seed.description,
        images: seed.images,
        videos: seed.videos,
        categoryWeight: seed.categoryWeight,
        categoryConfidence: seed.categoryConfidence,
        categoryLabel: seed.categoryLabel,
        extraTags: seed.extraTags,
        extraText: seed.extraText,
      }),
    })
  })

  return { rows, dropped }
}

/* ── 1. Community Maps ───────────────────────────────────────────────────── */

const communityDataset: DatasetDef = {
  id: 'community',
  label: 'Community Maps',
  short: 'Community',
  blurb:
    'Laporan bebas warga di MAPID APPS: judul, deskripsi, foto, video, lokasi. Satu-satunya dataset tanpa kolom kategori.',
  source: 'Sample_Activity_WebGIS2026.geojson — 25 baris',
  region: 'bandung',
  aiRole:
    'AI menciptakan kategori dari nol. Tidak ada kolom tema di data mentah, jadi tanpa klasifikasi teks datanya tidak bisa difilter maupun diagregasi.',
  categories: COMMUNITY_CATEGORIES,
  categorySource: 'ai',
  highlight: {
    label: 'Bernada keluhan',
    hint: 'Hasil deteksi nada dari teks judul + deskripsi',
    test: (o) => o.highlighted,
  },
  extraColumns: [{ key: 'category', label: 'Tema (AI)' }],
  load: () => {
    const weight = (id: string) =>
      COMMUNITY_CATEGORIES.find((c) => c.id === id)?.transitWeight ?? 0.3

    const { rows, dropped } = buildObservations(
      'community',
      (communityRaw as GeoJSON.FeatureCollection).features,
      (p) => {
        // lat/long datang sebagai STRING di properties, bukan angka.
        const lat = num(p.latitude)
        const lon = num(p.longitude)
        if (!validCoord(lat, lon)) return null

        const title = str(p.title)
        const description = str(p.description)
        const { categoryId, confidence } = classifyCommunityText(
          `${title} ${description}`,
        )
        const cat = COMMUNITY_CATEGORIES.find((c) => c.id === categoryId)!

        return {
          key: `${title}|${lat!.toFixed(5)}|${lon!.toFixed(5)}`,
          highlighted: isComplaint(`${title} ${description}`),
          title,
          subtitle: '',
          description,
          lat: lat!,
          lon: lon!,
          images: Array.isArray(p.images) ? (p.images as string[]) : [],
          videos: Array.isArray(p.videos) ? (p.videos as string[]) : [],
          categoryId,
          categoryLabel: cat.label,
          categoryConfidence: confidence,
          categoryWeight: weight(categoryId),
          price: null,
          when: null,
          attributes: [],
        }
      },
    )

    return {
      observations: rows as Observation[],
      dropped,
      notes: [
        'latitude/longitude tersimpan sebagai string di properties → dikonversi ke number.',
        'geometry membawa koordinat Z yang selalu 0 → diabaikan.',
        'Kategori tidak ada di data mentah; kolom "Tema" seluruhnya hasil klasifikasi teks.',
      ],
    }
  },
}

/* ── 2. Menu Go ──────────────────────────────────────────────────────────── */

const MENU_BUSY_WEIGHT: Record<string, number> = { ramai: 1, sedang: 0.6, sepi: 0.3 }

const menugoDataset: DatasetDef = {
  id: 'menugo',
  label: 'Menu Go',
  short: 'Menu Go',
  blurb:
    'Survei tempat makan: jenis tempat, menu andalan, harga rata-rata, kondisi ramai/sepi, jam kunjungan, foto tempat & menu.',
  source: 'Sample_MenuGo_WebGIS2026.geojson — 15 baris',
  region: 'jabodetabek',
  aiRole:
    'Kategori sudah ada di data. AI dipakai untuk merapikan teks bebas "Menu Utama" dan menarik indikasi harga — bukan untuk mengklasifikasi ulang.',
  categories: [],
  categorySource: 'data',
  highlight: {
    label: 'Kondisi ramai',
    hint: 'Kolom "Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?"',
    test: (o) => o.highlighted,
  },
  extraColumns: [
    { key: 'category', label: 'Jenis tempat' },
    { key: 'price', label: 'Harga rata-rata' },
    { key: 'when', label: 'Waktu kunjungan' },
  ],
  load: () => {
    const features = (menugoRaw as GeoJSON.FeatureCollection).features
    const { categories } = buildCategories(
      features.map((f) => str((f.properties as Props)['Jenis Tempat Makan'])),
    )
    menugoDataset.categories = categories

    const { rows, dropped } = buildObservations('menugo', features, (p) => {
      const lat = num(p['Latitude'])
      const lon = num(p['Longitude'])
      if (!validCoord(lat, lon)) return null

      const jenis = str(p['Jenis Tempat Makan']) || 'Tidak diisi'
      const nama = str(p['Nama Tempat Makan'])
      const menu = str(p['Apa Menu Utama/Andalan Yang Dijual?'])
      // Nilai kondisi disimpan sebagai kalimat panjang berikut penjelasannya
      // dalam kurung — ambil kata pertamanya saja.
      const kondisi = str(p['Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?'])
      const kondisiKey = kondisi.split(/[\s(]/)[0].toLowerCase()
      const keliling = str(p['Apakah Berjualan Dengan Berkeliling (Mobilitas)?'])

      return {
        key: `${nama}|${lat!.toFixed(5)}|${lon!.toFixed(5)}`,
        highlighted: kondisiKey === 'ramai',
        title: nama,
        subtitle: menu,
        description: `${jenis}. Menu andalan: ${menu || '—'}.`,
        lat: lat!,
        lon: lon!,
        images: photos(p, [
          'Foto Tempat',
          'Foto Menu 1 (Foto Menu Utama)',
          'Foto Menu 2 (Foto Menu Lainnya)',
        ]),
        videos: [],
        categoryId: slug(jenis),
        categoryLabel: jenis,
        categoryConfidence: 1,
        categoryWeight: MENU_BUSY_WEIGHT[kondisiKey] ?? 0.6,
        price: num(p['Berapa Harga Rata-rata Menu Tersebut (Per porsi)?']),
        when: { date: str(p['Tanggal']), time: str(p['Waktu']) || null },
        attributes: [
          { label: 'Kondisi pembeli', value: kondisi || '—' },
          { label: 'Berkeliling', value: keliling || '—' },
        ],
        extraText: menu,
        extraTags: menu ? menu.split(/\s+dan\s+|,\s*/).slice(0, 3) : [],
      }
    })

    return {
      observations: rows as Observation[],
      dropped,
      notes: [
        'Sampel ini berada di Depok (Margonda), BUKAN Bandung — simpul transit acuan otomatis berpindah ke koridor KRL Jabodetabek.',
        '"Kondisi Pembeli" tersimpan sebagai kalimat panjang berikut penjelasan dalam kurung → dipangkas jadi ramai/sedang/sepi.',
        'Kolom "Menu Dalam Bentuk Link Digital" kosong seluruhnya → tidak ditampilkan.',
        'Relevansi transit diturunkan dari kondisi ramai/sepi, bukan dari jenis tempatnya.',
      ],
    }
  },
}

/* ── 3. Struk Go ─────────────────────────────────────────────────────────── */

/**
 * Bobot relevansi transit per kategori merchant. E-commerce sengaja dibuat
 * sangat rendah: struk belanja online direkam di mana pun pembelinya berada,
 * jadi titiknya tidak menyatakan apa-apa tentang aktivitas di lokasi itu.
 */
const STRUK_WEIGHT: Record<string, number> = {
  'restoran-kafe': 1,
  'warung-kaki-lima': 1,
  'minimarket-supermarket': 0.9,
  apotek: 0.7,
  'e-commerce': 0.2,
}

const strukgoDataset: DatasetDef = {
  id: 'strukgo',
  label: 'Struk Go',
  short: 'Struk Go',
  blurb:
    'Bukti transaksi warga: merchant, kategori tempat, tanggal & jam transaksi, metode pembayaran, foto struk.',
  source: 'Sample_StrukGo_WebGIS2026.geojson — 15 baris',
  region: 'bandung',
  aiRole:
    'Kategori sudah ada. Peran AI berikutnya ada di foto struk: OCR nominal belanja — satu-satunya jalan mendapat angka rupiah, karena kolom totalnya kosong seluruhnya.',
  categories: [],
  categorySource: 'data',
  highlight: {
    label: 'Pembayaran non-tunai',
    hint: 'QRIS atau e-wallet — indikasi kesiapan digital merchant',
    test: (o) => o.highlighted,
  },
  extraColumns: [
    { key: 'category', label: 'Kategori tempat' },
    { key: 'when', label: 'Waktu transaksi' },
  ],
  load: () => {
    const features = (strukgoRaw as GeoJSON.FeatureCollection).features
    const { categories } = buildCategories(
      features.map((f) => str((f.properties as Props)['Kategori Tempat'])),
    )
    strukgoDataset.categories = categories

    const { rows, dropped } = buildObservations('strukgo', features, (p) => {
      const lat = num(p['Latitude'])
      const lon = num(p['Longitude'])
      if (!validCoord(lat, lon)) return null

      const kategori = str(p['Kategori Tempat']) || 'Tidak diisi'
      const merchant = str(p['Nama Tempat/Merchant'])
      const bayar = str(p['Metode Pembayaran'])
      const id = slug(kategori)

      return {
        key: str(p['ID data']) || `${merchant}|${lat!.toFixed(5)}|${lon!.toFixed(5)}`,
        highlighted: ['qris', 'e-wallet'].includes(bayar.toLowerCase()),
        title: merchant,
        subtitle: `${kategori} · ${bayar}`,
        description: `Transaksi di ${merchant} (${kategori}), dibayar dengan ${bayar || '—'}.`,
        lat: lat!,
        lon: lon!,
        images: photos(p, ['Foto Struk/Bukti bayar']),
        videos: [],
        categoryId: id,
        categoryLabel: kategori,
        categoryConfidence: 1,
        categoryWeight: STRUK_WEIGHT[id] ?? 0.6,
        price: null,
        when: {
          date: str(p['Tanggal Transaksi']),
          time: str(p['Waktu Transaksi']) || null,
        },
        attributes: [
          { label: 'Metode pembayaran', value: bayar || '—' },
          { label: 'Kontributor', value: str(p['Kontributor']) || '—' },
        ],
        extraTags: [kategori, bayar],
      }
    })

    return {
      observations: rows as Observation[],
      dropped,
      notes: [
        'Sembilan kolom berakhiran "(Lama)" kosong seluruhnya (termasuk total pengeluaran) → dibuang saat normalisasi.',
        '"Total Pengeluaran per Orang" bernilai 0 untuk semua baris → tidak dipakai sebagai angka.',
        'Kategori "E-commerce" diberi bobot relevansi transit sangat rendah: struk belanja online direkam di mana saja, jadi titiknya tidak menyatakan aktivitas di lokasi tersebut.',
      ],
    }
  },
}

/* ── 4. Properti Go ──────────────────────────────────────────────────────── */

const PROPERTI_WEIGHT: Record<string, number> = {
  kos: 1,
  rumah: 0.85,
  ruko: 0.9,
  kantor: 0.8,
  retail: 0.85,
  'retail-fnb': 0.9,
  restoran: 0.9,
  'coworking-space': 0.9,
  gudang: 0.35,
  tanah: 0.3,
}

const propertigoDataset: DatasetDef = {
  id: 'propertigo',
  label: 'Properti Go',
  short: 'Properti Go',
  blurb:
    'Properti dijual/disewa hasil survei lapangan: kategori, alamat, foto tampak depan, foto spanduk. Dataset terbesar — 590 titik.',
  source: 'Properti Go Bandung.geojson — 590 baris',
  region: 'bandung',
  aiRole:
    'Kategori sudah ada. Peran AI paling bernilai justru di "Foto Tampak Depan": klasifikasi visual kondisi bangunan dan aksesibilitas (undakan, ramp, lebar pintu) — persis contoh yang panitia tulis di tabel C.2.',
  categories: [],
  categorySource: 'data',
  highlight: {
    label: 'Properti kos',
    hint: 'Hunian sewa — paling terikat pada jarak ke transit harian',
    test: (o) => o.highlighted,
  },
  extraColumns: [{ key: 'category', label: 'Kategori properti' }],
  load: () => {
    const features = (propertigoRaw as GeoJSON.FeatureCollection).features
    const { categories } = buildCategories(
      features.map((f) => str((f.properties as Props)['Kategori Properti'])),
    )
    propertigoDataset.categories = categories

    const { rows, dropped } = buildObservations('propertigo', features, (p) => {
      const lat = num(p['Latitude'])
      const lon = num(p['Longitude'])
      if (!validCoord(lat, lon)) return null

      const kategori = str(p['Kategori Properti']) || 'Tidak diisi'
      const jenis = str(p['Jenis Properti'])
      const alamat = str(p['Alamat'])
      const id = slug(kategori)
      // Nama kolom tanggal punya spasi di depan pada data aslinya.
      const tanggal = str(p[' Tanggal'] ?? p['Tanggal'])
      const verifikasi = str(p['Pengecekan'])

      return {
        key: str(p['ID Data']) || `${alamat}|${lat!.toFixed(6)}|${lon!.toFixed(6)}`,
        highlighted: id === 'kos',
        title: `${kategori} · ${jenis}`,
        subtitle: alamat,
        description: `${kategori} yang ${jenis.toLowerCase()} di ${alamat}.`,
        lat: lat!,
        lon: lon!,
        images: photos(p, ['Foto Tampak Depan', 'Foto Spanduk/Papan Promosi']),
        videos: [],
        categoryId: id,
        categoryLabel: kategori,
        categoryConfidence: 1,
        categoryWeight: PROPERTI_WEIGHT[id] ?? 0.7,
        price: null,
        when: tanggal ? { date: tanggal, time: null } : null,
        attributes: [
          { label: 'Jenis', value: jenis || '—' },
          { label: 'Alamat', value: alamat || '—' },
          { label: 'Status verifikasi', value: verifikasi || 'Belum diperiksa' },
          { label: 'Kontributor', value: str(p['Kontributor']) || '—' },
        ],
        extraText: alamat,
        extraTags: [kategori, jenis],
      }
    })

    return {
      observations: rows as Observation[],
      dropped,
      notes: [
        'Nama kolom tanggal punya spasi di depan (" Tanggal") pada data aslinya → dibaca dengan kedua ejaan.',
        '32 dari 590 baris belum berstatus "Diterima" → tetap ditampilkan tapi ditandai di panel Detail, tidak dibuang diam-diam.',
        '553 koordinat unik dari 590 baris: beberapa listing berbagi titik yang sama. Dedupe memakai "ID Data", bukan koordinat, supaya listing berbeda di gedung sama tidak ikut terbuang.',
        'Kategori "Tanah" dan "Gudang" diberi bobot relevansi transit rendah — keduanya bukan tujuan perjalanan harian.',
      ],
    }
  },
}

/* ── Registry ────────────────────────────────────────────────────────────── */

export const DATASETS: DatasetDef[] = [
  communityDataset,
  propertigoDataset,
  strukgoDataset,
  menugoDataset,
]

export const getDataset = (id: DatasetId): DatasetDef =>
  DATASETS.find((d) => d.id === id) ?? DATASETS[0]

export const categoryOf = (ds: DatasetDef, id: string): Category =>
  ds.categories.find((c) => c.id === id) ?? {
    id,
    label: id,
    color: '#94a3b8',
  }
