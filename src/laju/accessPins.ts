/**
 * Pin aksesibilitas — BUKTI KONSEP (fitur nice-to-have).
 *
 * Tiga pin pertama dilabel MANUAL oleh tim dengan benar-benar membuka foto
 * lapangan MAPID-nya (URL foto disertakan; cap tanggal ada di foto). Yang
 * dinilai hanya FITUR PERMANEN (undakan, ramp, lebar pintu) — penghalang
 * sementara (motor parkir) dicatat di alasan tapi bukan dasar vonis.
 *
 * Sisanya berstatus "belum-dinilai" dan ditambahkan otomatis di engine dari
 * titik Properti Go terdekat ke stasiun — jujur menggambarkan kondisi nyata
 * versi penuh: AI membaca ribuan foto, sebagian akan tetap tak ternilai, dan
 * titik-titik itu menjadi daftar tujuan survey activities.
 */

export type AccessStatus = 'ramah' | 'tidak-ramah' | 'belum-dinilai'

export interface AccessPin {
  id: string
  lat: number
  lon: number
  status: AccessStatus
  name: string
  reason: string
  photoUrl: string | null
  photoDate: string | null
}

export const ACCESS_PINS: AccessPin[] = [
  {
    id: 'manual-1',
    lat: -6.925951,
    lon: 107.586533,
    status: 'tidak-ramah',
    name: 'Kos 318 — Babakan Tarogong',
    reason:
      'Gerbang teralis sempit dengan bibir undakan; tidak terlihat ramp. (Foto malam — dinilai sebagian; motor parkir di depan dicatat sebagai penghalang sementara.)',
    photoUrl:
      'https://mapidstorage.s3.ap-southeast-1.amazonaws.com/general_image/wina/1781005839644_stamped_1781005834964.jpg',
    photoDate: '9 Juni 2026, 18:50',
  },
  {
    id: 'manual-2',
    lat: -6.921067,
    lon: 107.586223,
    status: 'tidak-ramah',
    name: 'Ruko Jamika',
    reason:
      'Muka bangunan langsung ke jalan tanpa trotoar; bibir lantai lebih tinggi dari jalan, tanpa ramp. (Foto malam — dinilai sebagian.)',
    photoUrl:
      'https://mapidstorage.s3.ap-southeast-1.amazonaws.com/general_image/wina/1781005611734_stamped_1781005608313.jpg',
    photoDate: '9 Juni 2026, 18:46',
  },
  {
    id: 'manual-3',
    lat: -6.931993,
    lon: 107.591206,
    status: 'belum-dinilai',
    name: 'Kontrakan — Babakan Tarogong 144',
    reason:
      'Foto malam dan pintu tertutup vegetasi — fitur permanennya tidak terlihat. Masuk daftar tujuan survey lapangan.',
    photoUrl:
      'https://mapidstorage.s3.ap-southeast-1.amazonaws.com/general_image/wina/1780917775793_stamped_1780917773043.jpg',
    photoDate: '8 Juni 2026, 18:22',
  },
]
