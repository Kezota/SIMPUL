# Denyut Simpul

Prototipe WebGIS untuk eksplorasi **MAPID WebGIS Competition 2026** — memetakan laporan warga Community Maps terhadap simpul transportasi massal Bandung Raya.

```bash
npm install
```

```bash
npm run dev
```

## Dokumentasi

- **[PROJECT.md](PROJECT.md)** — apa yang dibangun, stack, struktur file, peran AI, status terhadap ketentuan lomba, dan yang belum dikerjakan.
- **[DATA-DAN-ANALISIS.md](DATA-DAN-ANALISIS.md)** — data apa yang dipakai, cleaning-nya apa, rumus analisisnya bagaimana, dan angka apa yang keluar.

## Basemap

Kompetisi mewajibkan MAPID MAPS sebagai basemap utama. Sementara ini memakai CARTO/OSM. Begitu style URL-nya ada:

```bash
echo 'VITE_MAPID_STYLE_URL=<style url dari MAPID MAPS>' > .env.local
```

Tidak ada kode lain yang perlu diubah.
