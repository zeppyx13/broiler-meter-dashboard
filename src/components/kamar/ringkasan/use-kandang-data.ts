"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import {
    pickStream, useActiveCycle, useCoopAlerts, useCoopSummary, useCycleProfile, useDailyRecords, useEquipment, useTelemetryHistory, useForecastCurrent, useEcoRecommendations,
} from "@/lib/broiler-queries";
import {
    coopToRoom, cycleToLease, cycleUsageFromMetric, equipmentToLegacy, farmToTariff, liveToLegacy,
    recordToLegacy, serverAlertToKandang, todayFromMetric,
} from "@/lib/broiler-adapters";
import { localDateKey, type CycleState, type RoomExtra } from "@/lib/broiler-local-store";
import { daysUntilHarvest } from "@/lib/broiler-reference";
import { serverInsights } from "@/lib/server-insights";
import { telemetryChartPoints } from "@/lib/broiler-api";

export type RealtimeSample = { t: number; powerKw: number | null; flowLpm: number | null };

/** Jendela grafik real-time; data diambil dari histori telemetri server. */
export const REALTIME_WINDOW_MS = 30 * 60 * 1000;

const DEFAULT_HARVEST_TARGET_DAYS = 35;

export function useKandangData(roomId: number) {
    const queryClient = useQueryClient();
    const b = useBroiler();
    const coop = b.coops.find((c) => c.id === roomId);
    const coopId = coop?.id;

    const summaryQuery = useCoopSummary(coopId, 10_000);
    const activeQuery = useActiveCycle(coopId);
    const serverCycle = activeQuery.data ? activeQuery.data.cycle : summaryQuery.data?.active_cycle ?? null;
    const profileQuery = useCycleProfile(serverCycle?.id, coopId);
    const recordsQuery = useDailyRecords(serverCycle?.id, coopId);
    const equipmentQuery = useEquipment(coopId);
    const historyQuery = useTelemetryHistory(coopId, b.source, 30);
    const alertsQuery = useCoopAlerts(coopId, b.source, "open");
    const forecastQuery = useForecastCurrent(coopId, b.source);
    const ecoQuery = useEcoRecommendations(coopId, b.source);

    const summary = summaryQuery.data;
    const selected = pickStream(summary);
    const room = useMemo(() => (coop ? coopToRoom(coop) : undefined), [coop]);
    const live = useMemo(() => (coop ? liveToLegacy(selected?.live, coop) : undefined), [selected?.live, coop]);
    const online = Boolean(summary?.devices.some((d) => d.connectivity_status === "online"));
    const tariff = useMemo(() => farmToTariff(summary?.farm ?? b.farms.find((f) => f.id === coop?.farm_id)), [summary?.farm, b.farms, coop?.farm_id]);

    const activeCycle = useMemo(() => (serverCycle ? cycleToLease(serverCycle) : null), [serverCycle]);
    const profile = profileQuery.data?.profile ?? null;
    const allServerRecords = recordsQuery.data?.records ?? [];
    const serverRecords = useMemo(() => (recordsQuery.data?.records ?? []).filter((r) => !r.is_void), [recordsQuery.data]);

    const cycle = useMemo<CycleState | null>(() => {
        if (!serverCycle) return null;
        const records = serverRecords.map(recordToLegacy).sort((a, b) => b.date.localeCompare(a.date));
        const depletion = Math.max(0, serverCycle.initial_population - serverCycle.current_population);
        return {
            extra: {
                population_start: serverCycle.initial_population,
                strain: profile?.strain ?? serverCycle.strain ?? undefined,
                harvest_target_days: profile?.harvest_target_days ?? undefined,
            },
            records,
            populationStart: serverCycle.initial_population,
            depletion,
            depletionPct: serverCycle.initial_population ? (depletion / serverCycle.initial_population) * 100 : null,
            populationNow: serverCycle.current_population,
        };
    }, [serverCycle, serverRecords, profile]);

    const roomExtra = useMemo<RoomExtra>(
        () => ({ equipment: (equipmentQuery.data?.equipment ?? []).filter((e) => e.is_active == null || Boolean(e.is_active)).map(equipmentToLegacy) }),
        [equipmentQuery.data]
    );
    const expectedPowerW = equipmentQuery.data?.expected_power_w;
    const expectedPowerKw = useMemo(() => {
        return expectedPowerW != null && Number.isFinite(Number(expectedPowerW)) ? Number(expectedPowerW) / 1000 : undefined;
    }, [expectedPowerW]);

    const ageDays = serverCycle ? serverCycle.day_age : null;
    const harvestTargetDays = profile?.harvest_target_days ?? DEFAULT_HARVEST_TARGET_DAYS;
    const daysToHarvest = ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null;

    const todayUsage = useMemo(() => todayFromMetric(selected?.today), [selected?.today]);
    const cycleUsage = useMemo(() => cycleUsageFromMetric(selected?.cycle_totals, serverCycle), [selected?.cycle_totals, serverCycle]);

    const samples = useMemo<RealtimeSample[]>(
        () => telemetryChartPoints(historyQuery.data?.samples ?? [], 30)
            .map((s) => ({ t: Date.parse(s.recorded_at), powerKw: s.power_w == null ? null : s.power_w / 1000, flowLpm: s.flow_rate_lpm }))
            .filter((s) => Number.isFinite(s.t)),
        [historyQuery.data]
    );

    const timezone = summary?.farm?.timezone ?? b.farms.find((f) => f.id === coop?.farm_id)?.timezone ?? "Asia/Makassar";
    const today = summary?.local_date ?? localDateKey(new Date(), timezone);
    const projection = forecastQuery.data;
    // Guard, forecasts and Eco come from the server. No browser extrapolation or local rule engine.
    const insights = serverInsights(selected, serverCycle?.current_population,
        projection?.source === b.source && Number(projection.flock_cycle_id) === serverCycle?.id ? projection : undefined,
        (alertsQuery.data?.alerts ?? []).map(serverAlertToKandang));

    const refreshAll = useCallback(() => {
        void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("broiler") });
    }, [queryClient]);

    return {
        room,
        coop,
        isLoading: b.loading || (Boolean(coopId) && summaryQuery.isPending),
        isError: !b.loading && !coop,
        live,
        online,
        tariff,
        activeCycle,
        serverCycle,
        cycle,
        serverRecords,
        allServerRecords,
        dailyRecordsReady: recordsQuery.isSuccess,
        dailyRecordsError: recordsQuery.error,
        roomExtra,
        serverEquipment: equipmentQuery.data?.equipment ?? [],
        expectedPowerKw,
        ageDays,
        harvestTargetDays,
        daysToHarvest,
        todayUsage,
        cycleUsage,
        insights,
        samples,
        summary,
        localDate: today,
        timezone,
        forecastState: forecastQuery.isError ? "unavailable" : projection?.state ?? "loading",
        ecoRecommendations: ecoQuery.data?.recommendations ?? [],
        ecoError: ecoQuery.error,
        canOperate: b.coopId === coopId && b.canOperate,
        canManage: b.coopId === coopId && b.canManage,
        canRelay: b.coopId === coopId && b.canRelay,
        refreshLocal: refreshAll,
        refreshAll,
    };
}

export type KandangData = ReturnType<typeof useKandangData>;
