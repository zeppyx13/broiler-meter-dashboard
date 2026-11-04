import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { GuardSettings } from "@/lib/guard-settings";
import type { KandangAlert } from "@/lib/kandang-insights";
import { buildSnapshots, type KandangSnapshot } from "@/lib/kandang-snapshot";

/** `dataAt`: waktu pembacaan alat yang dinilai — dipakai menghitung waktu deteksi. */
export type RoomAlert = KandangAlert & { roomId: number; roomNumber: string; dataAt?: string };

export function alertsFromSnapshots(snapshots: KandangSnapshot[]): RoomAlert[] {
    return snapshots.flatMap((s) =>
        s.insights.alerts.map((a) => ({ ...a, roomId: s.room.id, roomNumber: s.room.number, dataAt: s.live?.recorded_at }))
    );
}

/** Jalankan aturan Guard pada semua kandang yang punya siklus berjalan. */
export function scanAllKandang(rooms: Room[], activeLeases: Lease[], liveList: LiveStatus[], settings: GuardSettings): RoomAlert[] {
    return alertsFromSnapshots(buildSnapshots(rooms, activeLeases, liveList, settings));
}
