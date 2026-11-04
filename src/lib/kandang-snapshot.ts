import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { GuardSettings } from "@/lib/guard-settings";
import {
    getCycleState, getExpectedPowerKw, getRoomExtra, getTodayUsage, localDateKey, type TodayUsage,
} from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh } from "@/lib/broiler-reference";
import { computeKandangInsights, type KandangInsights } from "@/lib/kandang-insights";

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

/** Kondisi terkini tiap kandang — dipakai bersama Beranda dan Guard agar angkanya selalu sama. */
export function buildSnapshots(rooms: Room[], activeLeases: Lease[], liveList: LiveStatus[], settings: GuardSettings): KandangSnapshot[] {
    const liveMap = new Map(liveList.map((l) => [l.room_id, l]));
    const today = localDateKey();

    return rooms.map((room) => {
        const cycle = activeLeases.find((l) => l.room_id === room.id && l.status === "active") ?? null;
        const live = liveMap.get(room.id);
        const online = isTelemetryFresh(live?.recorded_at, settings.offlineMinutes);
        const state = cycle ? getCycleState(cycle.id, room.id) : null;
        const ageDays = cycle ? ageDaysFromChickIn(cycle.start_date) : null;
        const harvestTargetDays = state?.extra.harvest_target_days ?? 35;
        const expectedPowerKw = getExpectedPowerKw(getRoomExtra(room.id));
        const todayUsage = getTodayUsage(room.id, live?.water_total_liter, live?.energy_kwh_total);

        const insights = computeKandangInsights({
            hasActiveCycle: Boolean(cycle),
            ageDays,
            daysToHarvest: ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null,
            harvestTargetDays,
            populationNow: state?.populationNow,
            recordedToday: state ? state.records.some((r) => r.date === today) : undefined,
            online,
            live,
            todayUsage,
            cycleUsage: null,
            expectedPowerKw,
            settings,
        });

        return {
            room, cycle, live, online, ageDays, harvestTargetDays,
            populationNow: state?.populationNow, expectedPowerKw, todayUsage, insights,
        };
    });
}
