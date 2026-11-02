// Kurva referensi konsumsi air broiler per ekor per hari umur.
// Estimasi umum (bukan data strain spesifik) dikalibrasi mendekati pola pada
// literatur manajemen broiler (mis. Aviagen Ross Broiler Management Handbook):
// ±0,205 L/ekor pada hari ke-21, ±0,30 L/ekor mendekati hari ke-35.
const WATER_CURVE_A = 0.02118;
const WATER_CURVE_B = 0.7454;

export function expectedWaterPerBirdLPerDay(ageDays: number): number {
    const day = Math.max(1, ageDays);
    return WATER_CURVE_A * Math.pow(day, WATER_CURVE_B);
}

export function expectedWaterRangeLPerDay(ageDays: number, tolerance = 0.15) {
    const mid = expectedWaterPerBirdLPerDay(ageDays);
    return {
        mid,
        low: mid * (1 - tolerance),
        high: mid * (1 + tolerance),
    };
}

export type DeviationTier = "normal" | "waspada" | "kritis";

export function classifyWaterDeviation(actualPerBirdL: number, ageDays: number): {
    pct: number;
    tier: DeviationTier;
    direction: "turun" | "naik" | "normal";
} {
    const expected = expectedWaterPerBirdLPerDay(ageDays);
    if (expected <= 0) return { pct: 0, tier: "normal", direction: "normal" };

    const pct = ((actualPerBirdL - expected) / expected) * 100;

    if (pct <= -25) return { pct, tier: "kritis", direction: "turun" };
    if (pct <= -10) return { pct, tier: "waspada", direction: "turun" };
    if (pct >= 40) return { pct, tier: "waspada", direction: "naik" }; // indikasi kebocoran / rembes
    return { pct, tier: "normal", direction: pct >= 0 ? "naik" : "turun" };
}

export function classifyPowerDeviation(actualKw: number, expectedKw: number, deviceOnline: boolean): {
    pct: number;
    tier: DeviationTier;
} {
    if (!deviceOnline) return { pct: -100, tier: "kritis" };
    if (expectedKw <= 0) return { pct: 0, tier: "normal" };

    const pct = ((actualKw - expectedKw) / expectedKw) * 100;
    if (pct <= -30) return { pct, tier: "kritis" };
    if (pct <= -15) return { pct, tier: "waspada" };
    return { pct, tier: "normal" };
}

export function ageDaysFromChickIn(chickInDate: string | null | undefined): number | null {
    if (!chickInDate) return null;
    const start = new Date(chickInDate);
    if (Number.isNaN(start.getTime())) return null;
    const diffMs = Date.now() - start.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function daysUntilHarvest(ageDays: number, harvestTargetDays: number): number {
    return Math.max(0, harvestTargetDays - ageDays);
}

export const TELEMETRY_FRESH_WINDOW_MS = 2 * 60 * 1000;

export function isTelemetryFresh(recordedAt: string | null | undefined): boolean {
    if (!recordedAt) return false;
    const diff = Date.now() - new Date(recordedAt).getTime();
    return diff >= 0 && diff < TELEMETRY_FRESH_WINDOW_MS;
}

export function formatRupiah(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}
