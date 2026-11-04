import { describe, expect, it } from "vitest";
import { DEFAULT_IMPACT_SETTINGS, kandangImpact } from "@/lib/impact";

describe("dampak & balik modal", () => {
    it("sesuai contoh proposal: 5.000 ekor × 1% × 2 kg × Rp20.000 = Rp2 juta", () => {
        const r = kandangImpact(5000, 2, DEFAULT_IMPACT_SETTINGS);
        expect(r.birdsSaved).toBe(50);
        expect(r.valuePerCycle).toBe(2_000_000);
        expect(r.paybackCycles).toBeCloseTo(0.54);
    });

    it("skala UMKM 600 ekor: balik modal ±4,5 siklus", () => {
        const r = kandangImpact(600, 2, DEFAULT_IMPACT_SETTINGS);
        expect(r.valuePerCycle).toBe(240_000);
        expect(r.paybackCycles).toBeCloseTo(4.5);
        expect(r.paybackMonths).toBeCloseTo(7.5);
    });

    it("tanpa populasi tidak ada balik modal", () => {
        expect(kandangImpact(0, 2, DEFAULT_IMPACT_SETTINGS).paybackCycles).toBeNull();
    });
});
