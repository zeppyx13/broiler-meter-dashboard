// Ringkasan kinerja Guard dari riwayat peringatan: berapa kejadian, seberapa cepat
// terdeteksi, seberapa cepat peternak mengecek, dan berapa lama kejadian berlangsung.

import type { LoggedAlert } from "@/lib/alert-log";

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const sec = (from: string, to?: string) => (to ? (new Date(to).getTime() - new Date(from).getTime()) / 1000 : null);

/** Lama kejadian: dari pertama terdeteksi sampai terakhir masih terlihat. */
export function eventDurationSec(a: LoggedAlert) {
    return Math.max(0, sec(a.firstSeen, a.lastSeen) ?? 0);
}

export function ackSec(a: LoggedAlert) {
    return a.acknowledgedAt ? Math.max(0, sec(a.firstSeen, a.acknowledgedAt) ?? 0) : null;
}

export type GuardStats = {
    events: number;
    kritis: number;
    waspada: number;
    detectionSec: { power: number | null; offline: number | null; voltage: number | null };
    detectionSamples: { power: number; offline: number; voltage: number };
    medianAckSec: number | null;
    medianDurationSec: number | null;
    unacked: number;
};

/** Hanya peringatan kritis & waspada sejak `sinceMs` (info tidak dihitung). */
export function guardStats(log: LoggedAlert[], sinceMs: number): GuardStats {
    const events = log.filter((a) => a.tier !== "info" && new Date(a.firstSeen).getTime() >= sinceMs);
    const detection = (id: string) => events.filter((a) => a.alertId === id && a.detectionSec != null).map((a) => a.detectionSec!);
    const acks = events.map(ackSec).filter((v): v is number => v != null);
    const durations = events.filter((a) => a.resolvedAt).map(eventDurationSec);
    return {
        events: events.length,
        kritis: events.filter((a) => a.tier === "kritis").length,
        waspada: events.filter((a) => a.tier === "waspada").length,
        detectionSec: { power: median(detection("power")), offline: median(detection("offline")), voltage: median(detection("voltage")) },
        detectionSamples: { power: detection("power").length, offline: detection("offline").length, voltage: detection("voltage").length },
        medianAckSec: median(acks),
        medianDurationSec: median(durations),
        unacked: events.filter((a) => !a.acknowledgedAt).length,
    };
}

export function formatSeconds(s: number | null): string {
    if (s == null) return "—";
    if (s < 90) return `${Math.round(s)} dtk`;
    const m = Math.round(s / 60);
    if (m < 90) return `${m} mnt`;
    return `${Math.floor(m / 60)} j ${m % 60} mnt`;
}
