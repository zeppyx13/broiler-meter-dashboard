// Rasio air : pakan harian — indikator kesehatan klasik broiler. Di suhu nyaman
// broiler minum ±1,6–2,0 L per kg pakan dan naik saat panas (Williams et al., 2013;
// Aviagen, 2018). Turun → ayam kurang minum (gangguan nipple, sakit); naik → cekaman
// panas, kebocoran, atau pakan yang tidak termakan.

import type { DailyRecord } from "@/lib/broiler-local-store";

export const WATER_FEED_NORMAL = { min: 1.6, max: 2.2 };

export type WaterFeedPoint = { date: string; waterL: number; feedKg: number; ratio: number };

export type WaterFeedStatus = "rendah" | "normal" | "tinggi";

export function classifyWaterFeed(ratio: number): WaterFeedStatus {
    if (ratio < WATER_FEED_NORMAL.min) return "rendah";
    if (ratio > WATER_FEED_NORMAL.max) return "tinggi";
    return "normal";
}

/** Titik harian yang punya data air & pakan, urut dari terlama, maksimal `days` terakhir. */
export function waterFeedSeries(records: DailyRecord[], dailyWater: Record<string, number>, days = 14): WaterFeedPoint[] {
    return records
        .filter((r) => r.feed_kg != null && r.feed_kg > 0 && dailyWater[r.date] != null)
        .map((r) => ({ date: r.date, waterL: dailyWater[r.date], feedKg: r.feed_kg!, ratio: dailyWater[r.date] / r.feed_kg! }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-days);
}
