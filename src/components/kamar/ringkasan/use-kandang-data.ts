"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import {
    pickStream, useActiveCycle, useCoopAlerts, useCoopSummary, useCycleProfile, useDailyRecords, useEquipment, useTelemetryHistory,
} from "@/lib/broiler-queries";
import {
    coopToRoom, cycleToLease, cycleUsageFromMetric, equipmentToLegacy, farmToTariff, isLiveOnline, liveToLegacy,
    recordToLegacy, serverAlertToKandang, todayFromMetric,
} from "@/lib/broiler-adapters";
import { localDateKey, type CycleState, type RoomExtra } from "@/lib/broiler-local-store";
import { daysUntilHarvest } from "@/lib/broiler-reference";
import { computeKandangInsights } from "@/lib/kandang-insights";

export type RealtimeSample = { t: number; powerKw: number; flowLpm: number };

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
    const serverCycle = activeQuery.data?.cycle ?? summaryQuery.data?.active_cycle ?? null;
    const profileQuery = useCycleProfile(serverCycle?.id, coopId);
    const recordsQuery = useDailyRecords(serverCycle?.id, coopId);
    const equipmentQuery = useEquipment(coopId);
    const historyQuery = useTelemetryHistory(coopId, b.source, 30);
    const alertsQuery = useCoopAlerts(coopId, b.source, "active");

    const summary = summaryQuery.data;
    const selected = pickStream(summary, b.source);
    const room = useMemo(() => (coop ? coopToRoom(coop) : undefined), [coop]);
    const live = useMemo(() => (coop ? liveToLegacy(selected?.live, coop) : undefined), [selected?.live, coop]);
    const online = isLiveOnline(selected?.live);
    const tariff = useMemo(() => farmToTariff(summary?.farm ?? b.farms.find((f) => f.id === coop?.farm_id)), [summary?.farm, b.farms, coop?.farm_id]);

    const activeCycle = useMemo(() => (serverCycle ? cycleToLease(serverCycle) : null), [serverCycle]);
    const profile = profileQuery.data?.profile ?? null;
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
        () => ({ equipment: (equipmentQuery.data?.equipment ?? []).map(equipmentToLegacy) }),
        [equipmentQuery.data]
    );
    const expectedPowerW = equipmentQuery.data?.expected_power_w;
    const expectedPowerKw = useMemo(() => {
        if (expectedPowerW != null && Number(expectedPowerW) > 0) return Number(expectedPowerW) / 1000;
        const watt = (roomExtra.equipment ?? []).filter((e) => e.active).reduce((s, e) => s + e.count * e.watt, 0);
        return watt > 0 ? watt / 1000 : undefined;
    }, [expectedPowerW, roomExtra]);

    const ageDays = serverCycle ? serverCycle.day_age : null;
    const harvestTargetDays = profile?.harvest_target_days ?? DEFAULT_HARVEST_TARGET_DAYS;
    const daysToHarvest = ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null;

    const todayUsage = useMemo(() => todayFromMetric(selected?.today), [selected?.today]);
    const cycleUsage = useMemo(() => cycleUsageFromMetric(selected?.cycle_totals, serverCycle), [selected?.cycle_totals, serverCycle]);

    const samples = useMemo<RealtimeSample[]>(
        () => (historyQuery.data?.samples ?? [])
            .map((s) => ({ t: Date.parse(s.recorded_at), powerKw: s.power_w == null ? NaN : s.power_w / 1000, flowLpm: s.flow_rate_lpm ?? NaN }))
            .filter((s) => Number.isFinite(s.t)),
        [historyQuery.data]
    );

    const today = summary?.local_date ?? localDateKey();
    const computed = computeKandangInsights({
        hasActiveCycle: Boolean(serverCycle),
        ageDays,
        daysToHarvest,
        harvestTargetDays,
        populationNow: serverCycle?.current_population,
        recordedToday: serverCycle ? serverRecords.some((r) => String(r.date ?? r.record_date).slice(0, 10) === today) : undefined,
        online,
        live,
        todayUsage,
        cycleUsage,
        expectedPowerKw,
        tariff,
    });
    // Peringatan berasal dari Guard server (tetap berjalan walau browser ditutup).
    const insights = { ...computed, alerts: (alertsQuery.data?.alerts ?? []).map(serverAlertToKandang) };

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
        canOperate: b.canOperate,
        canManage: b.canManage,
        canRelay: b.canRelay,
        refreshLocal: refreshAll,
        refreshAll,
    };
}

export type KandangData = ReturnType<typeof useKandangData>;
