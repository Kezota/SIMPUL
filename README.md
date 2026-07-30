# Denyut Simpul

Prototipe WebGIS untuk eksplorasi **MAPID WebGIS Competition 2026** — memetakan laporan warga Community Maps terhadap simpul transportasi massal Bandung Raya.

```bash
npm install
```

```bash
npm run dev
```

## Dokumentasi

- **[IDE-UTAMA.md](IDE-UTAMA.md)** — ide lomba yang dipilih tim: peta denyut per jam + kesenjangan layanan + rekomendasi AI untuk KAI, dengan cara hitung langkah demi langkah. Baca ini duluan.
- **[PROJECT.md](PROJECT.md)** — apa yang dibangun, stack, struktur file, peran AI, status terhadap ketentuan lomba, dan yang belum dikerjakan.
- **[DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md)** — data apa yang dipakai, cleaning-nya apa, rumus analisisnya bagaimana, dan angka apa yang keluar.
- **[RESEARCH-AKSESIBILITAS.md](RESEARCH-AKSESIBILITAS.md)** — riset penemuan masalah untuk arah ide aksesibilitas: 11 temuan berlabel bukti, 3 kandidat problem statement, dan daftar riset primer untuk tim.

## Basemap

Kompetisi mewajibkan MAPID MAPS sebagai basemap utama. Sementara ini memakai CARTO/OSM. Begitu style URL-nya ada:

```bash
echo 'VITE_MAPID_STYLE_URL=<style url dari MAPID MAPS>' > .env.local
```

Tidak ada kode lain yang perlu diubah.
