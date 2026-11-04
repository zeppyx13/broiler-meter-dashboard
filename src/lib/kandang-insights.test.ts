import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeKandangInsights, type InsightInput } from "@/lib/kandang-insights";
import { classifyPowerDeviation, classifyWaterDeviation, expectedWaterPerBirdLPerDay, isTelemetryFresh } from "@/lib/broiler-reference";
import { DEFAULT_GUARD_SETTINGS } from "@/lib/guard-settings";
import type { LiveStatus } from "@/lib/live-status-api";

// Jam 10:00 — sebelum pengingat catat harian (16:00).
const NOW = new Date("2026-11-04T10:00:00");

function live(overrides: Partial<LiveStatus> = {}): LiveStatus {
    return {
        room_id: 1,
        flow_rate_lpm: 2,
        water_total_liter: 10_000,
        voltage: 220,
        current: 10,
        power: 2000,
        energy_kwh_total: 500,
        frequency: 50,
        pf: 0.95,
        recorded_at: NOW.toISOString(),
        ...overrides,
    };
}

/** Kandang normal: hari ke-21, 1000 ekor, air sesuai pola, daya sesuai peralatan. */
function input(overrides: Partial<InsightInput> = {}): InsightInput {
    const hours = 4;
    const ageDays = 21;
    const population = 1000;
    const water = expectedWaterPerBirdLPerDay(ageDays) * population * (hours / 24);
    return {
        hasActiveCycle: true,
        ageDays,
        daysToHarvest: 14,
        harvestTargetDays: 35,
        populationNow: population,
        recordedToday: true,
        online: true,
        live: live(),
        todayUsage: { waterTodayLiter: water, energyTodayKwh: 8, since: new Date(NOW.getTime() - hours * 3_600_000), ready: true },
        cycleUsage: null,
        expectedPowerKw: 2,
        settings: DEFAULT_GUARD_SETTINGS,
        ...overrides,
    };
}

const ids = (i: InsightInput) => computeKandangInsights(i).alerts.map((a) => `${a.id}:${a.tier}`);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("Guard — kandang normal", () => {
    it("tidak memberi peringatan", () => {
        expect(ids(input())).toEqual([]);
    });

    it("kandang istirahat tidak pernah memberi peringatan", () => {
        expect(ids(input({ hasActiveCycle: false, online: false }))).toEqual([]);
    });
});

describe("Guard — perangkat offline", () => {
    it("kritis bila alat tidak mengirim data", () => {
        expect(ids(input({ online: false }))).toContain("offline:kritis");
    });

    it("tidak sekaligus menuduh daya rendah saat offline", () => {
        expect(ids(input({ online: false, live: live({ power: 0 }) }))).not.toContain("power:kritis");
    });

    it("isTelemetryFresh mengikuti batas menit offline", () => {
        expect(isTelemetryFresh(new Date(NOW.getTime() - 60_000).toISOString(), 2)).toBe(true);
        expect(isTelemetryFresh(new Date(NOW.getTime() - 3 * 60_000).toISOString(), 2)).toBe(false);
        expect(isTelemetryFresh(undefined, 2)).toBe(false);
    });
});

