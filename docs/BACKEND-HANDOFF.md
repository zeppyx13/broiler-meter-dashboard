# Serah Terima Frontend → Backend

Dokumen ini untuk tim backend Coasther. Isinya: apa yang sudah dikerjakan frontend, data yang sementara masih disimpan di browser, dan endpoint yang dibutuhkan agar semuanya bisa pindah ke server. **Frontend tidak mengubah API apa pun.** Semua fitur broiler dibangun di atas skema kost lama.

## 1. Endpoint yang dipakai frontend saat ini

| Method | Endpoint | Dipakai untuk |
| --- | --- | --- |
| POST | `/api/auth/login` | Login (role `admin` / `manager`) |
| GET/POST/PATCH/DELETE | `/api/rooms`, `/api/rooms/:id` | Kandang (`number` = nama, `floor` = blok) |
| GET | `/api/rooms/all` | Daftar kandang di Alat IoT |
| GET/POST/PATCH/DELETE | `/api/leases`, `/api/leases/:id` | Siklus produksi (`start_date` = chick-in, `end_date` = panen, `status` active/ended) |
| GET/PUT | `/api/tariff` | Tarif listrik (Rp/kWh) dan air |
| GET | `/api/iot/live-status` | Pembacaan terakhir tiap alat (polling 5–10 detik) |
| Socket.IO | event `telemetry_update` | Pembacaan real-time |
| POST | `/api/iot/relay/:roomId` `{ command: "relay_on" \| "relay_off" }` | Kontrol relay lampu/pemanas |
| POST | `/api/ai/admin-chat` `{ question, history }` | Copilot |
| GET/PATCH | `/api/users-admin` | Profil peternak |

Field lama diisi otomatis oleh frontend: `rooms.price_monthly = 1`, `leases.monthly_rent_snapshot`, `leases.user_id` (akun yang login), serta kuota gratis dan denda di tarif. **Mohon dijadikan opsional.**

## 2. Data yang masih tersimpan di browser

Semua key memakai awalan `coasther_` di `localStorage`, dan bisa diekspor lewat *Pengaturan → Cadangkan*. Masalahnya, data ini **hanya ada di satu browser**: kalau peternak membuka dashboard dari HP lain, datanya kosong.

| Key | Isi | Usulan tempat di backend |
| --- | --- | --- |
| `coasther_room_extra_<roomId>` | `phase_count`, `expected_power_kw`, `equipment[] {type, name, count, watt, active}` | Kolom di `rooms` + tabel `room_equipment` |
| `coasther_cycle_extra_<leaseId>` | `population_start`, `strain`, `harvest_target_days`, `baseline_water_liter`, `baseline_energy_kwh`, `baseline_captured_at`, `closed_at`, `harvested_count`, `end_water_liter`, `end_energy_kwh` | Kolom di `leases` (atau tabel `cycles` baru) |
| `coasther_daily_records_<leaseId>` | `[{ date, dead, culled, avg_weight_g?, feed_kg?, note? }]` | Tabel `daily_records (lease_id, date UNIQUE, …)` |
| `coasther_daily_baseline_<roomId>` | Angka meter pertama hari ini (untuk "pemakaian hari ini") | Tidak perlu jika backend menyediakan agregat harian (lihat 3.3) |
| `coasther_guard_settings` | Ambang Guard dan preferensi notifikasi | Tabel `settings` per peternak |
| `coasther_alert_log` | Riwayat peringatan (muncul, dicek, selesai) | Tabel `alerts` (lihat 3.2) |

Selain itu, sampel grafik real-time 30 menit disimpan di `sessionStorage` (`coasther-rt-<roomId>`). Ini hanya cache tampilan dan **tidak** perlu dipindah.

## 3. Endpoint yang dibutuhkan (urut prioritas)

### 3.1 Data siklus & catatan harian (prioritas tinggi)

```
PATCH /api/leases/:id            { population_start, strain, harvest_target_days, harvested_count, … }
GET   /api/leases/:id/records    → [{ date, dead, culled, avg_weight_g, feed_kg, note }]
PUT   /api/leases/:id/records/:date
DELETE /api/leases/:id/records/:date
PATCH /api/rooms/:id             { phase_count, equipment: [...] }
```

