import { describe, expect, it } from "vitest";
import { errorPct, summarizeCalibrations, type CalibrationEntry } from "@/lib/calibration";

const entry = (roomId: number, type: CalibrationEntry["type"], reference: number, sensor: number, i: number): CalibrationEntry => ({
    id: `${roomId}-${type}-${i}`, roomId, type, reference, sensor, at: `2026-11-0${i}T08:00:00Z`,
});

describe("uji akurasi sensor", () => {
    it("galat = |sensor − acuan| / acuan", () => {
        expect(errorPct({ reference: 10, sensor: 10.3 })).toBeCloseTo(3);
        expect(errorPct({ reference: 200, sensor: 196 })).toBeCloseTo(2);
    });

    it("lulus sesuai batas proposal: listrik ≤ 2%, air ≤ 5%", () => {
        const summary = summarizeCalibrations([
            entry(1, "listrik", 128, 127, 1), entry(1, "listrik", 130, 128.5, 2), entry(1, "listrik", 125, 124, 3),
            entry(3, "air", 10, 10.62, 1), entry(3, "air", 10, 10.48, 2),
        ]);
        const listrik = summary.find((s) => s.type === "listrik")!;
        const air = summary.find((s) => s.type === "air")!;
        expect(listrik.passed).toBe(true);
        expect(listrik.enoughRepeats).toBe(true);
        expect(air.passed).toBe(false);
        expect(air.enoughRepeats).toBe(false);
        expect(air.biasPct).toBeGreaterThan(0); // sensor membaca lebih tinggi
    });
});
