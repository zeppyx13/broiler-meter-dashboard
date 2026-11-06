import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

// Keandalan data per alat (proposal Tabel 4: ≥ 98% data diterima).
// Endpoint ini belum ada di backend asli — lihat docs/BACKEND-HANDOFF.md §3.3.

export type DeviceGap = {
    start: string;
    end: string;
    /** "wifi" = koneksi putus, data disimpan ESP32 lalu dikirim ulang; "padam" / "restart" = data hilang. */
    reason: "wifi" | "padam" | "restart";
    buffered: boolean;
};

export type DeviceHealth = {
    room_id: number;
    number: string;
    expected: number; // jumlah paket yang seharusnya (1 tiap 5 detik)
    received: number; // diterima, termasuk yang dikirim ulang dari buffer
    resent: number; // dikirim ulang dari offline buffer
    uptime_pct: number;
    gaps: DeviceGap[];
};

export async function getDeviceHealth(days = 7): Promise<DeviceHealth[]> {
    const token = getToken();
    const response = await api.get("/api/iot/health", {
        params: { days },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data.data ?? [];
}
