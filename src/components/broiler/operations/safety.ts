export type DeviceSafety = { is_active: boolean | number; connectivity_status?: string; last_seen_at?: string | null; stale_after_seconds?: number; device_type?: string; firmware_version?: string | null };
export type RelaySafety = { is_enabled: boolean | number; channel: number };
export type RelayCommandSafety = { status: string; requested_at?: string | null };
export type RelayPreflight = { allowed: boolean; reason: string; reason_code?: string; pending_command_id?: number | null; timeout_at?: string | null; retry_after_ms?: number; server_time?: string };

/** A UI preflight only: the server must recheck scope, heartbeat and transport. */
export function relayAvailability(input: { allowed: boolean; source: "real"; relay: RelaySafety; device?: DeviceSafety; command?: RelayCommandSafety; preflight?: RelayPreflight; now?: number }) {
    if (!input.allowed) return { allowed: false, reason: "Izin Relay Manual belum tersedia untuk akun Anda pada kandang ini. Hubungi Owner farm." };
    // The server reconciles expired reservations and uses its own clock/transport state.
    // A browser timer, desired state, or missing firmware ACK never grants permission.
    if (input.preflight) return { allowed: input.preflight.allowed, reason: input.preflight.reason };
    if (!input.relay.is_enabled || input.relay.channel !== 1) return { allowed: false, reason: "Mapping relay tidak aktif atau kanal tidak didukung firmware v3.1." };
    const device = input.device;
    if (!device || !device.is_active || device.connectivity_status !== "online") return { allowed: false, reason: "Perangkat belum memiliki koneksi aktif yang dipercaya server." };
    if (device.device_type !== "esp32" || !["3.1", "v3.1", "3.2", "v3.2"].includes(device.firmware_version ?? "")) return { allowed: false, reason: "Kontrol memerlukan ESP32 dengan firmware v3.1/3.2 yang terdaftar." };
    const age = (input.now ?? Date.now()) - Date.parse(device.last_seen_at ?? "");
    if (!Number.isFinite(age) || age < 0 || age > (device.stale_after_seconds ?? 120) * 1000) return { allowed: false, reason: "Heartbeat tidak tersedia, stale, atau timestamp tidak sah." };
    if (input.command && ["queued", "published", "requested"].includes(input.command.status)) return { allowed: false, reason: "Masih ada perintah yang menunggu hasil. Muat ulang setelah status server berubah; jangan mengirim ulang otomatis." };
    return { allowed: true, reason: "Preflight UI terpenuhi. Server tetap memvalidasi ulang setiap permintaan." };
}

export function parseLocalArchive(text: string) {
    if (text.length > 5_000_000) throw new Error("Arsip terlalu besar. Batas pratinjau 5 MB.");
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Format arsip tidak sah.");
    const archive = parsed as { app?: unknown; data?: unknown; exported_at?: unknown };
    if (archive.app !== "coasther" || !archive.data || typeof archive.data !== "object" || Array.isArray(archive.data)) throw new Error("File bukan cadangan Coasther yang didukung.");
    const entries = Object.entries(archive.data);
    if (entries.length > 1000 || entries.some(([key]) => !/^coasther_(room_extra_\d+|cycle_extra_\d+|daily_records_\d+|daily_baseline_\d+|daily_water_\d+|guard_settings|alert_log|calibration|impact_settings)$/.test(key))) throw new Error("Arsip berisi kunci yang tidak didukung. Tidak ada data yang diimpor.");
    return { app: "coasther" as const, exported_at: typeof archive.exported_at === "string" ? archive.exported_at : null, entries: entries.map(([key, value]) => ({ key, count: Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 1, value })) };
}