describe("Guard — air minum", () => {
    const base = input();
    const scaled = (factor: number) => input({ todayUsage: { ...base.todayUsage, waterTodayLiter: base.todayUsage.waterTodayLiter * factor } });

    it("waspada saat laju air turun 10–25%", () => {
        expect(ids(scaled(0.85))).toContain("water:waspada");
    });

    it("kritis saat laju air turun ≥ 25%", () => {
        expect(ids(scaled(0.6))).toContain("water:kritis");
    });

    it("waspada (indikasi bocor) saat air ≥ 40% di atas pola", () => {
        const alert = computeKandangInsights(scaled(1.5)).alerts.find((a) => a.id === "water");
        expect(alert?.tier).toBe("waspada");
        expect(alert?.title).toMatch(/di atas/);
    });

    it("tidak menilai sebelum ada 2 jam data (pagi hari)", () => {
        const early = input({ todayUsage: { waterTodayLiter: 1, energyTodayKwh: 0, since: new Date(NOW.getTime() - 30 * 60_000), ready: true } });
        expect(ids(early)).not.toContain("water:kritis");
        expect(computeKandangInsights(early).waterPerBirdPace).toBeNull();
    });

    it("tanpa populasi, air tidak dinilai", () => {
        expect(computeKandangInsights(scaled(0.1)).alerts.some((a) => a.id === "water")).toBe(true);
        expect(ids({ ...scaled(0.1), populationNow: undefined })).toEqual([]);
    });

    it("classifyWaterDeviation: ambang sesuai pengaturan", () => {
        const expected = expectedWaterPerBirdLPerDay(21);
        expect(classifyWaterDeviation(expected, 21, DEFAULT_GUARD_SETTINGS).tier).toBe("normal");
        expect(classifyWaterDeviation(expected * 0.7, 21, { ...DEFAULT_GUARD_SETTINGS, waterCritPct: 40 }).tier).toBe("waspada");
    });
});

describe("Guard — daya listrik", () => {
    it("waspada saat daya 15–30% di bawah seharusnya", () => {
        expect(ids(input({ live: live({ power: 1600 }) }))).toContain("power:waspada");
    });

    it("kritis saat daya ≥ 30% di bawah seharusnya (kipas mati)", () => {
        expect(ids(input({ live: live({ power: 1000 }) }))).toContain("power:kritis");
    });

    it("tanpa daftar peralatan, daya tidak dinilai", () => {
        expect(ids(input({ expectedPowerKw: undefined, live: live({ power: 0 }) }))).toEqual([]);
    });

    it("classifyPowerDeviation: offline dianggap kritis", () => {
        expect(classifyPowerDeviation(2, 2, false, DEFAULT_GUARD_SETTINGS).tier).toBe("kritis");
        expect(classifyPowerDeviation(2.5, 2, true, DEFAULT_GUARD_SETTINGS).tier).toBe("normal");
    });
});

describe("Guard — tegangan, PF, siklus, catatan harian", () => {
    it("waspada saat tegangan di luar 198–231 V", () => {
        expect(ids(input({ live: live({ voltage: 190 }) }))).toContain("voltage:waspada");
        expect(ids(input({ live: live({ voltage: 240 }) }))).toContain("voltage:waspada");
        expect(ids(input({ live: live({ voltage: 225 }) }))).not.toContain("voltage:waspada");
    });

    it("info saat power factor < 0,85", () => {
        expect(ids(input({ live: live({ pf: 0.7 }) }))).toContain("power-factor:info");
    });

    it("info saat siklus melewati target panen", () => {
        expect(ids(input({ ageDays: 40, daysToHarvest: 0 }))).toContain("past-harvest:info");
    });

    it("pengingat catat harian hanya muncul mulai jam 16:00", () => {
        expect(ids(input({ recordedToday: false }))).not.toContain("daily-record:info");
        vi.setSystemTime(new Date("2026-11-04T17:00:00"));
        expect(ids(input({ recordedToday: false }))).toContain("daily-record:info");
    });
});

describe("Forecast biaya siklus", () => {
    it("memproyeksikan energi sampai panen dari laju harian", () => {
        const tariff = { id: 1, water_rate: 0, water_free_quota: 0, electricity_rate: 1500, electricity_free_quota: 0, late_fee_flat: 0, updated_at: "" };
        const result = computeKandangInsights(input({
            tariff,
            daysToHarvest: 10,
            cycleUsage: { waterLiter: 0, energyKwh: 100, since: new Date(), elapsedDays: 10 },
        }));
        // 100 kWh dalam 10 hari → +10 hari lagi = 200 kWh.
        expect(result.predictedEnergyKwh).toBeCloseTo(200);
        expect(result.predictedCost).toBeCloseTo(200 * 1500);
    });
});
