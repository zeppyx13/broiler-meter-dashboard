// Ringkasan kinerja per siklus untuk tab Riwayat: deplesi, konsumsi per ekor,
// biaya energi, FCR, dan Indeks Performa (IP). `summarizeServerCycle` memakai
// laporan siklus dari backend; angka bisa kosong bila data sensor/catatan belum ada.

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

/** Bentuk minimal laporan siklus server (`GET /api/flock-cycles/:id/report`). */
export type ServerCycleReportLike = {
    totals?: { water_liters?: number | null; energy_kwh?: number | null; electricity_cost_idr?: number | null } | null;
    metrics?: {
        harvested?: number; depletion_pct?: number | null; fcr?: number | null; performance_index?: number | null;
        feed_kg?: number | null; latest_avg_weight_g?: number | null; bird_basis?: number | null;
    } | null;
};

type ServerCycleLike = {
    id: number; coop_id: number; status: string; placement_date: string; actual_harvest_date?: string | null;
    initial_population: number; current_population: number; day_age?: number; notes?: string | null;
};

/** Ringkasan satu siklus dari data server (FCR, IP, total utilitas dihitung backend). */
export function summarizeServerCycle(cycle: ServerCycleLike, lease: Lease, report: ServerCycleReportLike | undefined, recordCount: number, today: string): CycleSummary {
    const running = cycle.status === "active";
    const endDate = running ? null : (cycle.actual_harvest_date ?? null);
    const durationDays = running && cycle.day_age != null ? cycle.day_age : dayDiff(cycle.placement_date, endDate ?? today) + 1;
    const m = report?.metrics ?? undefined;
    const t = report?.totals ?? undefined;
    const birds = running ? cycle.current_population : (m?.harvested || cycle.current_population || undefined);
    const n = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? undefined : Number(v));
    const waterLiter = n(t?.water_liters);
    const energyKwh = n(t?.energy_kwh);
    const basis = n(m?.bird_basis) ?? birds;
    const perBird = (v?: number) => (v != null && basis ? v / basis : undefined);
    const cost = n(t?.electricity_cost_idr);
    const depletion = cycle.initial_population ? ((cycle.initial_population - cycle.current_population - (running ? 0 : (m?.harvested ?? 0))) / cycle.initial_population) * 100 : null;
    return {
        lease,
        running,
        startDate: cycle.placement_date,
        endDate,
        durationDays,
        populationStart: cycle.initial_population,
        birds,
        depletionPct: n(m?.depletion_pct) ?? (depletion != null ? Math.max(0, depletion) : null),
        waterLiter,
        energyKwh,
        waterPerBirdL: perBird(waterLiter),
        kwhPerBird: perBird(energyKwh),
        energyCostPerBird: perBird(cost),
        feedKg: n(m?.feed_kg),
        lastWeightG: n(m?.latest_avg_weight_g),
        fcr: n(m?.fcr),
        ip: n(m?.performance_index),
        recordCount,
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
