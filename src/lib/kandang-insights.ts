import type { LiveStatus } from "@/lib/live-status-api";
import type { Tariff } from "@/lib/tariff-api";
import type { TodayUsage } from "@/lib/broiler-local-store";
import {
    classifyPowerDeviation, classifyWaterDeviation, expectedWaterPerBirdLPerDay, type DeviationTier,
} from "@/lib/broiler-reference";

export type KandangAlert = {
    id: string;
    tier: DeviationTier;
    title: string;
    detail: string;
    action: string;
};

type CycleUsage = { waterLiter: number; energyKwh: number; since: Date; elapsedDays: number } | null;

export type InsightInput = {
    hasActiveCycle: boolean;
    ageDays: number | null;
    daysToHarvest: number | null;
    populationNow?: number;
    online: boolean;
    live?: LiveStatus;
    todayUsage: TodayUsage;
    cycleUsage: CycleUsage;
    expectedPowerKw?: number;
    tariff?: Tariff;
};

// Konsumsi air tidak merata sepanjang hari, tapi penilaian harus menunggu cukup data.
const MIN_HOURS_FOR_WATER_CHECK = 2;
const MIN_DAYS_FOR_FORECAST = 0.25;
// SPLN: tegangan nominal 220 V, toleransi +5% / −10%.
const VOLTAGE_MIN = 198;
const VOLTAGE_MAX = 231;

export function computeKandangInsights(input: InsightInput) {
    const { hasActiveCycle, ageDays, daysToHarvest, populationNow, online, live, todayUsage, cycleUsage, expectedPowerKw, tariff } = input;

    const hoursToday = todayUsage.since ? (Date.now() - todayUsage.since.getTime()) / 3_600_000 : 0;
    const waterPerBirdSoFar = populationNow ? todayUsage.waterTodayLiter / populationNow : null;
    const waterPerBirdPace = waterPerBirdSoFar != null && hoursToday >= MIN_HOURS_FOR_WATER_CHECK
        ? (waterPerBirdSoFar * 24) / hoursToday
        : null;
    const waterDeviation = waterPerBirdPace != null && ageDays != null
        ? classifyWaterDeviation(waterPerBirdPace, ageDays)
        : null;

    const actualPowerKw = (live?.power ?? 0) / 1000;
    const powerDeviation = expectedPowerKw ? classifyPowerDeviation(actualPowerKw, expectedPowerKw, online) : null;

    const rate = tariff?.electricity_rate ?? 0;
    const waterRate = tariff?.water_rate ?? 0;
    const cycleEnergyCost = cycleUsage && tariff ? cycleUsage.energyKwh * rate : null;
    const cycleWaterCost = cycleUsage && tariff ? (cycleUsage.waterLiter / 1000) * waterRate : null;
    const energyTodayCost = tariff ? todayUsage.energyTodayKwh * rate : null;

    const canForecast = cycleUsage != null && cycleUsage.elapsedDays >= MIN_DAYS_FOR_FORECAST && daysToHarvest != null;
    const predictedEnergyKwh = canForecast
        ? cycleUsage.energyKwh + (cycleUsage.energyKwh / cycleUsage.elapsedDays) * daysToHarvest
        : null;
    const predictedWaterM3 = canForecast
        ? (cycleUsage.waterLiter + (cycleUsage.waterLiter / cycleUsage.elapsedDays) * daysToHarvest) / 1000
        : null;
    const predictedCost = predictedEnergyKwh != null && tariff
        ? predictedEnergyKwh * rate + (predictedWaterM3 ?? 0) * waterRate
        : null;

    const alerts: KandangAlert[] = [];
    if (hasActiveCycle) {
        if (!online) {
            alerts.push({
                id: "offline",
                tier: "kritis",
                title: "Perangkat tidak mengirim data",
                detail: live?.recorded_at
                    ? `Data terakhir masuk ${new Date(live.recorded_at).toLocaleString("id-ID")}.`
                    : "Belum pernah ada data dari perangkat kandang ini.",
                action: "Cek listrik di panel kandang dan koneksi internet perangkat. Pastikan kipas tetap menyala.",
            });
        }
        if (waterDeviation && waterDeviation.tier !== "normal" && ageDays != null) {
            const turun = waterDeviation.direction === "turun";
            alerts.push({
                id: "water",
                tier: waterDeviation.tier,
                title: turun ? "Air minum di bawah pola normal" : "Air minum jauh di atas pola normal",
                detail: `Laju hari ini ${waterPerBirdPace!.toFixed(3)} L/ekor/hari, ${waterDeviation.pct >= 0 ? "+" : ""}${waterDeviation.pct.toFixed(0)}% dari pola hari ke-${ageDays} (${expectedWaterPerBirdLPerDay(ageDays).toFixed(3)} L/ekor).`,
                action: turun
                    ? "Cek tekanan regulator dan sumbatan jalur nipple, lalu amati ayam yang lesu."
                    : "Cek kebocoran nipple, pipa, dan pelampung tandon.",
            });
        }
        if (powerDeviation && powerDeviation.tier !== "normal" && online) {
            alerts.push({
                id: "power",
                tier: powerDeviation.tier,
                title: "Daya kandang di bawah seharusnya",
                detail: `Daya aktual ${actualPowerKw.toFixed(2)} kW, seharusnya ${expectedPowerKw!.toFixed(2)} kW (${powerDeviation.pct.toFixed(0)}%).`,
                action: "Kemungkinan ada kipas mati. Periksa kipas satu per satu dan belt-nya.",
            });
        }
        if (online && live && live.voltage > 0 && (live.voltage < VOLTAGE_MIN || live.voltage > VOLTAGE_MAX)) {
            alerts.push({
                id: "voltage",
                tier: "waspada",
                title: "Tegangan listrik tidak stabil",
                detail: `Tegangan terukur ${live.voltage.toFixed(0)} V (normal ${VOLTAGE_MIN}–${VOLTAGE_MAX} V).`,
                action: "Pantau kipas dan pompa. Tegangan tidak stabil bisa merusak motor.",
            });
        }
    }

    return {
        hoursToday,
        waterPerBirdSoFar,
        waterPerBirdPace,
        waterDeviation,
        actualPowerKw,
        powerDeviation,
        cycleEnergyCost,
        cycleWaterCost,
        energyTodayCost,
        predictedEnergyKwh,
        predictedWaterM3,
        predictedCost,
        alerts,
    };
}

export type KandangInsights = ReturnType<typeof computeKandangInsights>;
