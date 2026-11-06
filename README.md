# COASTHER — Smart Kandang Broiler

Dashboard admin untuk **satu peternak** yang memantau air minum dan listrik tiap kandang ayam broiler secara real-time (ESP32 + PZEM-004T + YF-S201), menormalkannya per ekor dan hari umur, lalu mengolahnya menjadi peringatan dini, prediksi, dan rekomendasi hemat energi. Dibuat untuk Lomba Prototype Pekan Insinyur Peternakan UGM 2026.

## Fitur

- **Beranda** — Status lebih dulu: berapa kandang kritis/waspada/normal, total air & daya hari ini, grafik efisiensi bulanan semua kandang (biaya listrik, listrik/ekor/hari, air/ekor/hari, 6 bulan), dan kartu tiap kandang aktif (diurutkan dari yang paling butuh tindakan).
- **Kandang** — Daftar kandang dengan status Aktif (hari ke-N, populasi) atau Istirahat.
- **Detail kandang**
  - **Bar aksi** — Catat Harian, Kontrol Relay (dengan konfirmasi), Tanya Copilot, Laporan.
  - **Ringkasan** — KPI air hari ini (L/ekor vs pola normal), daya saat ini, energi siklus, prediksi s.d. panen; grafik real-time daya & debit 30 menit; Guard, Forecast, Eco-Advisor, dan Copilot.
  - **Catat Harian** — Deplesi (mati, afkir), bobot sampel, pakan; populasi dihitung otomatis.
  - **Riwayat** — Perbandingan antar siklus: deplesi, air & listrik per ekor, biaya energi per ekor, FCR, Indeks Performa; tanda terbaik/terburuk; bisa dicetak.
  - **Mulai / Tutup Siklus** — Chick-in (populasi awal, strain, target panen) sampai panen.
- **Guard** — Peringatan berjenjang (info/waspada/kritis) dengan notifikasi browser & suara: air turun atau naik dari pola normal, daya di bawah daya seharusnya (kipas mati), perangkat offline, tegangan tidak stabil, PF rendah, lewat target panen, catatan harian belum diisi.
- **Copilot** — Chat AI yang otomatis menerima ringkasan kondisi kandang & peringatan aktif; tombol _Tanya Copilot_ di setiap kartu peringatan.
- **Rasio air : pakan** — Grafik harian di Catat Harian (liter air dari meter ÷ kg pakan), dengan pita normal 1,6–2,2 dan saran saat rendah atau tinggi.
- **Linimasa kejadian** — Di Peringatan → Linimasa: kejadian 7 hari terakhir dengan waktu deteksi, waktu dicek peternak, dan lama kejadian.
- **Laporan**:
  - Laporan efisiensi per kandang (air & listrik per ekor, biaya energi siklus, proyeksi) yang bisa dicetak/PDF.
  - **Dampak & balik modal**: nilai kematian yang dicegah per siklus vs biaya perangkat, dengan asumsi yang bisa diubah dan tabel sensitivitas.
  - **Validasi alat** mengikuti Tabel 4 proposal: akurasi sensor (form uji kalibrasi), keandalan data (≥ 98% diterima), respons Guard (target vs terukur), dan status uji lapangan.
- **Pengaturan** — Profil peternak, ambang Guard & notifikasi, tarif listrik & air, cadangkan/impor data lokal.
- **Teknis** — Alat IoT (meter & kontrol relay) dan IoT Terminal.
- **Bisa dipasang di HP** — Manifest PWA (ikon di layar utama, tampilan tanpa address bar).

## Tech Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TanStack Query · Recharts · Socket.IO client · SweetAlert2 · Poppins + Inter

## Menjalankan

```bash
npm install
```

Buat `.env` atau `.env.local` di root project:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

REST API dan Socket.IO memakai URL yang sama.

### Mode demo (default)

Secara default dashboard berjalan **tanpa backend**. Semua pemanggilan API (`src/lib/*-api.ts`) dan Socket.IO dijawab oleh backend tiruan di browser (`src/lib/mock/`), dengan bentuk respons yang sama seperti backend asli.