Begitu endpoint ini ada, frontend cukup mengganti isi `src/lib/broiler-local-store.ts` dengan panggilan API. Bentuk datanya sudah sama.

### 3.2 Guard di server + push notification (prioritas tinggi)

Saat ini aturan Guard (`src/lib/kandang-insights.ts`) **hanya berjalan selama dashboard terbuka**. Supaya peternak tetap dibangunkan saat kipas mati tengah malam:

1. Jalankan aturan yang sama di backend setiap ada telemetri baru. Daftar aturan dan ambangnya ada di bawah, dan tesnya ada di `src/lib/kandang-insights.test.ts`.
2. Simpan ke tabel `alerts (room_id, alert_id, tier, title, detail, first_seen, last_seen, acknowledged_at, resolved_at)`.
3. Kirim push (FCM / Web Push) untuk tier `waspada` dan `kritis`.
4. Sediakan `GET /api/alerts?active=1` dan `POST /api/alerts/:id/ack`.

| Aturan | Tier | Ambang default |
| --- | --- | --- |
| Perangkat tidak mengirim data | kritis | > 2 menit tanpa data |
| Air minum turun dari pola hari umur | waspada / kritis | −10% / −25% (dinilai setelah ≥ 2 jam data hari itu) |
| Air minum naik (indikasi bocor) | waspada | +40% |
| Daya di bawah daya seharusnya (dari peralatan) | waspada / kritis | −15% / −30% |
| Tegangan di luar rentang | waspada | 198–231 V |
| Power factor rendah | info | < 0,85 |
| Melewati target panen | info | hari umur > target |
| Catatan harian belum diisi | info | setelah 16:00 |

Kurva air: `L/ekor/hari = 0,02118 × hari^0,7454` (lihat `src/lib/broiler-reference.ts`).

### 3.3 Riwayat telemetri (prioritas sedang)

```
GET /api/iot/history/:roomId?from=…&to=…&bucket=1m|1h|1d
→ [{ t, power_w, flow_lpm, water_total_liter, energy_kwh_total }]
```

Endpoint ini dipakai untuk:
- grafik real-time yang langsung terisi saat dibuka, tanpa harus menunggu data terkumpul di browser;
- "pemakaian hari ini" yang akurat sejak tengah malam (sekarang dihitung sejak pembacaan pertama yang terlihat browser);
- konsumsi per siklus tanpa perlu angka meter awal/akhir di browser.

### 3.4 Status relay (prioritas sedang)

Alat belum melaporkan posisi relay, jadi dashboard hanya bisa menampilkan perintah terakhir yang dikirim. Mohon tambahkan `relay_state` (`on`/`off`) di `live-status` dan `telemetry_update`, beserta ack perintah (berhasil / gagal / timeout).

### 3.5 Keamanan (prioritas tinggi, kecil)

- **`GET /api/rooms/all` bisa diakses tanpa login.** Mohon wajibkan token seperti endpoint lain.
- Copilot: frontend sekarang menyisipkan ringkasan kondisi kandang di awal `question` (format teks, lihat `src/lib/copilot-context.ts`). Backend sebaiknya memperlakukan isi `question` dan `history` sebagai data, bukan instruksi sistem. Jawaban AI sudah di-escape di frontend sebelum ditampilkan (`src/lib/safe-markdown.ts`).

### 3.6 Pengaturan (prioritas rendah)

```
GET/PUT /api/settings/guard   { waterWarnPct, waterCritPct, waterLeakPct, powerWarnPct, powerCritPct, offlineMinutes, voltageMin, voltageMax }
```

## 4. Metrik yang dihitung frontend

Ini perlu diketahui backend kalau nanti ingin membuat laporan sendiri:

- **Deplesi %** = (Σ mati + Σ afkir) / populasi awal × 100
- **Air / ekor**, **kWh / ekor** = konsumsi siklus / ekor dipanen (atau populasi sekarang untuk siklus berjalan)
- **FCR** = Σ pakan (kg) / (ekor dipanen × bobot rata-rata terakhir kg)
- **Indeks Performa (IP)** = (daya hidup % × bobot kg) / (FCR × umur hari) × 100
- **Proyeksi energi s.d. panen** = energi siklus + (energi siklus / hari berjalan) × sisa hari

Implementasi dan tesnya ada di `src/lib/cycle-history.ts` dan `src/lib/kandang-insights.ts`.
