import { describe, expect, it } from "vitest";
import { classifyWaterFeed, waterFeedSeries } from "@/lib/water-feed";

describe("rasio air : pakan", () => {
    it("menggabungkan air harian dengan pakan di catatan harian", () => {
        const records = [
            { date: "2026-11-02", dead: 0, culled: 0, feed_kg: 60 },
            { date: "2026-11-03", dead: 1, culled: 0, feed_kg: 64 },
            { date: "2026-11-04", dead: 0, culled: 0 }, // pakan belum dicatat
        ];
        const series = waterFeedSeries(records, { "2026-11-02": 114, "2026-11-03": 128, "2026-11-04": 40 });
        expect(series.map((p) => p.date)).toEqual(["2026-11-02", "2026-11-03"]);
        expect(series[1].ratio).toBeCloseTo(2);
    });

    it("mengklasifikasikan rendah / normal / tinggi", () => {
        expect(classifyWaterFeed(1.4)).toBe("rendah");
        expect(classifyWaterFeed(1.9)).toBe("normal");
        expect(classifyWaterFeed(2.5)).toBe("tinggi");
    });
});
