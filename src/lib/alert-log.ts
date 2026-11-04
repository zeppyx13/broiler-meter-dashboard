import type { AlertTier } from "@/lib/kandang-insights";
import { ALERT_TIER_ORDER } from "@/lib/kandang-insights";
import type { RoomAlert } from "@/lib/guard-scan";

// Riwayat peringatan per perangkat/browser. Satu entri per kejadian: dibuka saat
// aturan Guard pertama kali terpicu, ditutup saat kondisinya hilang.

export type LoggedAlert = {
    key: string; // `${roomId}:${alertId}`
    roomId: number;
    roomNumber: string;
    alertId: string;
    tier: AlertTier;
    title: string;
    detail: string;
    action: string;
    firstSeen: string;
    lastSeen: string;
    resolvedAt?: string;
    acknowledgedAt?: string;
    /**
     * Detik dari data alat ke peringatan muncul. Untuk "offline" = lama tanpa data
     * sampai Guard menyimpulkan perangkat/listrik mati. Hanya untuk aturan seketika.
     */
    detectionSec?: number;
};

/** Aturan yang dinilai dari satu pembacaan (bukan akumulasi harian seperti air). */
export const INSTANT_ALERT_IDS = ["offline", "power", "voltage"] as const;

const KEY = "coasther_alert_log";
const MAX_RESOLVED = 200;
// Kondisi harus hilang selama ini sebelum dianggap selesai, supaya nilai yang
// naik-turun di sekitar ambang tidak membuka-tutup peringatan terus-menerus.
const RESOLVE_GRACE_MS = 3 * 60 * 1000;

function read(): LoggedAlert[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    } catch {
        return [];
    }
}

function write(log: LoggedAlert[]) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
        // abaikan (private mode / storage penuh)
    }
}

export function getAlertLog(): LoggedAlert[] {
    return read();
}

/**
 * Cocokkan peringatan yang terdeteksi sekarang dengan riwayat.
 * Return log terbaru + peringatan yang baru muncul atau naik tingkat (untuk notifikasi).
 */
export function reconcileAlerts(current: RoomAlert[], now = new Date()): { log: LoggedAlert[]; raised: LoggedAlert[] } {
    const nowIso = now.toISOString();
    const log = read();
    const raised: LoggedAlert[] = [];
    const seen = new Set<string>();

    for (const alert of current) {
        const key = `${alert.roomId}:${alert.id}`;
        seen.add(key);
        const open = log.find((e) => e.key === key && !e.resolvedAt);

        if (open) {
            const escalated = ALERT_TIER_ORDER[alert.tier] < ALERT_TIER_ORDER[open.tier];
            Object.assign(open, {
                tier: alert.tier, title: alert.title, detail: alert.detail, action: alert.action,
                roomNumber: alert.roomNumber, lastSeen: nowIso,
            });
            if (escalated) {
                open.acknowledgedAt = undefined;
                raised.push(open);
            }
        } else {
            const entry: LoggedAlert = {
                key, roomId: alert.roomId, roomNumber: alert.roomNumber, alertId: alert.id,
                tier: alert.tier, title: alert.title, detail: alert.detail, action: alert.action,
                firstSeen: nowIso, lastSeen: nowIso,
            };
            if (alert.dataAt && (INSTANT_ALERT_IDS as readonly string[]).includes(alert.id)) {
                const sec = (now.getTime() - new Date(alert.dataAt).getTime()) / 1000;
                if (sec >= 0 && sec < 3600) entry.detectionSec = Math.round(sec);
            }
            log.push(entry);
            raised.push(entry);
        }
    }

    for (const entry of log) {
        if (!entry.resolvedAt && !seen.has(entry.key) && now.getTime() - new Date(entry.lastSeen).getTime() > RESOLVE_GRACE_MS) {
            entry.resolvedAt = nowIso;
        }
    }

    const open = log.filter((e) => !e.resolvedAt);
    const resolved = log
        .filter((e) => e.resolvedAt)
        .sort((a, b) => b.resolvedAt!.localeCompare(a.resolvedAt!))
        .slice(0, MAX_RESOLVED);
    const next = [...open, ...resolved];
    write(next);
    return { log: next, raised };
}

export function acknowledgeAlert(key: string): LoggedAlert[] {
    const log = read();
    const open = log.find((e) => e.key === key && !e.resolvedAt);
    if (open) open.acknowledgedAt = new Date().toISOString();
    write(log);
    return log;
}

export function clearAlertHistory(): LoggedAlert[] {
    const open = read().filter((e) => !e.resolvedAt);
    write(open);
    return open;
}
