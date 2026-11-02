# Coasther — Broiler Coop IoT Dashboard

Dashboard monitoring kandang ayam broiler (ESP32 + PZEM-004T + YF-S201) berbasis web untuk admin dan peternak **Coasther**, dibangun dengan Next.js 15 App Router.

## Fitur Utama

- **Dashboard** — Statistik kandang, laporan biaya energi, alert, dan pemakaian utilitas real-time
- **Manajemen Kandang** — CRUD kandang, upload foto, komponen multi-select
- **Manajemen Peternak** — Data peternak/PIC kandang, role, dan akun pengguna
- **Siklus Produksi** — Buat dan kelola siklus produksi (chick-in s/d estimasi panen) dengan auto-fill biaya operasional
- **Laporan Biaya Energi & Pembayaran** — Monitor laporan biaya energi per siklus, status pembayaran Midtrans, dan overdue
- **Alert & Peringatan Dini** — Terima dan tindak lanjuti alert anomali dari sensor kandang
- **Pengumuman** — Buat pengumuman dengan FCM broadcast ke semua peternak
- **IoT Monitoring** — Pantau telemetri listrik & air per kandang secara real-time, kontrol relay
- **Komponen Kandang** — Manajemen komponen perangkat kandang (ESP32, PZEM-004T, YF-S201, relay, LCD, dll.)
- **Pengaturan Tarif** — Konfigurasi tarif air, listrik, denda, dan free quota
- **Guard** — Deteksi anomali konsumsi air/listrik dan kondisi kandang (contoh/mock, menunggu integrasi backend AI)
- **Forecast** — Prediksi kebutuhan air/listrik dan estimasi biaya sampai panen (contoh/mock, menunggu integrasi backend AI)
- **Eco-Advisor** — Rekomendasi efisiensi energi & air dengan estimasi penghematan (contoh/mock, menunggu integrasi backend AI)
- **Coasther AI** — Chat asisten admin berbasis Google Gemini dengan konteks data dashboard

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Styling** — Tailwind CSS
- **State & Fetching** — TanStack Query
- **UI Feedback** — SweetAlert2
- **Realtime** — Socket.IO client
- **Font** — Poppins + Inter

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

Buat file `.env.local` di root project:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Sesuaikan URL dengan backend Coasther yang sedang berjalan.

### 3. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### 4. Login

Gunakan akun dengan role `admin` atau `manager` yang sudah terdaftar di database Coasther.

## Struktur Halaman

/ → Redirect ke /dashboard <br>
/dashboard → Halaman utama & statistik<br>
/dashboard/kamar → Manajemen kandang<br>
/dashboard/penghuni → Manajemen peternak<br>
/dashboard/kontrak → Manajemen siklus produksi<br>
/dashboard/tagihan → Laporan biaya energi<br>
/dashboard/pembayaran → Data pembayaran<br>
/dashboard/keluhan → Alert & peringatan dini<br>
/dashboard/pengumuman → Manajemen pengumuman<br>
/dashboard/iot → Monitoring & kontrol IoT<br>
/dashboard/terminal → IoT remote terminal<br>
/dashboard/fasilitas → Manajemen komponen kandang<br>
/dashboard/settings → Pengaturan tarif<br>

## Build Production

```bash
npm run build
npm start
```
