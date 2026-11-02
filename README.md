# Coasther — Admin Dashboard

Dashboard manajemen kost berbasis web untuk admin dan manager **Coasther**, dibangun dengan Next.js 15 App Router.

## Fitur Utama

- **Dashboard** — Statistik kamar, tagihan, keluhan, dan pemakaian utilitas real-time
- **Manajemen Kamar** — CRUD kamar, upload foto, fasilitas multi-select
- **Manajemen Penghuni** — Data tenant, role, dan akun pengguna
- **Kontrak** — Buat dan kelola kontrak sewa dengan auto-fill harga
- **Tagihan & Pembayaran** — Monitor invoice, status pembayaran Midtrans, dan overdue
- **Keluhan** — Terima dan update status keluhan tenant
- **Pengumuman** — Buat pengumuman dengan FCM broadcast ke semua tenant
- **IoT Monitoring** — Pantau telemetri listrik & air per kamar secara real-time, kontrol relay
- **Fasilitas** — Manajemen fasilitas kamar
- **Pengaturan Tarif** — Konfigurasi tarif air, listrik, denda, dan free quota
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
/dashboard/kamar → Manajemen kamar<br>
/dashboard/penghuni → Manajemen penghuni<br>
/dashboard/kontrak → Manajemen kontrak sewa<br>
/dashboard/tagihan → Data invoice<br>
/dashboard/pembayaran → Data pembayaran<br>
/dashboard/keluhan → Manajemen keluhan<br>
/dashboard/pengumuman → Manajemen pengumuman<br>
/dashboard/alat-iot → Monitoring & kontrol IoT<br>
/dashboard/fasilitas → Manajemen fasilitas<br>
/dashboard/settings → Pengaturan tarif<br>

## Build Production

```bash
npm run build
npm start
```
