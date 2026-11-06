"use client";

// Query React Query ke backend Broiler. Kunci selalu diawali "broiler" + user + kandang,
// sehingga event Socket.IO di BroilerProvider otomatis menyegarkan data kandang terkait.

import { useQueries, useQuery } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { readData, stream, type Cycle, type DailyMetric, type ServerAlert, type Source, type Summary } from "@/lib/broiler-api";
import type { ServerDailyRecord, ServerEquipment } from "@/lib/broiler-adapters";

export type TelemetrySample = { recorded_at: string; power_w: number | null; flow_rate_lpm: number | null };
export type CycleProfile = { flock_cycle_id?: number; strain?: string | null; harvest_target_days?: number | null };
export type AlertWithType = ServerAlert & { alert_type?: string };
export type CycleReport = {
    cycle: Cycle;
    totals: DailyMetric;
    metrics: {
        dead: number; culled: number; harvested: number; depletion_pct: number | null; survival_pct: number | null;
        fcr: number | null; performance_index: number | null; feed_kg: number | null; latest_avg_weight_g: number | null; bird_basis: number | null;
    };
    source: string;
    as_of: string;
    water_feed?: unknown;
    series?: DailyMetric[];
};

function useScope() {
    const b = useBroiler();
    return { b, userId: b.user?.id, enabled: Boolean(b.user) };
}

export function useCoopSummary(coopId: number | undefined, interval = 10_000) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "summary"],
        queryFn: () => readData<Summary>("/api/dashboard/summary", { coop_id: coopId, include_simulation: true }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: interval,
    });
}

/** Ringkasan semua kandang yang bisa diakses (Beranda, daftar kandang, Guard). */
export function useAllSummaries(coopIds: number[], interval = 20_000) {
    const { userId, enabled } = useScope();
    return useQueries({
        queries: coopIds.map((id) => ({
            queryKey: ["broiler", userId, id, "summary"],
            queryFn: () => readData<Summary>("/api/dashboard/summary", { coop_id: id, include_simulation: true }),
            enabled,
            refetchInterval: interval,
        })),
    });
}

/** Cabang data sesuai sumber yang dipilih (REAL sensor / SIM backend). */
export function pickStream(summary: Summary | undefined, source: Source) {
    return stream(summary, source);
}

export function useActiveCycle(coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "active-cycle"],
        queryFn: () => readData<{ cycle: Cycle | null }>("/api/flock-cycles/active", { coop_id: coopId }),
        enabled: enabled && Boolean(coopId),
    });
}

export function useCycles(coopId: number | undefined, limit = 50) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycles", limit],
        queryFn: () => readData<{ cycles: Cycle[] }>("/api/flock-cycles", { coop_id: coopId, limit }),
        enabled: enabled && Boolean(coopId),
    });
}

export function useCycleProfile(cycleId: number | undefined, coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycle-profile", cycleId],
        queryFn: () => readData<{ profile: CycleProfile | null }>(`/api/flock-cycles/${cycleId}/profile`),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useDailyRecords(cycleId: number | undefined, coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "daily-records", cycleId],
        queryFn: () => readData<{ records: ServerDailyRecord[] }>(`/api/flock-cycles/${cycleId}/daily-records`),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useEquipment(coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "equipment"],
        queryFn: () => readData<{ equipment: ServerEquipment[]; expected_power_w: number | string | null }>(`/api/coops/${coopId}/equipment`),
        enabled: enabled && Boolean(coopId),
    });
}

export function useTelemetryHistory(coopId: number | undefined, source: Source, minutes = 30) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "telemetry-history", source, minutes],
        queryFn: () => readData<{ samples: TelemetrySample[]; state?: string }>(`/api/coops/${coopId}/telemetry-history`, { source, minutes, bucket_seconds: 30 }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: 15_000,
    });
}

export function useCoopAlerts(coopId: number | undefined, source: Source, status?: string, limit = 50) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "alerts", source, status ?? "all", limit],
        queryFn: () => readData<{ alerts: AlertWithType[] }>("/api/alerts", { coop_id: coopId, source, status, page: 1, limit }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: 15_000,
    });
}

/** Alert semua kandang yang bisa diakses (navigasi, Beranda, Peringatan). */
export function useAllAlerts(coopIds: number[], source: Source, limit = 50) {
    const { userId, enabled } = useScope();
    return useQueries({
        queries: coopIds.map((id) => ({
            queryKey: ["broiler", userId, id, "alerts", source, "all", limit],
            queryFn: () => readData<{ alerts: AlertWithType[] }>("/api/alerts", { coop_id: id, source, page: 1, limit }),
            enabled,
            refetchInterval: 15_000,
        })),
    });
}

export function useCycleReport(cycleId: number | undefined, coopId: number | undefined, source: Source) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycle-report", cycleId, source],
        queryFn: () => readData<CycleReport>(`/api/flock-cycles/${cycleId}/report`, { source }),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useMonthly(coopId: number | undefined, source: Source) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "monthly", source],
        queryFn: () => readData<{ series: (DailyMetric & { month: string })[] }>(`/api/coops/${coopId}/reports/monthly`, { source }),
        enabled: enabled && Boolean(coopId),
    });
}
