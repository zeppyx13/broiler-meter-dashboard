// Jadwal kejadian demo — satu sumber untuk simulasi telemetri, riwayat peringatan,
// dan angka keandalan data, supaya semuanya saling cocok.
//
// - Kandang A01 (id 1): kipas trip karena motor panas, tiap hari 13.40–13.58.
// - Kandang B01 (id 3): tegangan PLN turun saat beban puncak, tiap hari 18.20–18.35.
// - WiFi kandang putus 2–4 menit di ±50% hari (data disimpan ESP32 lalu dikirim ulang).
// - Listrik PLN padam 12–30 menit sekitar 1× per 5 hari di seluruh peternakan
//   (hanya di hari-hari sebelumnya, supaya demo hari ini tidak tiba-tiba padam).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type GapReason = "wifi" | "padam";
export type Gap = { start: number; end: number; reason: GapReason };

function rand(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

export function localMidnight(t: number) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function minuteOfDay(t: number) {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
}

const FAN_WINDOW = [13 * 60 + 40, 13 * 60 + 58];
const VOLTAGE_WINDOW = [18 * 60 + 20, 18 * 60 + 35];

export function fanFailure(roomId: number, t: number) {
    const m = minuteOfDay(t);
    return roomId === 1 && m >= FAN_WINDOW[0] && m < FAN_WINDOW[1];
}

export function voltageDip(roomId: number, t: number) {
    const m = minuteOfDay(t);
    return roomId === 3 && m >= VOLTAGE_WINDOW[0] && m < VOLTAGE_WINDOW[1];
}

/** Waktu mulai/selesai kejadian terjadwal (kipas/tegangan) di satu hari. */
export function scheduledOnDay(roomId: number, dayStart: number): { kind: "power" | "voltage"; start: number; end: number }[] {
    const out: { kind: "power" | "voltage"; start: number; end: number }[] = [];
    if (roomId === 1) out.push({ kind: "power", start: dayStart + FAN_WINDOW[0] * MINUTE, end: dayStart + FAN_WINDOW[1] * MINUTE });
    if (roomId === 3) out.push({ kind: "voltage", start: dayStart + VOLTAGE_WINDOW[0] * MINUTE, end: dayStart + VOLTAGE_WINDOW[1] * MINUTE });
    return out;
}

/** Putus data di satu hari untuk satu kandang. */
export function gapsOnDay(roomId: number, dayStart: number, today = localMidnight(Date.now())): Gap[] {
    const d = Math.round(dayStart / DAY);
    const gaps: Gap[] = [];
    if (dayStart < today && rand(d * 7.13) < 0.2) {
        const start = dayStart + (10 + rand(d * 3.7) * 12) * HOUR;
        gaps.push({ start, end: start + (12 + rand(d * 5.1) * 18) * MINUTE, reason: "padam" });
    }
    if (rand(d * 11.3 + roomId * 1.7) < 0.5) {
        const start = dayStart + rand(d * 2.9 + roomId * 0.37) * 23 * HOUR;
        gaps.push({ start, end: start + (2 + rand(d * 4.3 + roomId) * 2) * MINUTE, reason: "wifi" });
    }
    return gaps;
}

export function gapAt(roomId: number, t: number): Gap | null {
    const day = localMidnight(t);
    for (const dayStart of [day, day - DAY]) {
        const hit = gapsOnDay(roomId, dayStart).find((g) => t >= g.start && t < g.end);
        if (hit) return hit;
    }
    return null;
}

export function gapsBetween(roomId: number, from: number, to: number): Gap[] {
    const out: Gap[] = [];
    for (let day = localMidnight(from) - DAY; day <= to; day += DAY) {
        gapsOnDay(roomId, day).forEach((g) => {
            if (g.end > from && g.start < to) out.push({ ...g, start: Math.max(g.start, from), end: Math.min(g.end, to) });
        });
    }
    return out.sort((a, b) => a.start - b.start);
}
