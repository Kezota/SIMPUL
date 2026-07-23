/**
 * Tipe data inti WebGIS.
 *
 * Alur data: RawActivity (mentah dari MAPID) -> enrich() -> analyze() -> Activity
 */

export type ThemeId =
  | 'mobilitas'
  | 'ekonomi'
  | 'lingkungan'
  | 'infrastruktur'
  | 'sosial'
  | 'rekreasi'
  | 'lainnya'

/** Nada laporan warga, hasil ekstraksi dari teks deskripsi. */
export type Sentiment = 'keluhan' | 'netral' | 'apresiasi'

/** Kelas keterjangkauan terhadap simpul transit terdekat. */
export type AccessClass = 'inti' | 'dekat' | 'sedang' | 'luar'

export type NodeKind = 'stasiun' | 'terminal' | 'kcic'

/** Bentuk kolom persis seperti yang dikirim panitia (lihat A.3 Ketentuan Data). */
export interface RawActivity {
  title: string
  description: string
  latitude: string | number
  longitude: string | number
  medias_all?: string[]
  images?: string[]
  videos?: string[]
}

/** Simpul transportasi massal (data pendukung, lihat catatan di transitNodes.ts). */
export interface TransitNode {
  id: string
  name: string
  kind: NodeKind
  lat: number
  lon: number
  /** Radius layanan yang dipakai untuk buffer & spatial join, dalam meter. */
  serviceRadiusM: number
}

/** Hasil tahap AI/NLP terhadap satu aktivitas. */
export interface Enrichment {
  theme: ThemeId
  themeConfidence: number
  themeScores: Record<ThemeId, number>
  tags: string[]
  sentiment: Sentiment
  priceHints: string[]
  /** 0-1, kekayaan dokumentasi (foto + video). */
  mediaScore: number
  /** 0-1, seberapa relevan aktivitas ini terhadap isu transportasi massal. */
  transitRelevance: number
  /** Kalimat ringkas siap tampil di popup peta. */
  aiSummary: string
}

/** Hasil tahap analisis spasial terhadap satu aktivitas. */
export interface SpatialAttrs {
  nearestNodeId: string
  nearestNodeName: string
  distanceM: number
  accessClass: AccessClass
}

export interface Activity extends Enrichment, SpatialAttrs {
  id: string
  title: string
  description: string
  lat: number
  lon: number
  images: string[]
  videos: string[]
}

/** Agregasi per simpul transit — unit analisis utama WebGIS ini. */
export interface NodeStats {
  node: TransitNode
  /** Aktivitas yang simpul terdekatnya adalah simpul ini (pembagian Voronoi). */
  activities: Activity[]
  count: number
  /** Bagian dari catchment yang benar-benar berada dalam radius layanan. */
  withinRadius: number
  /** Σ exp(-d/1500) atas catchment — volume yang meluruh terhadap jarak. */
  weightedVolume: number
  complaintCount: number
  complaintRatio: number
  avgDistanceM: number
  themeMix: { theme: ThemeId; count: number }[]
  dominantTheme: ThemeId | null
  /** 0-100. Lihat analysis.ts untuk rumusnya. */
  pulseIndex: number
}

export interface Insights {
  total: number
  withinServiceArea: number
  coverageRatio: number
  blankSpots: Activity[]
  themeCounts: { theme: ThemeId; count: number }[]
  accessCounts: { cls: AccessClass; count: number }[]
  complaintRatio: number
  medianDistanceM: number
  topNode: NodeStats | null
  weakestNode: NodeStats | null
}

export interface Filters {
  themes: ThemeId[]
  access: AccessClass[]
  onlyComplaints: boolean
  maxDistanceM: number
  search: string
  nodeId: string | null
}
