"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoomById } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getTariff } from "@/lib/tariff-api";
import { socket } from "@/lib/socket";
import { getAllLiveStatus, type LiveStatus } from "@/lib/live-status-api";
import {
    ensureCycleBaseline, getCycleState, getCycleUsage, getExpectedPowerKw, getRoomExtra, getTodayUsage, localDateKey,
} from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh } from "@/lib/broiler-reference";
import { computeKandangInsights } from "@/lib/kandang-insights";

export type RealtimeSample = { t: number; powerKw: number; flowLpm: number };

// Grafik real-time mengumpulkan sampel sendiri di browser (tidak ada riwayat dari backend).
export const REALTIME_WINDOW_MS = 30 * 60 * 1000;

const realtimeKey = (roomId: number) => `coasther-rt-${roomId}`;

// Form dan penetapan baseline menulis penyimpanan lokal di luar React.
// Semua pembaca berlangganan revisi yang sama agar perubahan langsung terbaca.
let localRevision = 0;
const localSubscribers = new Set<() => void>();
const readLocalRevision = () => localRevision;
const readServerRevision = () => 0;
function subscribeLocalChanges(listener: () => void) {
    localSubscribers.add(listener);
    return () => { localSubscribers.delete(listener); };
}
function refreshLocal() {
    localRevision += 1;
    localSubscribers.forEach((listener) => listener());
}

function readRealtimeSamples(roomId: number): RealtimeSample[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.sessionStorage.getItem(realtimeKey(roomId));
        const parsed = raw ? (JSON.parse(raw) as RealtimeSample[]) : [];
        // Jendela 30 menit dihitung dari sampel terakhir — grafik memperlihatkan data terakhir yang ada.
        return Array.isArray(parsed) ? parsed.filter((s) => typeof s?.t === "number") : [];
    } catch {
        return [];
    }
}

function writeRealtimeSamples(roomId: number, samples: RealtimeSample[]) {
    try {
        window.sessionStorage.setItem(realtimeKey(roomId), JSON.stringify(samples));
    } catch {
        // abaikan (private mode / storage penuh)
    }
}

export function useKandangData(roomId: number) {
    const queryClient = useQueryClient();
    const localVersion = useSyncExternalStore(subscribeLocalChanges, readLocalRevision, readServerRevision);
    const [pushed, setPushed] = useState<Record<number, LiveStatus>>({});
    const [realtime, setRealtime] = useState(() => ({ roomId, samples: readRealtimeSamples(roomId) }));

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
        socket.connect();
        const onTelemetry = (payload: Partial<LiveStatus> & { room_id: number | string }) => {
            const rid = Number(payload.room_id);
            if (!rid) return;
            setPushed((prev) => {
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

    // Data alat = hasil polling, ditimpa data socket bila socket lebih baru.
    const polled = useMemo(() => liveStatusList?.find((d) => d.room_id === roomId), [liveStatusList, roomId]);
    const pushedForRoom = pushed[roomId];
    const live = useMemo<LiveStatus | undefined>(() => {
        if (!pushedForRoom) return polled;
        if (!polled) return pushedForRoom;
        return Date.parse(pushedForRoom.recorded_at) >= Date.parse(polled.recorded_at) ? { ...polled, ...pushedForRoom } : polled;
    }, [polled, pushedForRoom]);
    const online = isTelemetryFresh(live?.recorded_at);

    const activeCycle = useMemo(() => {
        const mine = (leaseData?.leases ?? []).filter((l) => l.room_id === roomId && l.status === "active");
        return mine.sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
    }, [leaseData, roomId]);

    // Satu sampel per pembacaan alat baru (recorded_at berubah). Diperbarui saat render
    // (pola "state dari render sebelumnya"), jadi tidak ada render ganda lewat effect.
    let rt = realtime;
    if (rt.roomId !== roomId) rt = { roomId, samples: readRealtimeSamples(roomId) };
    const t = live?.recorded_at ? Date.parse(live.recorded_at) : NaN;
    const lastSample = rt.samples[rt.samples.length - 1];
    if (!Number.isNaN(t) && (!lastSample || t > lastSample.t)) {
        rt = {
            roomId,
            samples: [
                ...rt.samples.filter((s) => s.t >= t - REALTIME_WINDOW_MS),
                { t, powerKw: (live?.power ?? 0) / 1000, flowLpm: live?.flow_rate_lpm ?? 0 },
            ],
        };
    }
    if (rt !== realtime) setRealtime(rt);
    const samples = rt.samples;

    // Sampel disimpan di sessionStorage tab ini agar grafik tidak kosong lagi setelah reload.
    // Sengaja bukan prefix "coasther_" supaya tidak ikut file cadangan.
    useEffect(() => {
        if (samples.length > 0) writeRealtimeSamples(roomId, samples);
    }, [roomId, samples]);

    // Siklus yang dimulai sebelum alat tercatat: angka meter pertama yang terlihat dijadikan titik awal.
    useEffect(() => {
        if (!activeCycle || !live || live.water_total_liter == null || live.energy_kwh_total == null) return;
        if (ensureCycleBaseline(activeCycle.id, live.water_total_liter, live.energy_kwh_total)) refreshLocal();
    }, [activeCycle, live]);

    // localVersion memaksa baca ulang localStorage setelah data lokal berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const roomExtra = useMemo(() => getRoomExtra(roomId), [roomId, localVersion]);
    const cycle = useMemo(
        () => (activeCycle ? getCycleState(activeCycle.id, roomId) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const expectedPowerKw = getExpectedPowerKw(roomExtra);

    const insights = computeKandangInsights({
        hasActiveCycle: Boolean(activeCycle),
        ageDays,
        daysToHarvest,
        harvestTargetDays,
        populationNow: cycle?.populationNow,
        recordedToday: cycle ? cycle.records.some((r) => r.date === localDateKey()) : undefined,
        online,
        live,
        todayUsage,
        cycleUsage,
        expectedPowerKw,
        tariff,
    });

    const refreshAll = useCallback(() => {
        refreshLocal();
        ["room-detail", "leases-active-all", "leases-ended-all", "leases", "leases-active-count", "rooms", "rooms-overview"].forEach((key) =>
            queryClient.invalidateQueries({ queryKey: [key] })
        );
    }, [queryClient]);

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
        expectedPowerKw,
        ageDays,
        harvestTargetDays,
        daysToHarvest,
        todayUsage,
        cycleUsage,
        insights,
        samples,
        refreshLocal,
        refreshAll,
    };
}

export type KandangData = ReturnType<typeof useKandangData>;
