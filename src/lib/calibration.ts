// Uji akurasi sensor (proposal Tabel 4): pembacaan alat dibandingkan alat acuan.
// Listrik: PZEM-004T vs clamp meter (W). Air: YF-S201 vs volume ember terukur (L).
// Disimpan lokal; tiap kandang & jenis sensor idealnya diuji ≥ 3 ulangan.

export type CalibrationType = "listrik" | "air";

export type CalibrationEntry = {
    id: string;
    roomId: number;
    type: CalibrationType;
    reference: number; // alat acuan
    sensor: number; // pembacaan COASTHER
    at: string;
    note?: string;
};

/** Batas galat dari proposal: listrik ≤ 2%, air ≤ 5% (setelah kalibrasi). */
export const CALIBRATION_LIMIT_PCT: Record<CalibrationType, number> = { listrik: 2, air: 5 };
export const CALIBRATION_UNIT: Record<CalibrationType, string> = { listrik: "W", air: "L" };
export const MIN_REPEATS = 3;

const KEY = "coasther_calibration";

export function getCalibrations(): CalibrationEntry[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    } catch {
        return [];
    }
}

function save(list: CalibrationEntry[]) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
        // abaikan
    }
}

export function addCalibration(entry: Omit<CalibrationEntry, "id" | "at">): CalibrationEntry[] {
    const list = [...getCalibrations(), { ...entry, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString() }];
    save(list);
    return list;
}

export function removeCalibration(id: string): CalibrationEntry[] {
    const list = getCalibrations().filter((e) => e.id !== id);
    save(list);
    return list;
}

export function errorPct(e: Pick<CalibrationEntry, "reference" | "sensor">) {
    return e.reference > 0 ? (Math.abs(e.sensor - e.reference) / e.reference) * 100 : NaN;
}

export type CalibrationSummary = {
    roomId: number;
    type: CalibrationType;
    entries: CalibrationEntry[];
    meanErrorPct: number;
    /** Selisih rata-rata bertanda: + berarti sensor membaca lebih tinggi dari acuan. */
    biasPct: number;
    passed: boolean;
    enoughRepeats: boolean;
};

export function summarizeCalibrations(list: CalibrationEntry[]): CalibrationSummary[] {
    const groups = new Map<string, CalibrationEntry[]>();
    list.forEach((e) => {
        const k = `${e.roomId}:${e.type}`;
        groups.set(k, [...(groups.get(k) ?? []), e]);
    });
    return [...groups.values()].map((entries) => {
        const errors = entries.map(errorPct).filter(Number.isFinite);
        const bias = entries.filter((e) => e.reference > 0).map((e) => ((e.sensor - e.reference) / e.reference) * 100);
        const meanErrorPct = errors.reduce((s, v) => s + v, 0) / Math.max(1, errors.length);
        const { roomId, type } = entries[0];
        return {
            roomId,
            type,
            entries: [...entries].sort((a, b) => a.at.localeCompare(b.at)),
            meanErrorPct,
            biasPct: bias.reduce((s, v) => s + v, 0) / Math.max(1, bias.length),
            passed: meanErrorPct <= CALIBRATION_LIMIT_PCT[type],
            enoughRepeats: entries.length >= MIN_REPEATS,
        };
    });
}
