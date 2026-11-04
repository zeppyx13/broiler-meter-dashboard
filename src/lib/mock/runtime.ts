// Penggerak alat demo: memajukan simulasi, mengirim telemetri & log (pengganti
// Socket.IO), dan menjalankan perintah dari Alat IoT / Terminal / tombol relay.

import type { LiveStatus } from "@/lib/live-status-api";
import type { DeviceGap, DeviceHealth } from "@/lib/device-health-api";
import { getDB, getSim, saveSim } from "./db";
import { gapsBetween } from "./incidents";
import { SAMPLE_MS, advanceDevice, fanFailure, liveCycleCtx, takeSample, voltageDip, type DeviceState } from "./simulator";

type Listener = (...args: unknown[]) => void;
const listeners = new Map<string, Set<Listener>>();

export const demoBus = {
    on(event: string, fn: Listener) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
    },
    off(event: string, fn: Listener) {
        listeners.get(event)?.delete(fn);
    },
    emit(event: string, ...args: unknown[]) {
        listeners.get(event)?.forEach((fn) => fn(...args));
    },
};

type LogLevel = "INFO" | "WARN" | "ERROR" | "SYSTEM";

function log(level: LogLevel, msg: string) {
    demoBus.emit("iot_log", { level, msg, ts: new Date().toISOString() });
}

function deviceFor(roomId: number, now: number): DeviceState {
    const sim = getSim();
    // Kandang baru: alat baru dipasang, meter mulai dari 0.
    sim.devices[roomId] ??= { water: 0, energy: 0, t: now, relayOn: true, offlineUntil: 0, sample: null };
    return sim.devices[roomId];
}

/** Majukan semua alat sampai sekarang. Return pembacaan baru (untuk dikirim lewat socket). */
export function syncDevices(now = Date.now()): LiveStatus[] {
    const db = getDB();
    const sim = getSim();
    const fresh: LiveStatus[] = [];
    db.rooms.forEach((room) => {
        const dev = deviceFor(room.id, now);
        const ctx = liveCycleCtx(room, db.leases);
        advanceDevice(dev, room.id, ctx, now);
        const sample = takeSample(dev, room, ctx, now);
        if (sample) fresh.push(sample);
    });
    // Alat milik kandang yang sudah dihapus ikut dilepas.
    Object.keys(sim.devices).forEach((id) => {
        if (!db.rooms.some((r) => String(r.id) === id)) delete sim.devices[id];
    });
    saveSim();
    return fresh;
}

export function liveStatusList(): LiveStatus[] {
    syncDevices();
    const sim = getSim();
    return getDB().rooms
        .map((room) => sim.devices[room.id]?.sample)
        .filter((s): s is LiveStatus => Boolean(s));
}

// ── Detak 5 detik (seperti ESP32 mengirim data) ────────────────────────────

let ticker: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

export function startTicker() {
    if (ticker || typeof window === "undefined") return;
    log("SYSTEM", "Terhubung ke broker MQTT (mode demo).");
    ticker = setInterval(() => {
        const samples = syncDevices();
        samples.forEach((s) => demoBus.emit("telemetry_update", s));
        tickCount++;

        // Satu baris log per detak, bergiliran antar alat.
        const s = samples[tickCount % Math.max(1, samples.length)];
        if (s) {
            log("INFO", `[ESP32-${s.number}] publish ok · ${s.flow_rate_lpm.toFixed(2)} L/min · ${(s.power / 1000).toFixed(2)} kW · ${s.voltage.toFixed(0)} V`);
        }
        // Kejadian di kandang ikut tercatat di log alat (tiap ±1 menit).
        if (tickCount % 12 === 0) {
            const now = Date.now();
            getDB().rooms.forEach((room) => {
                if (fanFailure(room.id, now)) log("WARN", `[ESP32-${room.number}] Beban turun mendadak — arus jalur kipas hilang.`);
                if (voltageDip(room.id, now)) log("WARN", `[ESP32-${room.number}] Tegangan rendah terdeteksi (< 198 V).`);
            });
        }
    }, SAMPLE_MS);
}

// ── Perintah alat ──────────────────────────────────────────────────────────

const COMMANDS = ["relay_on", "relay_off", "status", "sync_ntp", "clear_buf", "reset_nvs", "reboot"] as const;
export type DeviceCommand = (typeof COMMANDS)[number];

