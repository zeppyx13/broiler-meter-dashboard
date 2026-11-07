import type { LiveStatus } from "@/lib/live-status-api";
import type { Tariff } from "@/lib/tariff-api";
import type { TodayUsage } from "@/lib/broiler-local-store";
import { getGuardSettings, type GuardSettings } from "@/lib/guard-settings";
import {
    classifyPowerDeviation, classifyWaterDeviation, expectedWaterPerBirdLPerDay,
} from "@/lib/broiler-reference";

export type AlertTier = "info" | "waspada" | "kritis";

export const ALERT_TIER_ORDER: Record<AlertTier, number> = { kritis: 0, waspada: 1, info: 2 };

export type KandangAlert = {
    id: string;
    tier: AlertTier;
    title: string;
    detail: string;
    action: string;
};

type CycleUsage = { waterLiter: number | null; energyKwh: number | null; since: Date; elapsedDays: number } | null;

export type InsightInput = {
    hasActiveCycle: boolean;
    ageDays: number | null;
    daysToHarvest: number | null;
    harvestTargetDays?: number;
    populationNow?: number;
    recordedToday?: boolean;
    online: boolean;
    live?: LiveStatus;
    todayUsage: TodayUsage;
    cycleUsage: CycleUsage;
    expectedPowerKw?: number;
    tariff?: Tariff;
    settings?: GuardSettings;
};

// Konsumsi air tidak merata sepanjang hari, tapi penilaian harus menunggu cukup data.
const MIN_HOURS_FOR_WATER_CHECK = 2;
const MIN_DAYS_FOR_FORECAST = 0.25;
const LOW_POWER_FACTOR = 0.85;
// Pengingat catat harian baru muncul sore hari, saat deplesi hari itu biasanya sudah diketahui.
const DAILY_RECORD_REMINDER_HOUR = 16;

export function computeKandangInsights(input: InsightInput) {
    const {
        hasActiveCycle, ageDays, daysToHarvest, harvestTargetDays, populationNow, recordedToday,
        online, live, todayUsage, cycleUsage, expectedPowerKw, tariff,
    } = input;
    const settings = input.settings ?? getGuardSettings();

    const hoursToday = todayUsage.since ? (Date.now() - todayUsage.since.getTime()) / 3_600_000 : 0;
    const waterPerBirdSoFar = populationNow && todayUsage.waterTodayLiter != null ? todayUsage.waterTodayLiter / populationNow : null;
    const waterPerBirdPace = waterPerBirdSoFar != null && hoursToday >= MIN_HOURS_FOR_WATER_CHECK
        ? (waterPerBirdSoFar * 24) / hoursToday
        : null;
    const waterDeviation = waterPerBirdPace != null && ageDays != null
        ? classifyWaterDeviation(waterPerBirdPace, ageDays, settings)
        : null;

    const actualPowerKw = live?.power == null ? null : live.power / 1000;
    const powerDeviation = expectedPowerKw && actualPowerKw != null ? classifyPowerDeviation(actualPowerKw, expectedPowerKw, online, settings) : null;

    const rate = tariff?.electricity_rate ?? 0;
    const waterRate = tariff?.water_rate ?? 0;
    const cycleEnergyCost = cycleUsage?.energyKwh != null && tariff ? cycleUsage.energyKwh * rate : null;
    const cycleWaterCost = cycleUsage?.waterLiter != null && tariff ? (cycleUsage.waterLiter / 1000) * waterRate : null;
    const energyTodayCost = todayUsage.energyTodayKwh != null && tariff ? todayUsage.energyTodayKwh * rate : null;

    const canForecast = cycleUsage != null && cycleUsage.elapsedDays >= MIN_DAYS_FOR_FORECAST && daysToHarvest != null;
    const predictedEnergyKwh = canForecast && cycleUsage.energyKwh != null
        ? cycleUsage.energyKwh + (cycleUsage.energyKwh / cycleUsage.elapsedDays) * daysToHarvest
        : null;
    const predictedWaterM3 = canForecast && cycleUsage.waterLiter != null
        ? (cycleUsage.waterLiter + (cycleUsage.waterLiter / cycleUsage.elapsedDays) * daysToHarvest) / 1000
        : null;
    const predictedCost = predictedEnergyKwh != null && predictedWaterM3 != null && tariff
        ? predictedEnergyKwh * rate + predictedWaterM3 * waterRate
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
        if (powerDeviation && actualPowerKw != null && powerDeviation.tier !== "normal" && online) {
            alerts.push({
                id: "power",
                tier: powerDeviation.tier,
                title: "Daya kandang di bawah seharusnya",
                detail: `Daya aktual ${actualPowerKw.toFixed(2)} kW, seharusnya ${expectedPowerKw!.toFixed(2)} kW (${powerDeviation.pct.toFixed(0)}%).`,
                action: "Kemungkinan ada kipas mati. Periksa kipas satu per satu dan belt-nya.",
            });
        }
        if (online && live?.voltage != null && live.voltage > 0 && (live.voltage < settings.voltageMin || live.voltage > settings.voltageMax)) {
            alerts.push({
                id: "voltage",
                tier: "waspada",
                title: "Tegangan listrik tidak stabil",
                detail: `Tegangan terukur ${live.voltage.toFixed(0)} V (normal ${settings.voltageMin}–${settings.voltageMax} V).`,
                action: "Pantau kipas dan pompa. Tegangan tidak stabil bisa merusak motor.",
            });
        }
        if (online && live?.pf != null && live.pf > 0 && live.pf < LOW_POWER_FACTOR) {
            alerts.push({
                id: "power-factor",
                tier: "info",
                title: "Power factor rendah",
                detail: `PF terukur ${live.pf.toFixed(2)} (baik ≥ ${LOW_POWER_FACTOR}).`,
                action: "Periksa beban motor kipas/pompa; pertimbangkan kapasitor bank agar listrik lebih efisien.",
            });
        }
        if (ageDays != null && harvestTargetDays != null && ageDays > harvestTargetDays) {
            alerts.push({
                id: "past-harvest",
                tier: "info",
                title: "Siklus melewati target panen",
                detail: `Hari ke-${ageDays}, target panen hari ke-${harvestTargetDays}.`,
                action: "Bila ayam sudah dipanen, tutup siklus di halaman kandang.",
            });
        }
        if (recordedToday === false && new Date().getHours() >= DAILY_RECORD_REMINDER_HOUR) {
            alerts.push({
                id: "daily-record",
                tier: "info",
                title: "Catatan harian belum diisi",
                detail: "Deplesi hari ini belum dicatat.",
                action: "Catat ayam mati dan afkir agar populasi dan konsumsi per ekor tetap akurat.",
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
