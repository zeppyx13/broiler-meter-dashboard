// Riwayat peringatan & uji kalibrasi awal untuk data demo. Kejadiannya diambil
// dari jadwal yang sama dengan simulasi (incidents.ts), jadi linimasa, angka
// keandalan data, dan grafik saling cocok.

import type { LoggedAlert } from "@/lib/alert-log";
import type { CalibrationEntry } from "@/lib/calibration";
import { DEFAULT_GUARD_SETTINGS } from "@/lib/guard-settings";
import { gapsOnDay, localMidnight, scheduledOnDay } from "./incidents";
import { mulberry32 } from "./simulator";

const DAY = 86_400_000;
const GRACE_MS = 3 * 60_000; // sama dengan RESOLVE_GRACE di alert-log
const OFFLINE_MS = DEFAULT_GUARD_SETTINGS.offlineMinutes * 60_000;

type ActiveKandang = { roomId: number; number: string; startMs: number; expectedKw: number };

const TEXT = {
    power: {
        title: "Daya kandang di bawah seharusnya",
        action: "Kemungkinan ada kipas mati. Periksa kipas satu per satu dan belt-nya.",
    },
    voltage: {
        title: "Tegangan listrik tidak stabil",
        action: "Pantau kipas dan pompa. Tegangan tidak stabil bisa merusak motor.",
    },
    offline: {
        title: "Perangkat tidak mengirim data",
        action: "Cek listrik di panel kandang dan koneksi internet perangkat. Pastikan kipas tetap menyala.",
    },
} as const;

export function seedAlertHistory(kandang: ActiveKandang[], now: number, days = 7): LoggedAlert[] {
    const log: LoggedAlert[] = [];
    const iso = (t: number) => new Date(t).toISOString();

    for (let day = localMidnight(now - days * DAY); day <= now; day += DAY) {
        for (const k of kandang) {
            const events: { id: "power" | "voltage" | "offline"; start: number; end: number; detectAfter: number }[] = [];
            scheduledOnDay(k.roomId, day).forEach((e) => events.push({ id: e.kind, start: e.start, end: e.end, detectAfter: 0 }));
            gapsOnDay(k.roomId, day).forEach((g) => events.push({ id: "offline", start: g.start, end: g.end, detectAfter: OFFLINE_MS }));

            for (const e of events) {
                if (e.start < k.startMs || e.end + GRACE_MS > now) continue; // sebelum siklus / belum selesai
                const rand = mulberry32(Math.floor(e.start / 1000) + k.roomId);
                // Data alat tiap 5 dtk, Guard memeriksa tiap ±10 dtk.
                const detectionSec = Math.round(e.detectAfter / 1000 + 2 + rand() * 10);
                const firstSeen = e.start + detectionSec * 1000;
                if (firstSeen >= e.end) continue; // putus sebentar, belum sempat dianggap offline

                const detail = e.id === "power"
                    ? `Daya aktual ${(k.expectedKw * 0.6).toFixed(2)} kW, seharusnya ${k.expectedKw.toFixed(2)} kW (-${Math.round(38 + rand() * 4)}%).`
                    : e.id === "voltage"
                        ? `Tegangan terukur ${Math.round(190 + rand() * 3)} V (normal ${DEFAULT_GUARD_SETTINGS.voltageMin}–${DEFAULT_GUARD_SETTINGS.voltageMax} V).`
                        : `Data terakhir masuk ${new Date(e.start).toLocaleString("id-ID")}.`;
                const tier = e.id === "voltage" ? "waspada" : "kritis";
                // Peternak biasanya mengecek dalam beberapa menit; sebagian peringatan waspada terlewat.
                const acked = tier === "kritis" ? rand() < 0.85 : rand() < 0.55;
                const ackAt = firstSeen + (1 + rand() * (tier === "kritis" ? 6 : 14)) * 60_000;

                log.push({
                    key: `${k.roomId}:${e.id}`,
                    roomId: k.roomId,
                    roomNumber: k.number,
                    alertId: e.id,
                    tier,
                    title: TEXT[e.id].title,
                    detail,
                    action: TEXT[e.id].action,
                    firstSeen: iso(firstSeen),
                    lastSeen: iso(e.end),
                    resolvedAt: iso(e.end + GRACE_MS),
                    acknowledgedAt: acked && ackAt < e.end + GRACE_MS ? iso(ackAt) : undefined,
                    detectionSec,
                });
            }
        }
    }
    return log.sort((a, b) => b.resolvedAt!.localeCompare(a.resolvedAt!));
}

/** Uji akurasi yang sudah dilakukan: A01 lulus, B01 air masih perlu kalibrasi. */
export function seedCalibrations(now: number): CalibrationEntry[] {
    const at = (daysAgo: number, hour: number) => new Date(localMidnight(now - daysAgo * DAY) + hour * 3_600_000).toISOString();
    const rows: [number, CalibrationEntry["type"], number, number, number, number][] = [
        // [kandang, jenis, acuan, alat, hari lalu, jam]
        [1, "listrik", 128.4, 127.1, 6, 9],
        [1, "listrik", 131.0, 129.5, 6, 10],
        [1, "listrik", 125.6, 124.0, 6, 11],
        [1, "air", 10, 10.31, 5, 8],
        [1, "air", 10, 9.78, 5, 9],
        [1, "air", 10, 10.22, 5, 10],
        [3, "listrik", 212.0, 209.3, 4, 9],
        [3, "listrik", 208.5, 206.1, 4, 10],
        [3, "listrik", 210.2, 207.6, 4, 11],
        [3, "air", 10, 10.62, 3, 8],
        [3, "air", 10, 10.48, 3, 9],
    ];
    return rows.map(([roomId, type, reference, sensor, daysAgo, hour], i) => ({
        id: `demo-${i}`,
        roomId,
        type,
        reference,
        sensor,
        at: at(daysAgo, hour),
        note: type === "air" ? "Ember 10 L di ujung jalur, 3 ulangan" : "Clamp meter di kabel fase panel kandang",
    }));
}
