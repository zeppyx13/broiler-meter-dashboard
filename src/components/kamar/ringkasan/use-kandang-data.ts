"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoomById } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getTariff } from "@/lib/tariff-api";
import { socket } from "@/lib/socket";
import { getAllLiveStatus, type LiveStatus } from "@/lib/live-status-api";
import {
    ensureCycleBaseline, getCycleState, getCycleUsage, getRoomExtra, getTodayUsage,
} from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh } from "@/lib/broiler-reference";
import { computeKandangInsights } from "@/lib/kandang-insights";

export function useKandangData(roomId: number) {
    const queryClient = useQueryClient();
    const [localVersion, setLocalVersion] = useState(0);
    const refreshLocal = useCallback(() => setLocalVersion((v) => v + 1), []);
    const [liveData, setLiveData] = useState<Record<number, LiveStatus>>({});

    const roomQuery = useQuery({
        queryKey: ["room-detail", roomId],
        queryFn: () => getRoomById(roomId),
        enabled: Number.isFinite(roomId),
    });

    const { data: leaseData } = useQuery({
        queryKey: ["leases-active-all"],
        queryFn: () => getLeases({ status: "active", limit: 100 }),
        staleTime: 30 * 1000,
    });

    const { data: tariff } = useQuery({
        queryKey: ["tariff"],
        queryFn: getTariff,
        staleTime: 5 * 60 * 1000,
    });

    const { data: liveStatusList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 5 * 1000,
        staleTime: 5 * 1000,
    });

    useEffect(() => {
        if (!liveStatusList) return;
        const map: Record<number, LiveStatus> = {};
        liveStatusList.forEach((d) => { map[d.room_id] = d; });
        setLiveData(map);
    }, [liveStatusList]);

    useEffect(() => {
        socket.connect();
        const onTelemetry = (payload: Partial<LiveStatus> & { room_id: number | string }) => {
            const rid = Number(payload.room_id);
            if (!rid) return;
            setLiveData((prev) => {
                const existing = prev[rid] ?? ({} as LiveStatus);
                return {
                    ...prev,
                    [rid]: {
                        ...existing,
                        ...Object.fromEntries(Object.entries(payload).filter(([, v]) => v != null)),
                        room_id: rid,
                        recorded_at: payload.recorded_at ?? new Date().toISOString(),
                    } as LiveStatus,
                };
            });
        };
        socket.on("telemetry_update", onTelemetry);
        return () => {
            socket.off("telemetry_update", onTelemetry);
            socket.disconnect();
        };
    }, []);

    const room = roomQuery.data?.room;
    const live = liveData[roomId];
    const online = isTelemetryFresh(live?.recorded_at);

    const activeCycle = useMemo(() => {
        const mine = (leaseData?.leases ?? []).filter((l) => l.room_id === roomId && l.status === "active");
        return mine.sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
    }, [leaseData, roomId]);

    // Siklus yang dimulai sebelum alat tercatat: angka meter pertama yang terlihat dijadikan titik awal.
    useEffect(() => {
        if (!activeCycle || !live || live.water_total_liter == null || live.energy_kwh_total == null) return;
        if (ensureCycleBaseline(activeCycle.id, live.water_total_liter, live.energy_kwh_total)) refreshLocal();
    }, [activeCycle, live, refreshLocal]);

    // localVersion memaksa baca ulang localStorage setelah data lokal berubah.
    const roomExtra = useMemo(() => getRoomExtra(roomId), [roomId, localVersion]);
    const cycle = useMemo(
        () => (activeCycle ? getCycleState(activeCycle.id, roomId) : null),
        [activeCycle, roomId, localVersion]
    );

    const ageDays = activeCycle ? ageDaysFromChickIn(activeCycle.start_date) : null;
    const harvestTargetDays = cycle?.extra.harvest_target_days ?? 35;
    const daysToHarvest = ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null;

    const todayUsage = useMemo(
        () => getTodayUsage(roomId, live?.water_total_liter, live?.energy_kwh_total),
        [roomId, live?.water_total_liter, live?.energy_kwh_total]
    );
    const cycleUsage = cycle ? getCycleUsage(cycle.extra, live?.water_total_liter, live?.energy_kwh_total) : null;

    const insights = computeKandangInsights({
        hasActiveCycle: Boolean(activeCycle),
        ageDays,
        daysToHarvest,
        populationNow: cycle?.populationNow,
        online,
        live,
        todayUsage,
        cycleUsage,
        expectedPowerKw: roomExtra.expected_power_kw,
        tariff,
    });

    const refreshAll = useCallback(() => {
        refreshLocal();
        ["room-detail", "leases-active-all", "leases", "leases-active-count", "rooms", "rooms-overview"].forEach((key) =>
            queryClient.invalidateQueries({ queryKey: [key] })
        );
    }, [queryClient, refreshLocal]);

    return {
        room,
        isLoading: roomQuery.isLoading,
        isError: roomQuery.isError,
        live,
        online,
        tariff,
        activeCycle,
        cycle,
        roomExtra,
        ageDays,
        harvestTargetDays,
        daysToHarvest,
        todayUsage,
        cycleUsage,
        insights,
        refreshLocal,
        refreshAll,
    };
}

export type KandangData = ReturnType<typeof useKandangData>;
