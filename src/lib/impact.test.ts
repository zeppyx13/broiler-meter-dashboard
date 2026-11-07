import { describe, expect, it } from "vitest";
import { DEFAULT_IMPACT_SETTINGS, farmEconomics, kandangImpact, type ImpactSettings } from "@/lib/impact";

// Angka slide presentasi: 6 siklus/tahun, hemat listrik pemanas 33,6 kWh × Rp1.444,70 per 500 ekor.
const SLIDE: ImpactSettings = { ...DEFAULT_IMPACT_SETTINGS, cycleDays: 365 / 6, electricitySavingPerCycle: 48_542 };

describe("dampak & balik modal", () => {
    it("rumus proposal: 5.000 ekor × 1% × 2 kg × Rp20.000 = Rp2 juta", () => {
        const r = kandangImpact(5000, 2, { ...DEFAULT_IMPACT_SETTINGS, pricePerKg: 20_000, cycleDays: 50 });
        expect(r.birdsSaved).toBe(50);
        expect(r.valuePerCycle).toBe(2_000_000);
        expect(r.paybackCycles).toBeCloseTo(0.54);
    });

    it("default teraudit: 5.000 ekor × 1% × 1,73 kg × Rp19.500 ≈ Rp1,69 juta", () => {
        const r = kandangImpact(5000, DEFAULT_IMPACT_SETTINGS.harvestWeightKg, DEFAULT_IMPACT_SETTINGS);
        expect(r.valuePerCycle).toBeCloseTo(1_686_750);
    });

    it("tanpa populasi tidak ada balik modal", () => {
        expect(kandangImpact(0, 2, DEFAULT_IMPACT_SETTINGS).paybackCycles).toBeNull();
    });
});

describe("ekonomi lahan termasuk biaya operasional", () => {
    it("biaya operasional default Rp2,44 juta/tahun untuk 1 kandang", () => {
        expect(farmEconomics([{ population: 500, harvestKg: 1.73 }], SLIDE).opexPerYear).toBe(2_440_000);
    });

    it("kandang 500 ekor: ROI tahun pertama −63%, tidak balik modal", () => {
        const e = farmEconomics([{ population: 500, harvestKg: 1.73 }], SLIDE);
        expect(e.benefitPerYear).toBeCloseTo(1_303_302, 0);
        expect(e.roiFirstYear).toBeCloseTo(-0.63, 2);
        expect(e.paybackMonths).toBeNull();
        expect(e.breakEvenPopulation).toBeCloseTo(1074, 0);
    });

    it("kandang 5.000 ekor: ROI ±270%, balik modal ±1,2 bulan", () => {
        const e = farmEconomics([{ population: 5000, harvestKg: 1.73 }], { ...SLIDE, electricitySavingPerCycle: 485_420 });
        expect(e.roiFirstYear).toBeCloseTo(2.7, 1);
        expect(e.paybackMonths).toBeCloseTo(1.22, 2);
    });

    it("satu langganan dipakai bersama: 3 kandang 500 ekor lebih dekat impas", () => {
        const one = farmEconomics([{ population: 500, harvestKg: 1.73 }], SLIDE);
        const three = farmEconomics(Array.from({ length: 3 }, () => ({ population: 500, harvestKg: 1.73 })), SLIDE);
        expect(three.opexPerYear).toBe(2_640_000);
        expect(three.roiFirstYear!).toBeGreaterThan(one.roiFirstYear!);
        expect(three.breakEvenPopulation!).toBeLessThan(one.breakEvenPopulation!);
    });

    it("tanpa kandang tidak ada ROI", () => {
        const e = farmEconomics([], SLIDE);
        expect(e.roiFirstYear).toBeNull();
        expect(e.breakEvenPopulation).toBeNull();
    });
});
