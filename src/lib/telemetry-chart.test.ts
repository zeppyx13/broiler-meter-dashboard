import { expect, it } from "vitest";
import { telemetryChartPoints } from "./broiler-api";
it("breaks the chart at missing buckets while preserving observed zero and partial fields", () => {
    const rows = [{ recorded_at: "2026-11-06T00:00:00Z", power_w: 0, flow_rate_lpm: null }, { recorded_at: "2026-11-06T00:00:30Z", power_w: 5, flow_rate_lpm: 0 }, { recorded_at: "2026-11-06T00:02:00Z", power_w: 10, flow_rate_lpm: 1 }];
    const result = telemetryChartPoints(rows, 30);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe(rows[0]);
    expect(result[2]).toEqual({ recorded_at: "2026-11-06T00:01:00.000Z", power_w: null, flow_rate_lpm: null });
    expect(rows).toHaveLength(3);
    expect(telemetryChartPoints([], 30)).toEqual([]);
});
