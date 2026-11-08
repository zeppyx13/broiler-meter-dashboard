// Hitungan dampak & balik modal COASTHER.
// Nilai kematian dicegah per siklus = populasi × kematian yang dicegah × bobot panen × harga ayam hidup (rumus proposal).
// Ekonomi lahan menambahkan hemat listrik/air dan SEMUA biaya berjalan (internet, server, AI, perawatan),
// supaya ROI tidak hanya membandingkan manfaat dengan harga perangkat.
// Laporan membaca asumsi acuan tersimpan; perubahan simulasi hanya hidup di state halaman simulasi.

export type ImpactSettings = {
    pricePerKg: number; // harga ayam hidup (Rp/kg)
    harvestWeightKg: number; // bobot panen rata-rata (kg/ekor)
    preventedMortalityPct: number; // kematian yang dicegah per siklus (%)
    deviceCost: number; // biaya perangkat per kandang (Rp)
    cycleDays: number; // satu siklus + istirahat kandang (hari)
    electricitySavingPerCycle: number; // hemat listrik per kandang per siklus (Rp), isi dari hasil uji efisiensi
    waterSavingPerCycle?: number; // hemat air per kandang per siklus (Rp), nol untuk asumsi lama
    opexMonthly: number; // langganan per lahan per bulan: internet, server, AI (Rp)
    maintenancePerYear: number; // perawatan per kandang per tahun (Rp)
};

// Sumber default:
// - Rp19.500/kg: harga acuan pembelian ayam hidup di peternak (HAP, Juli 2026).
// - 1,73 kg: rata-rata bobot hidup broiler (Outlook Komoditas Daging Ayam Ras, Kementan 2024).
// - 60 hari: ±35 hari pemeliharaan + istirahat kandang ≈ 6 siklus/tahun.
// - Rp195.000/bulan: internet ±Rp100rb + VPS ±Rp87rb + AI Copilot ±Rp8rb; HiveMQ Cloud & Telegram Bot gratis.
// - Hemat listrik 0: belum ada hasil uji fisik; simulasi 500 ekor ±Rp48.500/siklus.
export const DEFAULT_IMPACT_SETTINGS: ImpactSettings = {
    pricePerKg: 19_500,
    harvestWeightKg: 1.73,
    preventedMortalityPct: 1,
    deviceCost: 1_080_000,
    cycleDays: 60,
    electricitySavingPerCycle: 0,
    waterSavingPerCycle: 0,
    opexMonthly: 195_000,
    maintenancePerYear: 100_000,
};

// Perangkat disusutkan selama ini saat menghitung titik impas populasi.
export const DEVICE_LIFETIME_YEARS = 3;

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

/** Nilai kematian dicegah per kandang dan balik modal perangkat saja (tanpa biaya operasional). */
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

export type FarmEconomics = {
    kandangCount: number;
    cyclesPerYear: number;
    mortalityValuePerCycle: number;
    electricityPerCycle: number;
    waterPerCycle: number;
    benefitPerYear: number;
    opexPerYear: number;
    investment: number;
    /** (manfaat − operasional − investasi) ÷ (investasi + operasional); null bila tidak ada biaya. */
    roiFirstYear: number | null;
    /** Investasi ÷ (manfaat − operasional) per bulan; null bila manfaat tidak menutup operasional. */
    paybackMonths: number | null;
    /** Populasi per kandang agar manfaat menutup operasional + penyusutan perangkat; null bila tidak tercapai. */
    breakEvenPopulation: number | null;
};

/** Ekonomi satu lahan: semua kandang berbagi satu langganan internet/server/AI. */
export function farmEconomics(kandangs: { population: number; harvestKg: number }[], s: ImpactSettings, mortalityPct = s.preventedMortalityPct): FarmEconomics {
    const kandangCount = kandangs.length;
    const cyclesPerYear = s.cycleDays > 0 ? 365 / s.cycleDays : 0;
    const mortalityValuePerCycle = kandangs.reduce((sum, k) => sum + kandangImpact(k.population, k.harvestKg, s, mortalityPct).valuePerCycle, 0);
    const electricityPerCycle = s.electricitySavingPerCycle * kandangCount;
    const waterPerCycle = (s.waterSavingPerCycle ?? 0) * kandangCount;
    const benefitPerYear = (mortalityValuePerCycle + electricityPerCycle + waterPerCycle) * cyclesPerYear;
    const opexPerYear = kandangCount > 0 ? s.opexMonthly * 12 + s.maintenancePerYear * kandangCount : 0;
    const investment = s.deviceCost * kandangCount;

    const cost = investment + opexPerYear;
    const roiFirstYear = cost > 0 ? (benefitPerYear - opexPerYear - investment) / cost : null;
    const netPerYear = benefitPerYear - opexPerYear;
    const paybackMonths = investment > 0 && netPerYear > 0 ? (investment / netPerYear) * 12 : null;

    // Titik impas per kandang: populasi × manfaat/ekor/tahun = bagian langganan lahan + perawatan + penyusutan perangkat.
    // Hemat listrik/air diasumsikan sebanding populasi, diskalakan dari populasi sekarang.
    const totalPopulation = kandangs.reduce((sum, k) => sum + k.population, 0);
    const avgPopulation = kandangCount > 0 ? totalPopulation / kandangCount : 0;
    const avgKg = totalPopulation > 0 ? kandangs.reduce((sum, k) => sum + k.population * k.harvestKg, 0) / totalPopulation : s.harvestWeightKg;
    const utilitySavingPerBird = avgPopulation > 0 ? (s.electricitySavingPerCycle + (s.waterSavingPerCycle ?? 0)) / avgPopulation : 0;
    const perBirdPerYear = ((mortalityPct / 100) * avgKg * s.pricePerKg + utilitySavingPerBird) * cyclesPerYear;
    const fixedPerKandang = kandangCount > 0 ? (s.opexMonthly * 12) / kandangCount + s.maintenancePerYear + s.deviceCost / DEVICE_LIFETIME_YEARS : 0;
    const breakEvenPopulation = kandangCount > 0 && perBirdPerYear > 0 ? fixedPerKandang / perBirdPerYear : null;

    return { kandangCount, cyclesPerYear, mortalityValuePerCycle, electricityPerCycle, waterPerCycle, benefitPerYear, opexPerYear, investment, roiFirstYear, paybackMonths, breakEvenPopulation };
}
