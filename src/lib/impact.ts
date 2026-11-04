// Hitungan dampak & balik modal COASTHER, mengikuti rumus di proposal:
// nilai per siklus = populasi × kematian yang dicegah × bobot panen × harga ayam hidup.
// Semua asumsi bisa diubah peternak (disimpan lokal).

export type ImpactSettings = {
    pricePerKg: number; // harga ayam hidup (Rp/kg)
    preventedMortalityPct: number; // kematian yang dicegah per siklus (%)
    deviceCost: number; // biaya perangkat per kandang (Rp)
    cycleDays: number; // satu siklus + istirahat kandang (hari)
};

export const DEFAULT_IMPACT_SETTINGS: ImpactSettings = {
    pricePerKg: 20_000,
    preventedMortalityPct: 1,
    deviceCost: 1_080_000,
    cycleDays: 50,
};

const KEY = "coasther_impact_settings";

export function getImpactSettings(): ImpactSettings {
    if (typeof window === "undefined") return DEFAULT_IMPACT_SETTINGS;
    try {
        const raw = window.localStorage.getItem(KEY);
        return raw ? { ...DEFAULT_IMPACT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_IMPACT_SETTINGS;
    } catch {
        return DEFAULT_IMPACT_SETTINGS;
    }
}

export function setImpactSettings(s: ImpactSettings) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
        // abaikan
    }
}

export type KandangImpact = {
    birdsSaved: number;
    valuePerCycle: number;
    paybackCycles: number | null;
    paybackMonths: number | null;
};

export function kandangImpact(population: number, harvestWeightKg: number, s: ImpactSettings, mortalityPct = s.preventedMortalityPct): KandangImpact {
    const birdsSaved = (population * mortalityPct) / 100;
    const valuePerCycle = birdsSaved * harvestWeightKg * s.pricePerKg;
    const paybackCycles = valuePerCycle > 0 ? s.deviceCost / valuePerCycle : null;
    return {
        birdsSaved,
        valuePerCycle,
        paybackCycles,
        paybackMonths: paybackCycles != null ? (paybackCycles * s.cycleDays) / 30 : null,
    };
}
