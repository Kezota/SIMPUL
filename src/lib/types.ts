/**
 * Tipe data inti WebGIS.
 *
 * Empat dataset panitia punya skema yang sama sekali berbeda satu sama lain.
 * Supaya satu mesin analisis bisa dipakai untuk keempatnya, tiap dataset punya
 * adapter yang menormalkan barisnya menjadi `Observation` — bentuk umum yang
 * hanya mensyaratkan: ada lokasi, ada judul, ada kategori, ada bukti visual.
 *
 * Alur: raw GeoJSON -> adapter -> Observation -> enrich() -> analyze()
 */

export type DatasetId = 'community' | 'menugo' | 'strukgo' | 'propertigo'

/** Kelas keterjangkauan terhadap simpul transit terdekat. */
export type AccessClass = 'inti' | 'dekat' | 'sedang' | 'luar'

export type NodeKind = 'stasiun' | 'terminal' | 'kcic' | 'krl' | 'mrt' | 'lrt' | 'lrt_jabodebek'

/** Wilayah studi — menentukan simpul transit mana yang relevan. */
export type RegionId = 'bandung' | 'jabodetabek'

/** Simpul transportasi massal (data pendukung, lihat transitNodes.ts). */
export interface TransitNode {
  id: string
  name: string
  kind: NodeKind
  region: RegionId
  lat: number
  lon: number
  /** Radius layanan untuk buffer & kolom "dalam radius", dalam meter. */
  serviceRadiusM: number
  /** Kode lintas yang melayani simpul ini (mis. B, C, R, M) — Jabodetabek. */
  lines?: string[]
  /**
   * Perkiraan jumlah keberangkatan terjadwal per blok waktu (dua arah),
   * diturunkan dari Gapeka/GTFS. Kalau tidak ada, engine memakai profil
   * relatif per jenis simpul (mode Bandung).
   */
  depByBlock?: Record<string, number>
  /** Sumber angka jadwal — ditampilkan di UI supaya bisa diaudit. */
  scheduleSource?: string
}

/** Satu kategori dalam palet warna sebuah dataset. */
export interface Category {
  id: string
  label: string
  color: string
}

/**
 * Dari mana kategori sebuah observasi berasal. Ini dibedakan secara eksplisit
 * karena menentukan seberapa jauh hasilnya boleh dipercaya:
 *   'data' — kolom kategori memang ada di data mentah panitia
 *   'ai'   — tidak ada kolom kategori; ini hasil klasifikasi teks
 */
export type CategorySource = 'data' | 'ai'

/** Hasil pengolahan teks bebas terhadap satu observasi. */
export interface Enrichment {
  tags: string[]
  /** Kata/angka harga yang berhasil ditarik dari teks bebas. */
  priceHints: string[]
  /** 0-1, kekayaan dokumentasi visual. */
  mediaScore: number
  /** 0-1, relevansi terhadap isu transportasi massal. */
  transitRelevance: number
  /** Kalimat ringkas siap tampil di popup peta. */
  aiSummary: string
  /** Keyakinan klasifikasi (hanya bermakna kalau categorySource === 'ai'). */
  categoryConfidence: number
}

/** Hasil analisis spasial terhadap satu observasi. */
export interface SpatialAttrs {
  nearestNodeId: string
  nearestNodeName: string
  distanceM: number
  accessClass: AccessClass
}

/** Bentuk umum satu titik, apa pun dataset asalnya. */
export interface Observation extends Enrichment, SpatialAttrs {
  id: string
  datasetId: DatasetId
  title: string
  /** Baris kedua di popup/tabel — alamat, menu andalan, merchant, dsb. */
  subtitle: string
  description: string
  lat: number
  lon: number
  images: string[]
  videos: string[]
  categoryId: string
  categorySource: CategorySource
  /** Harga dalam rupiah kalau datasetnya memuatnya. */
  price: number | null
  /** Waktu kejadian kalau datasetnya memuatnya. */
  when: { date: string; time: string | null } | null
  /** Kolom sisa yang ditampilkan apa adanya di panel Detail. */
  attributes: { label: string; value: string }[]
  /** Menandai baris yang lolos uji `DatasetDef.highlight`. */
  highlighted: boolean
}

/**
 * Metrik sekunder yang berbeda per dataset — menggantikan "rasio keluhan" yang
 * hanya masuk akal untuk Community Maps.
 */
export interface HighlightDef {
  label: string
  hint: string
  test: (o: Observation) => boolean
}

export interface DatasetDef {
  id: DatasetId
  label: string
  short: string
  /** Satu kalimat: dataset ini isinya apa. */
  blurb: string
  /** Nama file asal + jumlah baris, untuk panel Metodologi. */
  source: string
  region: RegionId
  /** Peran AI di dataset ini — jujur, berbeda-beda. */
  aiRole: string
  categories: Category[]
  categorySource: CategorySource
  highlight: HighlightDef
  /** Kolom tambahan yang layak muncul di tabel atribut. */
  extraColumns: { key: 'price' | 'when' | 'category'; label: string }[]
  load: () => { observations: Observation[]; dropped: number; notes: string[] }
}

/** Agregasi per simpul transit — unit analisis utama WebGIS ini. */
export interface NodeStats {
  node: TransitNode
  /** Observasi yang simpul terdekatnya adalah simpul ini (pembagian Voronoi). */
  observations: Observation[]
  count: number
  /** Bagian dari catchment yang benar-benar dalam radius layanan. */
  withinRadius: number
  /** Σ exp(-d/1500) atas catchment — volume yang meluruh terhadap jarak. */
  weightedVolume: number
  highlightCount: number
  highlightRatio: number
  avgDistanceM: number
  medianPrice: number | null
  categoryMix: { categoryId: string; count: number }[]
  dominantCategory: string | null
  /** 0-100. Lihat analysis.ts untuk rumusnya. */
  pulseIndex: number
}

export interface Insights {
  total: number
  withinServiceArea: number
  coverageRatio: number
  blankSpots: Observation[]
  categoryCounts: { categoryId: string; count: number }[]
  accessCounts: { cls: AccessClass; count: number }[]
  highlightRatio: number
  medianDistanceM: number
  medianPrice: number | null
  topNode: NodeStats | null
  weakestNode: NodeStats | null
}

export interface Filters {
  categories: string[]
  access: AccessClass[]
  onlyHighlighted: boolean
  maxDistanceM: number
  search: string
  nodeId: string | null
}
