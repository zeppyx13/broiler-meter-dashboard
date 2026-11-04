import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthlyEfficiency, rankMetric, summarizeCycle } from "@/lib/cycle-history";
import { setCycleExtra, upsertDailyRecord } from "@/lib/broiler-local-store";
import type { Lease } from "@/types/lease";

// localStorage tiruan secukupnya untuk broiler-local-store.
beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
        },
    });
});

function lease(id: number, overrides: Partial<Lease> = {}): Lease {
    return {
        id, user_id: 1, room_id: 7, start_date: "2026-09-01", end_date: "2026-10-06", status: "ended",
        monthly_rent_snapshot: 1, note: null, created_at: "", updated_at: "",
        tenant_name: "", tenant_email: "", room_number: "A1", room_floor: 1,
        ...overrides,
    };
}

describe("summarizeCycle", () => {
    it("menghitung deplesi, konsumsi per ekor, FCR, dan IP siklus selesai", () => {
        setCycleExtra(1, {
            population_start: 1000,
            harvested_count: 950,
            baseline_captured_at: "2026-09-01T06:00:00Z",
            baseline_water_liter: 0,
            baseline_energy_kwh: 0,
            end_water_liter: 9500,
            end_energy_kwh: 950,
        });
        upsertDailyRecord(1, { date: "2026-09-10", dead: 30, culled: 20, feed_kg: 1500 });
        upsertDailyRecord(1, { date: "2026-10-05", dead: 0, culled: 0, feed_kg: 1520, avg_weight_g: 2000 });

        const s = summarizeCycle(lease(1), { electricityRate: 1500, today: "2026-11-04" });

        expect(s.durationDays).toBe(35);
        expect(s.birds).toBe(950);
        expect(s.depletionPct).toBeCloseTo(5);
        expect(s.waterPerBirdL).toBeCloseTo(10);
        expect(s.kwhPerBird).toBeCloseTo(1);
        expect(s.energyCostPerBird).toBeCloseTo(1500);
        // pakan 3020 kg / (950 ekor × 2 kg) = 1,589
        expect(s.fcr).toBeCloseTo(3020 / 1900, 3);
        // IP = (95% × 2 kg) / (FCR × 35 hari) × 100
        expect(s.ip).toBeCloseTo(((95 * 2) / ((3020 / 1900) * 35)) * 100, 1);
    });

    it("FCR dan IP kosong bila pakan/bobot tidak dicatat", () => {
        setCycleExtra(2, { population_start: 1000, harvested_count: 960 });
        const s = summarizeCycle(lease(2), { today: "2026-11-04" });
        expect(s.fcr).toBeUndefined();
        expect(s.ip).toBeUndefined();
        expect(s.waterPerBirdL).toBeUndefined();
    });

    it("siklus berjalan memakai angka meter sekarang dan populasi sekarang", () => {
        setCycleExtra(3, { population_start: 1000, baseline_captured_at: "2026-10-20T06:00:00Z", baseline_water_liter: 100, baseline_energy_kwh: 10 });
        const s = summarizeCycle(lease(3, { status: "active", start_date: "2026-10-20", end_date: null }), {
            today: "2026-11-04", currentWaterLiter: 2100, currentEnergyKwh: 210,
        });
        expect(s.running).toBe(true);
        expect(s.durationDays).toBe(15);
        expect(s.waterLiter).toBe(2000);
        expect(s.energyKwh).toBe(200);
        expect(s.waterPerBirdL).toBeCloseTo(2);
    });
});

describe("monthlyEfficiency", () => {
    it("membagi konsumsi siklus rata per hari ke bulan kalender", () => {
        // 1 Sep → 6 Okt = 35 hari: 30 hari di Sep, 5 hari di Okt.
        setCycleExtra(4, {
            population_start: 1000, harvested_count: 1000,
            baseline_captured_at: "2026-09-01T06:00:00Z", baseline_water_liter: 0, baseline_energy_kwh: 0,
            end_water_liter: 7000, end_energy_kwh: 350,
        });
        const row = summarizeCycle(lease(4), { today: "2026-11-04" });
        const months = monthlyEfficiency([row], { today: "2026-11-04", months: 3, electricityRate: 1000 });

        expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
        expect(months[0].energyKwh).toBeCloseTo(300);
        expect(months[1].energyKwh).toBeCloseTo(50);
        expect(months[0].energyCost).toBeCloseTo(300_000);
        // 10 kWh/hari ÷ 1000 ekor = 10 Wh/ekor/hari; 200 L/hari ÷ 1000 = 0,2 L.
        expect(months[0].whPerBirdDay).toBeCloseTo(10);
        expect(months[1].literPerBirdDay).toBeCloseTo(0.2);
        expect(months[2].whPerBirdDay).toBeNull();
        expect(months[2].cycles).toBe(0);
    });
});

describe("rankMetric", () => {
    it("menandai terbaik/terburuk hanya bila ada ≥ 2 siklus berangka", () => {
        const a = { lease: lease(1), fcr: 1.5 } as never;
        const b = { lease: lease(2), fcr: 1.7 } as never;
        const c = { lease: lease(3), fcr: undefined } as never;
        expect(rankMetric([a, b, c], (r) => r.fcr, false)).toEqual({ best: 1, worst: 2 });
        expect(rankMetric([a, c], (r) => r.fcr, false)).toEqual({});
    });
});
