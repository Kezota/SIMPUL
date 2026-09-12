/** Penjelasan tiap angka untuk tombol "i". Bahasa sehari-hari, tanpa rumus. */
export const GLOSSARY = {
  kereta_blok:
    'Perkiraan berapa kali kereta berangkat dari stasiun ini (dua arah) selama blok waktu yang dipilih. Angkanya dari jadwal resmi harian yang kami bagi ke tiap blok; jam sibuk mendapat porsi lebih besar.',
  skor_layanan:
    'Seberapa sering layanan berangkat di sini dibanding tempat tersibuk pada jam yang sama. Nilai 100 artinya sama seringnya dengan yang tersibuk. Di bawah 35 kami sebut tipis, 35 sampai 70 sedang, di atas 70 memadai.',
  sel_ramai:
    'Petak peta seluas kira-kira 500 meter yang masuk seperempat paling ramai se-Jabodetabek pada jam itu. Ramai di sini selalu dibandingkan dengan kawasan lain, bukan angka pasti.',
  laporan_warga:
    'Jumlah laporan yang dikirim warga lewat Community Maps MAPID di kawasan ini. Satu laporan berarti satu orang menandai satu lokasi dan menuliskan apa yang dilihatnya.',
  bukti: 'Jumlah laporan warga yang mendukung kandidat ini. Makin banyak laporan, makin yakin kami.',
  ke_layanan:
    'Jarak rata-rata dari kawasan ini ke stasiun atau halte terdekat, diukur garis lurus. Lebih dari 1 km kami anggap terlalu jauh untuk jalan kaki.',
  keyakinan:
    'Tinggi kalau ada 8 laporan atau lebih di dua petak yang bersebelahan. Sedang kalau 3 sampai 7 laporan. Rendah kalau kurang dari 3; sebaiknya disurvei dulu sebelum ditindaklanjuti.',
  skor_peringkat:
    'Kandidat diurutkan dari bukti yang paling kuat: makin luas kawasannya, makin banyak laporannya, dan makin tipis layanannya, makin tinggi urutannya. Ini bukan urutan biaya atau investasi.',
  aktivitas_blok:
    'Seberapa banyak kegiatan yang dilaporkan warga pada jam itu. Laporan yang menyebut ramai dihitung dua kali, yang menyebut sepi dihitung setengah.',
  tak_terjangkau: 'Kawasan ramai yang tidak punya stasiun atau halte dalam jarak 1 km.',
  frekuensi_rendah: 'Kawasan ramai yang punya stasiun atau halte di dekatnya, tetapi jadwalnya jarang pada jam itu.',
  menyebut_ramai: 'Berapa laporan yang di teksnya menulis kata seperti ramai, padat, atau antre. Dibaca dari teks laporan, bukan tebakan.',
  perkiraan_armada:
    'Angka kasar untuk membuka pembicaraan, dihitung dari seberapa sering layanan berangkat dan berapa lama satu perjalanan pulang pergi. Bukan rencana operasi.',
  pantau:
    'Kawasan ini keramaiannya tingkat sedang, belum masuk seperempat teratas, tetapi layanannya sudah tipis. Belum mendesak; cukup dipantau dan disurvei.',
  prioritas: 'Kawasan yang masuk seperempat paling ramai se-Jabodetabek pada jam itu dan layanan transitnya kurang.',
} as const

export type GlossaryKey = keyof typeof GLOSSARY