- Skala peternak UMKM: 4 kandang panggung/postal, yaitu A01 (600 ekor, hari ke-23), A02 (350, hari ke-31), B01 (250, hari ke-9, masa brooding), dan B02 (istirahat). Peralatannya bohlam brooder 100 W, LED 10 W, dan kipas dinding ±45 W. Listrik rumah tangga Rp 1.444,70/kWh (1.300–2.200 VA), total beban < 1 kW, dan tagihan ±Rp 500–600 rb/bulan. Masing-masing punya riwayat ±3 siklus sebelumnya beserta catatan harian, FCR, dan IP.
- Telemetri bergerak setiap 5 detik. Air mengikuti kurva hari umur × populasi, dan daya mengikuti peralatan & relay. Meter terus bertambah, termasuk saat tab ditutup.
- Kejadian terjadwal untuk Guard:
  - kipas A01 trip tiap hari 13.40–13.58 (kritis);
  - tegangan B01 turun saat beban puncak 18.20–18.35 (waspada);
  - air minum A02 sedikit di bawah pola (waspada, rasio air:pakan ±1,5);
  - WiFi kandang putus 2–4 menit di sebagian hari;
  - listrik padam sesekali di hari-hari sebelumnya.

  Riwayat 7 hari terakhir dan uji kalibrasi sudah terisi.

- Semua fitur bisa dipakai: login (email & password apa saja), tambah/ubah/hapus kandang, mulai/tutup siklus, catat harian, relay & perintah Terminal, Copilot, tarif, dan profil.
- Data tersimpan di browser. _Pengaturan → Reset data demo_ mengembalikan semuanya ke kondisi awal.

Untuk memakai backend asli, tambahkan di `.env`:

```env
NEXT_PUBLIC_USE_MOCK_API=false
```

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) dan masuk dengan akun yang terdaftar di backend Coasther.

Build production:

```bash
npm run build
npm start
```

Tes otomatis (aturan Guard, forecast, riwayat siklus, keamanan Copilot):

```bash
npm test
```

## Struktur Halaman

| Route                   | Isi                                                                          |
| ----------------------- | ---------------------------------------------------------------------------- |
| `/`                     | Login                                                                        |
| `/dashboard`            | Beranda                                                                      |
| `/dashboard/kamar`      | Daftar kandang                                                               |
| `/dashboard/kamar/[id]` | Detail kandang (Ringkasan · Catat Harian · Riwayat · Peralatan · Pengaturan) |
| `/dashboard/peringatan` | Peringatan Guard aktif & riwayat                                             |
| `/dashboard/tagihan`    | Laporan efisiensi (`?kandang=<id>` langsung membuat laporan kandang itu)     |
| `/dashboard/settings`   | Pengaturan                                                                   |
| `/dashboard/iot`        | Alat IoT                                                                     |
| `/dashboard/terminal`   | IoT Terminal                                                                 |

## Catatan untuk Backend

Backend masih memakai skema kost lama; frontend menyesuaikan tanpa mengubah API. Rincian lengkap (data di browser, endpoint yang dibutuhkan, aturan Guard, rumus metrik) ada di [docs/BACKEND-HANDOFF.md](docs/BACKEND-HANDOFF.md).

- **Data yang masih di browser (localStorage)** — populasi awal, strain, target panen, deplesi harian, angka meter awal/akhir siklus, fase listrik, dan daya terpasang. Lihat `src/lib/broiler-local-store.ts`. Data ini tidak sinkron antar perangkat; gunakan _Pengaturan → Cadangkan/Impor_. Idealnya dipindah ke kolom/tabel backend.
- **Field lama yang diisi otomatis** — `rooms.price_monthly` (1 saat tambah), `rooms.deposit`, `rooms.is_available`, `leases.monthly_rent_snapshot`, `leases.user_id` (akun yang login), serta kuota gratis & denda di `/api/tariff`. Sebaiknya dijadikan opsional.
- **Pemetaan istilah** — `rooms` = kandang (`floor` = blok), `leases` = siklus produksi (`start_date` = chick-in, `end_date` = panen). Status Aktif/Istirahat ditentukan dari ada-tidaknya siklus `active`.
- **Endpoint yang tidak dipakai lagi** — invoices, payments-admin, announcements, complaints, facilities, reviews, serta daftar/hapus users-admin.
- **Ambang Guard** bisa diubah di Pengaturan (disimpan lokal); kurva referensi air masih konstanta di `src/lib/broiler-reference.ts`. Guard hanya berjalan selama dashboard terbuka — push saat aplikasi tertutup butuh Guard di backend.
- **`/api/rooms/all` bisa diakses tanpa login** — mohon diberi proteksi token.
