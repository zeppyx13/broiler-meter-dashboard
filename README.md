# COASTHER — Smart Kandang Broiler

Dashboard admin untuk **satu peternak** yang memantau air minum dan listrik tiap kandang ayam broiler secara real-time (ESP32 + PZEM-004T + YF-S201), menormalkannya per ekor dan hari umur, lalu mengolahnya menjadi peringatan dini, prediksi, dan rekomendasi hemat energi. Dibuat untuk Lomba Prototype Pekan Insinyur Peternakan UGM 2026.

## Fitur

- **Beranda** — Ringkasan semua kandang (aktif/istirahat, siklus berjalan, pemakaian air & listrik) dan peringatan Guard lintas kandang.
- **Kandang** — Daftar kandang dengan status Aktif (hari ke-N, populasi) atau Istirahat, plus Riwayat Siklus.
- **Detail kandang**
  - **Ringkasan** — KPI air hari ini (L/ekor vs pola normal), daya saat ini, energi siklus berjalan, prediksi s.d. panen; kurva air per ekor menurut hari umur; Guard, Forecast, Eco-Advisor, dan Copilot.
  - **Catat Harian** — Deplesi (mati, afkir), bobot sampel, pakan; populasi dihitung otomatis.
  - **Mulai / Tutup Siklus** — Chick-in (populasi awal, strain, target panen) sampai panen.
- **Guard** — Peringatan berjenjang (waspada/kritis): air turun atau naik dari pola normal, daya di bawah daya terpasang (kipas mati), perangkat offline (listrik padam), tegangan tidak stabil.
- **Laporan** — Laporan efisiensi per kandang (air & listrik per ekor, biaya energi siklus, proyeksi) yang bisa dicetak/PDF.
- **Pengaturan** — Profil peternak, tarif listrik & air, cadangkan/impor data lokal.
- **Teknis** — Alat IoT (meter & kontrol relay) dan IoT Terminal.

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

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) dan masuk dengan akun yang terdaftar di backend Coasther.

Build production:

```bash
npm run build
npm start
```

## Struktur Halaman

| Route | Isi |
| --- | --- |
| `/` | Login |
| `/dashboard` | Beranda |
| `/dashboard/kamar` | Daftar kandang & riwayat siklus |
| `/dashboard/kamar/[id]` | Detail kandang (Ringkasan · Catat Harian · Pengaturan) |
| `/dashboard/tagihan` | Laporan efisiensi |
| `/dashboard/settings` | Pengaturan |
| `/dashboard/iot` | Alat IoT |
| `/dashboard/terminal` | IoT Terminal |

## Catatan untuk Backend

Backend masih memakai skema kost lama; frontend menyesuaikan tanpa mengubah API.

- **Data yang masih di browser (localStorage)** — populasi awal, strain, target panen, deplesi harian, angka meter awal/akhir siklus, fase listrik, dan daya terpasang. Lihat `src/lib/broiler-local-store.ts`. Data ini tidak sinkron antar perangkat; gunakan *Pengaturan → Cadangkan/Impor*. Idealnya dipindah ke kolom/tabel backend.
- **Field lama yang diisi otomatis** — `rooms.price_monthly` (1 saat tambah), `rooms.deposit`, `rooms.is_available`, `leases.monthly_rent_snapshot`, `leases.user_id` (akun yang login), serta kuota gratis & denda di `/api/tariff`. Sebaiknya dijadikan opsional.
- **Pemetaan istilah** — `rooms` = kandang (`floor` = blok), `leases` = siklus produksi (`start_date` = chick-in, `end_date` = panen). Status Aktif/Istirahat ditentukan dari ada-tidaknya siklus `active`.
- **Endpoint yang tidak dipakai lagi** — invoices, payments-admin, announcements, complaints, facilities, reviews, serta daftar/hapus users-admin.
- **Ambang Guard & kurva referensi air** masih konstanta di `src/lib/broiler-reference.ts` dan `src/lib/kandang-insights.ts`; sebaiknya disediakan lewat endpoint pengaturan.
