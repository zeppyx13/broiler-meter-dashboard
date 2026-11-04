// Ringkasan kinerja per siklus untuk tab Riwayat: deplesi, konsumsi per ekor,
// biaya energi, FCR, dan Indeks Performa (IP). Semua angka dihitung dari data
// lokal (catatan harian + angka meter saat chick-in/panen), jadi bisa kosong
// bila data tersebut tidak diisi.

import type { Lease } from "@/types/lease";
import { getCycleState } from "@/lib/broiler-local-store";

export type CycleSummary = {
    lease: Lease;
    running: boolean;
    startDate: string;
    endDate: string | null;
    durationDays: number;
    populationStart?: number;
    /** Ekor dipanen (siklus selesai) atau populasi sekarang (siklus berjalan). */
    birds?: number;
    depletionPct: number | null;
    waterLiter?: number;
    energyKwh?: number;
    waterPerBirdL?: number;
    kwhPerBird?: number;
    energyCostPerBird?: number;
    feedKg?: number;
    lastWeightG?: number;
    fcr?: number;
    ip?: number;
    recordCount: number;
};

function dayDiff(from: string, to: string) {
    const a = new Date(`${from.slice(0, 10)}T00:00:00`).getTime();
    const b = new Date(`${to.slice(0, 10)}T00:00:00`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function summarizeCycle(
    lease: Lease,
    opts: { electricityRate?: number; currentWaterLiter?: number; currentEnergyKwh?: number; today: string }
): CycleSummary {
    const running = lease.status === "active";
    const state = getCycleState(lease.id, lease.room_id);
    const { extra, records } = state;

    const endDate = running ? null : (lease.end_date ?? extra.closed_at ?? null);
    const durationDays = dayDiff(lease.start_date, endDate ?? opts.today);

    const birds = running ? state.populationNow : (extra.harvested_count ?? state.populationNow);

    let waterLiter: number | undefined;
    let energyKwh: number | undefined;
    if (extra.baseline_captured_at) {
        const endWater = running ? opts.currentWaterLiter : extra.end_water_liter;
        const endEnergy = running ? opts.currentEnergyKwh : extra.end_energy_kwh;
        if (endWater != null) waterLiter = Math.max(0, endWater - (extra.baseline_water_liter ?? 0));
        if (endEnergy != null) energyKwh = Math.max(0, endEnergy - (extra.baseline_energy_kwh ?? 0));
    }

    const feedRecords = records.filter((r) => r.feed_kg != null);
    const feedKg = feedRecords.length > 0 ? feedRecords.reduce((sum, r) => sum + (r.feed_kg ?? 0), 0) : undefined;
    // records sudah urut terbaru dulu.
    const lastWeightG = records.find((r) => r.avg_weight_g != null)?.avg_weight_g;

    const liveWeightKg = birds && lastWeightG ? (birds * lastWeightG) / 1000 : undefined;
    const fcr = feedKg && liveWeightKg ? feedKg / liveWeightKg : undefined;

    // IP = (daya hidup % × bobot rata-rata kg) / (FCR × umur hari) × 100
    const survivalPct = state.populationStart && birds != null ? (birds / state.populationStart) * 100 : undefined;
    const ip = survivalPct != null && lastWeightG && fcr && durationDays > 0
        ? ((survivalPct * (lastWeightG / 1000)) / (fcr * durationDays)) * 100
        : undefined;

    const perBird = (v?: number) => (v != null && birds ? v / birds : undefined);
    const kwhPerBird = perBird(energyKwh);

    return {
        lease,
        running,
        startDate: lease.start_date,
        endDate,
        durationDays,
        populationStart: state.populationStart,
        birds,
        depletionPct: state.depletionPct,
        waterLiter,
        energyKwh,
        waterPerBirdL: perBird(waterLiter),
        kwhPerBird,
        energyCostPerBird: kwhPerBird != null && opts.electricityRate ? kwhPerBird * opts.electricityRate : undefined,
        feedKg,
        lastWeightG,
        fcr,
        ip,
        recordCount: records.length,
    };
}

export type MonthlyEfficiency = {
    month: string; // YYYY-MM
    label: string;
    energyKwh: number;
    waterLiter: number;
    energyCost: number;
    /** Wh per ekor per hari — null bila bulan itu tidak ada data listrik. */
    whPerBirdDay: number | null;
    /** Liter per ekor per hari — null bila bulan itu tidak ada data air. */
    literPerBirdDay: number | null;
    cycles: number;
};

/**
 * Efisiensi per bulan untuk N bulan terakhir. Backend belum menyimpan riwayat
 * telemetri, jadi konsumsi tiap siklus (selisih angka meter) dibagi rata ke
 * setiap hari siklus, lalu dijumlahkan per bulan kalender.
 */
export function monthlyEfficiency(rows: CycleSummary[], opts: { today: string; months?: number; electricityRate?: number }): MonthlyEfficiency[] {
    const months = opts.months ?? 6;
    const [ty, tm] = opts.today.split("-").map(Number);
    const buckets = new Map<string, MonthlyEfficiency & { birdDaysEnergy: number; birdDaysWater: number; cycleIds: Set<number> }>();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(ty, tm - 1 - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, {
            month: key,
            label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
            energyKwh: 0, waterLiter: 0, energyCost: 0, whPerBirdDay: null, literPerBirdDay: null, cycles: 0,
            birdDaysEnergy: 0, birdDaysWater: 0, cycleIds: new Set(),
        });
    }

    for (const r of rows) {
        const days = Math.max(1, r.durationDays);
        // Populasi rata-rata selama siklus (awal → panen/sekarang).
        const birds = r.populationStart != null && r.birds != null ? (r.populationStart + r.birds) / 2 : (r.birds ?? r.populationStart);
        if (!birds || (r.energyKwh == null && r.waterLiter == null)) continue;

        const start = new Date(`${r.startDate.slice(0, 10)}T00:00:00`);
        for (let d = 0; d < days; d++) {
            const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
            const b = buckets.get(key);
            if (!b) continue;
            b.cycleIds.add(r.lease.id);
            if (r.energyKwh != null) {
                b.energyKwh += r.energyKwh / days;
                b.birdDaysEnergy += birds;
            }
            if (r.waterLiter != null) {
                b.waterLiter += r.waterLiter / days;
                b.birdDaysWater += birds;
            }
        }
    }

    return [...buckets.values()].map(({ birdDaysEnergy, birdDaysWater, cycleIds, ...b }) => ({
        ...b,
        energyCost: b.energyKwh * (opts.electricityRate ?? 0),
        whPerBirdDay: birdDaysEnergy > 0 ? (b.energyKwh * 1000) / birdDaysEnergy : null,
        literPerBirdDay: birdDaysWater > 0 ? b.waterLiter / birdDaysWater : null,
        cycles: cycleIds.size,
    }));
}

export type BestWorst = { best?: number; worst?: number };

/** Id siklus terbaik/terburuk untuk satu metrik (butuh minimal 2 siklus berisi angka). */
export function rankMetric(rows: CycleSummary[], pick: (r: CycleSummary) => number | null | undefined, higherIsBetter: boolean): BestWorst {
    const withValue = rows.filter((r) => pick(r) != null) as CycleSummary[];
    if (withValue.length < 2) return {};
    const sorted = [...withValue].sort((a, b) => (pick(a)! - pick(b)!) * (higherIsBetter ? -1 : 1));
    return { best: sorted[0].lease.id, worst: sorted[sorted.length - 1].lease.id };
}