export function isDeviceCommand(cmd: unknown): cmd is DeviceCommand {
    return typeof cmd === "string" && (COMMANDS as readonly string[]).includes(cmd);
}

/** Jalankan perintah ke alat kandang. Lempar Error bila alat tidak bisa dihubungi. */
export function runDeviceCommand(roomId: number, command: DeviceCommand): string {
    const now = Date.now();
    syncDevices(now);
    const room = getDB().rooms.find((r) => r.id === roomId);
    if (!room) throw new Error("Kandang tidak ditemukan.");
    const dev = deviceFor(roomId, now);
    const tag = `[ESP32-${room.number}]`;
    if (now < dev.offlineUntil) throw new Error("Perangkat sedang restart, coba lagi sebentar.");

    switch (command) {
        case "relay_on":
        case "relay_off":
            dev.relayOn = command === "relay_on";
            log("INFO", `${tag} Relay ${dev.relayOn ? "ON" : "OFF"} — lampu & pemanas ${dev.relayOn ? "menyala" : "padam"}.`);
            break;
        case "status": {
            const uptimeH = Math.floor((now / 3_600_000) % 240);
            log("INFO", `${tag} status: online · uptime ${uptimeH} j · WiFi -${58 + (roomId % 7)} dBm · heap 182 KB · relay ${dev.relayOn ? "ON" : "OFF"}`);
            log("INFO", `${tag} meter: air ${dev.water.toFixed(1)} L · energi ${dev.energy.toFixed(3)} kWh`);
            break;
        }
        case "sync_ntp":
            log("INFO", `${tag} NTP sync ok — ${new Date(now).toLocaleString("id-ID")}`);
            break;
        case "clear_buf":
            log("INFO", `${tag} Offline buffer dibersihkan (0 paket tertunda).`);
            break;
        case "reset_nvs":
            dev.water = 0;
            dev.energy = 0;
            log("WARN", `${tag} NVS direset — counter air & kWh kembali ke 0.`);
            break;
        case "reboot":
            dev.offlineUntil = now + 25_000;
            dev.reboots = [...(dev.reboots ?? []), now].slice(-20);
            log("WARN", `${tag} Restart diminta, perangkat offline sebentar...`);
            setTimeout(() => {
                log("SYSTEM", `${tag} Boot OK · WiFi terhubung · MQTT tersambung.`);
            }, 25_000);
            break;
    }
    saveSim();
    return `Perintah ${command} terkirim ke ${tag.slice(1, -1)}.`;
}

/** Keandalan data per alat untuk `days` hari terakhir (endpoint /api/iot/health). */
export function deviceHealth(days: number): DeviceHealth[] {
    const now = Date.now();
    syncDevices(now);
    const sim = getSim();
    return getDB().rooms.map((room) => {
        const from = Math.max(now - days * 86_400_000, Date.parse(room.created_at) || now);
        const gaps: DeviceGap[] = gapsBetween(room.id, from, now).map((g) => ({
            start: new Date(g.start).toISOString(),
            end: new Date(g.end).toISOString(),
            reason: g.reason,
            buffered: g.reason === "wifi",
        }));
        (sim.devices[room.id]?.reboots ?? []).filter((t) => t >= from).forEach((t) => {
            gaps.push({ start: new Date(t).toISOString(), end: new Date(t + 25_000).toISOString(), reason: "restart", buffered: false });
        });
        const secs = (g: DeviceGap) => (Date.parse(g.end) - Date.parse(g.start)) / 1000;
        const expected = Math.max(1, Math.round((now - from) / SAMPLE_MS));
        const lost = Math.round(gaps.filter((g) => !g.buffered).reduce((s, g) => s + secs(g), 0) / (SAMPLE_MS / 1000));
        const resent = Math.round(gaps.filter((g) => g.buffered).reduce((s, g) => s + secs(g), 0) / (SAMPLE_MS / 1000));
        const received = expected - lost;
        return {
            room_id: room.id,
            number: room.number,
            expected,
            received,
            resent,
            uptime_pct: Math.round((received / expected) * 10_000) / 100,
            gaps: gaps.sort((a, b) => a.start.localeCompare(b.start)),
        };
    });
}

/** Status relay terakhir (alat asli belum melaporkannya; di demo kita tahu). */
export function relayState(roomId: number): boolean {
    return getSim().devices[roomId]?.relayOn ?? true;
}
