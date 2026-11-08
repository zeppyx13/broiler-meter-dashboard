"use client";

// Query React Query ke backend Broiler. Kunci selalu diawali "broiler" + user + kandang,
// sehingga event Socket.IO di BroilerProvider otomatis menyegarkan data kandang terkait.

import { useQueries, useQuery } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { allPages, readData, stream, type Cycle, type DailyMetric, type ServerAlert, type Source, type Summary } from "@/lib/broiler-api";
import type { ServerDailyRecord, ServerEquipment } from "@/lib/broiler-adapters";

export type TelemetrySample = { recorded_at: string; power_w: number | null; flow_rate_lpm: number | null };
export type CycleProfile = { flock_cycle_id?: number; strain?: string | null; harvest_target_days?: number | null };
export type AlertWithType = ServerAlert & { alert_type?: string };
export type ForecastSnapshot = {
    state: string; source: Source; flock_cycle_id?: number | null; as_of?: string;
    forecasts: { id?: number; metric: string; horizon: string; predicted_value: number | null; confidence: string; details_json?: { estimated_water_cost_idr?: number | null } }[];
};
export type EcoRecommendation = {
    id: number; title: string; description?: string; recommendation_text?: string; message?: string;
    status: string; is_current: boolean; estimated_savings_idr: number | null; evidence_json: unknown;
};
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
        queryFn: ({ signal }) => readData<Summary>("/api/dashboard/summary", { coop_id: coopId }, { signal }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: interval, retry: false,
    });
}

/** Ringkasan semua kandang yang bisa diakses (Beranda, daftar kandang, Guard). */
export function useAllSummaries(coopIds: number[], interval = 20_000) {
    const { userId, enabled } = useScope();
    return useQueries({
        queries: coopIds.map((id) => ({
            queryKey: ["broiler", userId, id, "summary"],
            queryFn: ({ signal }) => readData<Summary>("/api/dashboard/summary", { coop_id: id }, { signal }),
            enabled,
            refetchInterval: interval, retry: false,
        })),
    });
}

/** Ringkasan sensor fisik dari envelope API. */
export function pickStream(summary: Summary | undefined) {
    return stream(summary);
}

export function useActiveCycle(coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "active-cycle"],
        queryFn: ({ signal }) => readData<{ cycle: Cycle | null }>("/api/flock-cycles/active", { coop_id: coopId }, { signal }),
        enabled: enabled && Boolean(coopId),
    });
}

export function useCycles(coopId: number | undefined, limit = 50) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycles", limit],
        queryFn: async ({ signal }) => {
            const cycles: Cycle[] = [];
            for (let offset = 0; ; offset += limit) {
                const page = await readData<{ cycles: Cycle[] }>("/api/flock-cycles", { coop_id: coopId, limit, offset }, { signal });
                cycles.push(...page.cycles);
                if (page.cycles.length < limit) return { cycles };
            }
        },
        enabled: enabled && Boolean(coopId),
    });
}

export function useCycleProfile(cycleId: number | undefined, coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycle-profile", cycleId],
        queryFn: ({ signal }) => readData<{ profile: CycleProfile | null }>(`/api/flock-cycles/${cycleId}/profile`, undefined, { signal }),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useDailyRecords(cycleId: number | undefined, coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "daily-records", cycleId],
        queryFn: ({ signal }) => readData<{ records: ServerDailyRecord[] }>(`/api/flock-cycles/${cycleId}/daily-records`, undefined, { signal }),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useEquipment(coopId: number | undefined) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "equipment"],
        queryFn: ({ signal }) => readData<{ equipment: ServerEquipment[]; expected_power_w: number | string | null }>(`/api/coops/${coopId}/equipment`, undefined, { signal }),
        enabled: enabled && Boolean(coopId),
    });
}

export function useTelemetryHistory(coopId: number | undefined, source: Source, minutes = 30) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "telemetry-history", minutes],
        queryFn: ({ signal }) => readData<{ samples: TelemetrySample[]; state?: string }>(`/api/coops/${coopId}/telemetry-history`, { source, minutes, bucket_seconds: 30 }, { signal }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: 15_000,
    });
}

export function useCoopAlerts(coopId: number | undefined, source: Source, status?: string, limit = 50) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "alerts", status ?? "all", limit],
        queryFn: async ({ signal }) => status === "open" ? { alerts: (await Promise.all(["active", "acknowledged"].map((state) => allPages<AlertWithType>("/api/alerts", "alerts", { coop_id: coopId, source, status: state }, { signal })))).flat() } : readData<{ alerts: AlertWithType[] }>("/api/alerts", { coop_id: coopId, source, status, page: 1, limit }, { signal }),
        enabled: enabled && Boolean(coopId),
        refetchInterval: 15_000,
    });
}

/** Alert semua kandang yang bisa diakses (navigasi, Beranda, Peringatan). */
export function useAllAlerts(coopIds: number[], source: Source, limit = 50) {
    const { userId, enabled } = useScope();
    return useQueries({
        queries: coopIds.map((id) => ({
            queryKey: ["broiler", userId, id, "alerts", "all", limit],
            queryFn: async ({ signal }) => ({ alerts: await allPages<AlertWithType>("/api/alerts", "alerts", { coop_id: id, source }, { signal }) }),
            enabled,
            refetchInterval: 15_000,
        })),
    });
}

export function useCycleReport(cycleId: number | undefined, coopId: number | undefined, source: Source) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "cycle-report", cycleId],
        queryFn: ({ signal }) => readData<CycleReport>(`/api/flock-cycles/${cycleId}/report`, { source }, { signal }),
        enabled: enabled && Boolean(cycleId),
    });
}

export function useMonthly(coopId: number | undefined, source: Source) {
    const { userId, enabled } = useScope();
    return useQuery({
        queryKey: ["broiler", userId, coopId, "monthly"],
        queryFn: ({ signal }) => readData<{ series: (DailyMetric & { month: string })[] }>(`/api/coops/${coopId}/reports/monthly`, { source }, { signal }),
        enabled: enabled && Boolean(coopId),
    });
}

export function useForecastCurrent(coopId: number | undefined, source: Source) {
    const { b, userId, enabled } = useScope();
    const insightsAllowed = coopId === b.coopId ? b.canInsights : b.coops.find(coop => coop.id === coopId)?.capabilities?.["insights:use"] === true;
    return useQuery({
        queryKey: ["broiler", userId, coopId, "forecast-current"],
        queryFn: ({ signal }) => readData<ForecastSnapshot>("/api/forecasts/current", { coop_id: coopId, source, window_days: 7 }, { signal }),
        enabled: enabled && Boolean(coopId) && insightsAllowed, refetchInterval: 60_000, retry: false,
    });
}

export function useEcoRecommendations(coopId: number | undefined, source: Source) {
    const { b, userId, enabled } = useScope();
    const insightsAllowed = coopId === b.coopId ? b.canInsights : b.coops.find(coop => coop.id === coopId)?.capabilities?.["insights:use"] === true;
    return useQuery({
        queryKey: ["broiler", userId, coopId, "eco-current"],
        queryFn: ({ signal }) => readData<{ state: string; recommendations: EcoRecommendation[] }>("/api/eco-recommendations", { coop_id: coopId, source, page: 1, limit: 20 }, { signal }),
        enabled: enabled && Boolean(coopId) && insightsAllowed, refetchInterval: 60_000, retry: false,
    });
}
