import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { GuardSettings } from "@/lib/guard-settings";
import {
    getCycleState, getExpectedPowerKw, getRoomExtra, getTodayUsage, localDateKey,
} from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh } from "@/lib/broiler-reference";
import { computeKandangInsights, type KandangAlert } from "@/lib/kandang-insights";

export type RoomAlert = KandangAlert & { roomId: number; roomNumber: string };

/** Jalankan aturan Guard pada semua kandang yang punya siklus berjalan. */
export function scanAllKandang(rooms: Room[], activeLeases: Lease[], liveList: LiveStatus[], settings: GuardSettings): RoomAlert[] {
    const liveMap = new Map(liveList.map((l) => [l.room_id, l]));
    const today = localDateKey();
    const result: RoomAlert[] = [];

    for (const room of rooms) {
        const cycle = activeLeases.find((l) => l.room_id === room.id && l.status === "active");
        if (!cycle) continue;

        const live = liveMap.get(room.id);
        const state = getCycleState(cycle.id, room.id);
        const ageDays = ageDaysFromChickIn(cycle.start_date);
        const harvestTargetDays = state.extra.harvest_target_days ?? 35;

        const { alerts } = computeKandangInsights({
            hasActiveCycle: true,
            ageDays,
            daysToHarvest: ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null,
            harvestTargetDays,
            populationNow: state.populationNow,
            recordedToday: state.records.some((r) => r.date === today),
            online: isTelemetryFresh(live?.recorded_at, settings.offlineMinutes),
            live,
            todayUsage: getTodayUsage(room.id, live?.water_total_liter, live?.energy_kwh_total),
            cycleUsage: null,
            expectedPowerKw: getExpectedPowerKw(getRoomExtra(room.id)),
            settings,
        });

        alerts.forEach((a) => result.push({ ...a, roomId: room.id, roomNumber: room.number }));
    }
    return result;
}
