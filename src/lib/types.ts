/** Jenis simpul transit Jabodetabek. */
export type NodeKind = 'krl' | 'mrt' | 'lrt' | 'lrt_jabodebek' | 'kcic' | 'stasiun' | 'terminal'

/** Simpul transportasi massal (sumber: OpenStreetMap + jadwal resmi, lihat transitData.ts). */
export interface TransitNode {
  id: string
  name: string
  kind: NodeKind
  lat: number
  lon: number
  /** Radius layanan pejalan kaki, meter (PRD: 1 km). */
  serviceRadiusM: number
  /** Kode lintas yang melayani simpul ini (mis. B, C, R, M). */
  lines?: string[]
  /**
   * Jumlah keberangkatan terjadwal per blok waktu (dua arah), diturunkan dari
   * Gapeka/headway resmi operator.
   */
  depByBlock?: Record<string, number>
  /** Sumber angka jadwal — ditampilkan di UI supaya bisa diaudit. */
  scheduleSource?: string
}
