/** Penjelasan tiap angka di UI — dipakai tombol "i" (InfoTip). Satu sumber supaya konsisten. */
export const GLOSSARY = {
  kereta_blok: 'Perkiraan jumlah keberangkatan kereta (dua arah) yang terjadwal di stasiun ini pada blok waktu terpilih. Dari jumlah perjalanan harian resmi (Gapeka/headway operator) yang dibagi ke blok memakai bobot jam sibuk.',
  skor_layanan: 'Keberangkatan di simpul ini dibanding simpul tersibuk pada blok yang sama, skala 0–100. Contoh: 32/100 = hanya sepertiga dari acuan. ≤ 35 dianggap "tipis", 35–70 "sedang", > 70 "memadai".',
  sel_ramai: 'Sel heksagon (±500 m) yang termasuk 25% teratas poin kegiatan se-wilayah pada blok itu. "Ramai" selalu relatif terhadap kawasan lain, bukan angka absolut.',
  laporan_warga: 'Jumlah laporan aktivitas dari warga (Community Maps MAPID) yang lokasinya jatuh di sel-sel tersebut. Satu laporan = satu orang menandai satu titik.',
  bukti: 'Jumlah laporan warga yang mendukung kandidat ini. Makin banyak, makin tinggi keyakinan.',
  ke_layanan: 'Jarak lurus rata-rata dari sel ke stasiun/halte terdekat. Lebih dari 1 km dianggap di luar jangkauan jalan kaki.',
  keyakinan: 'Tinggi = ≥ 8 laporan di ≥ 2 sel bersebelahan. Sedang = 3–7 laporan. Rendah = < 3 laporan (perlu survei sebelum ditindaklanjuti).',
  skor_peringkat: 'Urutan bukti terkuat lebih dulu: tak terjangkau = 3 × sel + bukti; frekuensi rendah = 2 × sel + bukti + 5 × (1 − skor layanan/100). Bukan urutan investasi.',
  aktivitas_blok: 'Total poin kegiatan dari laporan warga per blok waktu. Poin = 1 per laporan, ditambah bobot kalau warga menyebut "ramai". Klik batang untuk memindahkan peta ke blok itu.',
  tak_terjangkau: 'Sel ramai yang tidak punya stasiun/halte dalam 1 km jalan lurus.',
  frekuensi_rendah: 'Sel ramai yang punya layanan dalam 1 km, tetapi skor layanannya < 35/100 pada blok itu.',
  menyebut_ramai: 'Berapa dari laporan itu yang teksnya menyebut kondisi ramai/padat (dari kata kunci di laporan).',
  perkiraan_armada: 'Hitungan indikatif dari headway dan siklus perjalanan; asumsinya ditulis terbuka di tiap angka. Bukan rencana operasi.',
} as const

export type GlossaryKey = keyof typeof GLOSSARY
