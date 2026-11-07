"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { TodayUsage } from "@/lib/broiler-local-store";
import { serverInsights } from "@/lib/server-insights";
import { readData, type Source } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { pickStream, useAllAlerts, useAllSummaries, type CycleProfile } from "@/lib/broiler-queries";
import {
    coopToRoom, cycleToLease, farmToTariff, liveToLegacy, serverAlertToKandang, todayFromMetric,
} from "@/lib/broiler-adapters";

export type KandangSnapshot = {
    room: Room;
    cycle: Lease | null;
    live?: LiveStatus;
    online: boolean;
    onlineDeviceCount: number | null;
    deviceCount: number | null;
    source: Source;
    dataAvailable: boolean;
    telemetryAvailable: boolean;
    guardAvailable: boolean;
    guardHealthy: boolean;
    ageDays: number | null;
    harvestTargetDays: number;
    populationNow?: number;
    expectedPowerKw?: number;
    todayUsage: TodayUsage;
    insights: ReturnType<typeof serverInsights>;
};

const DEFAULT_HARVEST_TARGET_DAYS = 35;

/**
 * Kondisi terkini setiap kandang yang bisa diakses, dari ringkasan & Guard server.
 * Dipakai Beranda dan daftar kandang agar angkanya selalu sama.
 */
/** Kandang demo (kode berawalan "DEMO"): tetap dihitung, kartunya tidak tampil di Beranda. */
export function isDemoKandang(code: string | null | undefined): boolean {
    return /^demo\b/i.test((code ?? "").trim());
}

export function useKandangSnapshots() {
    const b = useBroiler();
    const coops = b.coops;
    const ids = useMemo(() => coops.map((c) => c.id), [coops]);
    const summaries = useAllSummaries(ids);
    const alerts = useAllAlerts(ids, b.source);
    const profiles = useQueries({ queries: coops.map((coop, index) => {
        const cycleId = summaries[index]?.data?.active_cycle?.id;
        return {
            queryKey: ["broiler", b.user?.id, coop.id, "cycle-profile", cycleId],
            queryFn: ({ signal }: { signal: AbortSignal }) => readData<{ profile: CycleProfile | null }>(`/api/flock-cycles/${cycleId}/profile`, undefined, { signal }),
            enabled: Boolean(b.user && cycleId), retry: false,
        };
    }) });
    const guard = useQueries({ queries: ids.map((coopId) => ({
        queryKey: ["broiler", b.user?.id, coopId, "guard-snapshot", b.source],
        queryFn: ({ signal }: { signal: AbortSignal }) => readData<{ evaluations: { is_active: boolean; status: string; checked_at?: string | null }[] }>("/api/guard/status", { coop_id: coopId, source: b.source === "simulation" ? "simulation" : "rule" }, { signal }),
        enabled: Boolean(b.user), refetchInterval: 20_000, retry: false,
    })) });

    const snapshots = useMemo<KandangSnapshot[]>(() => coops.map((coop, i) => {
        const summary = summaries[i]?.data;
        const selected = pickStream(summary, b.source);
        const serverCycle = summary?.active_cycle ?? null;
        const live = liveToLegacy(selected?.live, coop);
        // Device reachability always comes from the REAL trusted heartbeat list.
        // A fresh simulation sample or browser socket cannot make a device online.
        const online = summary?.devices.some((device) => device.connectivity_status === "online") ?? false;
        const dataAvailable = Boolean(summary && !summaries[i]?.isError);
        const telemetryAvailable = Boolean(selected?.live && ["live", "ok", "fresh"].includes(selected.live.status));
        // No configured/evaluated active rule means unavailable, never all-normal.
        const evaluations = guard[i]?.data?.evaluations.filter((item) => item.is_active) ?? [];
        const serverTime = Date.parse(summary?.generated_at ?? "");
        const guardAvailable = Boolean(alerts[i]?.data && !alerts[i]?.isError && !guard[i]?.isError && evaluations.length && evaluations.every((item) => {
            const checkedAt = Date.parse(item.checked_at ?? "");
            return Number.isFinite(serverTime) && Number.isFinite(checkedAt) && Math.abs(serverTime - checkedAt) <= 120_000 && ["normal", "recovery", "trigger"].includes(item.status);
        }));
        const ageDays = serverCycle ? serverCycle.day_age : null;
        const todayUsage = todayFromMetric(selected?.today);
        const serverAlerts = (alerts[i]?.data?.alerts ?? []).filter((a) => a.status !== "resolved").map(serverAlertToKandang);
        return {
            room: coopToRoom(coop),
            cycle: serverCycle ? cycleToLease(serverCycle) : null,
            live,
            online,
            onlineDeviceCount: summary ? summary.devices.filter((device) => device.connectivity_status === "online").length : null,
            deviceCount: summary ? summary.devices.length : null,
            source: b.source,
            dataAvailable,
            telemetryAvailable,
            guardAvailable,
            guardHealthy: guardAvailable && evaluations.every((item) => ["normal", "recovery"].includes(item.status)),
            ageDays,
            harvestTargetDays: profiles[i]?.data?.profile?.harvest_target_days ?? DEFAULT_HARVEST_TARGET_DAYS,
            populationNow: serverCycle?.current_population,
            todayUsage,
            insights: serverInsights(selected, serverCycle?.current_population, undefined, serverAlerts),
        };
    }), [coops, summaries, alerts, guard, profiles, b.source]);

    const isLoading = b.loading || summaries.some((q) => q.isPending);
    const isError = summaries.length > 0 && summaries.every((q) => q.isError && !q.data);
    const lastUpdate = summaries
        .map((q) => pickStream(q.data, b.source)?.live?.recorded_at)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1);
    const farm = b.farms.find((item) => item.id === b.farmId) ?? summaries.find((q) => q.data?.farm?.id === b.farmId)?.data?.farm;

    return { snapshots, isLoading, isError, lastUpdate, tariff: farmToTariff(farm ?? b.farms.find((f) => f.id === b.farmId)) };
}
