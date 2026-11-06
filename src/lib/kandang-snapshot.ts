"use client";

import { useMemo } from "react";
import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { TodayUsage } from "@/lib/broiler-local-store";
import { daysUntilHarvest } from "@/lib/broiler-reference";
import { computeKandangInsights, type KandangInsights } from "@/lib/kandang-insights";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { pickStream, useAllAlerts, useAllSummaries } from "@/lib/broiler-queries";
import {
    coopToRoom, cycleToLease, farmToTariff, isLiveOnline, liveToLegacy, serverAlertToKandang, todayFromMetric,
} from "@/lib/broiler-adapters";

export type KandangSnapshot = {
    room: Room;
    cycle: Lease | null;
    live?: LiveStatus;
    online: boolean;
    ageDays: number | null;
    harvestTargetDays: number;
    populationNow?: number;
    expectedPowerKw?: number;
    todayUsage: TodayUsage;
    insights: KandangInsights;
};

const DEFAULT_HARVEST_TARGET_DAYS = 35;

/**
 * Kondisi terkini setiap kandang yang bisa diakses, dari ringkasan & Guard server.
 * Dipakai Beranda dan daftar kandang agar angkanya selalu sama.
 */
export function useKandangSnapshots() {
    const b = useBroiler();
    const coops = b.coops;
    const ids = useMemo(() => coops.map((c) => c.id), [coops]);
    const summaries = useAllSummaries(ids);
    const alerts = useAllAlerts(ids, b.source);

    const snapshots = useMemo<KandangSnapshot[]>(() => coops.map((coop, i) => {
        const summary = summaries[i]?.data;
        const selected = pickStream(summary, b.source);
        const serverCycle = summary?.active_cycle ?? null;
        const live = liveToLegacy(selected?.live, coop);
        const online = isLiveOnline(selected?.live);
        const ageDays = serverCycle ? serverCycle.day_age : null;
        const todayUsage = todayFromMetric(selected?.today);
        const computed = computeKandangInsights({
            hasActiveCycle: Boolean(serverCycle),
            ageDays,
            daysToHarvest: ageDays != null ? daysUntilHarvest(ageDays, DEFAULT_HARVEST_TARGET_DAYS) : null,
            harvestTargetDays: DEFAULT_HARVEST_TARGET_DAYS,
            populationNow: serverCycle?.current_population,
            online,
            live,
            todayUsage,
            cycleUsage: null,
            tariff: farmToTariff(summary?.farm),
        });
        const serverAlerts = (alerts[i]?.data?.alerts ?? []).filter((a) => a.status !== "resolved").map(serverAlertToKandang);
        return {
            room: coopToRoom(coop),
            cycle: serverCycle ? cycleToLease(serverCycle) : null,
            live,
            online,
            ageDays,
            harvestTargetDays: DEFAULT_HARVEST_TARGET_DAYS,
            populationNow: serverCycle?.current_population,
            todayUsage,
            insights: { ...computed, alerts: serverAlerts },
        };
    }), [coops, summaries, alerts, b.source]);

    const isLoading = b.loading || summaries.some((q) => q.isPending);
    const isError = summaries.length > 0 && summaries.every((q) => q.isError);
    const lastUpdate = summaries
        .map((q) => pickStream(q.data, b.source)?.live?.recorded_at)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1);
    const farm = summaries.find((q) => q.data?.farm)?.data?.farm;

    return { snapshots, isLoading, isError, lastUpdate, tariff: farmToTariff(farm ?? b.farms.find((f) => f.id === b.farmId)) };
}
