"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ChevronRight } from "lucide-react";
import SectionCard from "../section-card";
import { getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getAllLiveStatus } from "@/lib/live-status-api";
import { getCycleState, getRoomExtra, getTodayUsage } from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh, type DeviationTier } from "@/lib/broiler-reference";
import { computeKandangInsights, type KandangAlert } from "@/lib/kandang-insights";

const TIER_STYLE: Record<DeviationTier, string> = {
    kritis: "bg-[#FDEAEA] text-[#B42318] border-l-[#B42318]",
    waspada: "bg-[#FFF4E5] text-[#B76E00] border-l-[#B76E00]",
    normal: "bg-[#EAFBF0] text-[#1F8A4C] border-l-[#1F8A4C]",
};

const TIER_ORDER: Record<DeviationTier, number> = { kritis: 0, waspada: 1, normal: 2 };

export default function GuardSection() {
    const { data: roomData } = useQuery({ queryKey: ["rooms-overview"], queryFn: () => getRooms({ limit: 100 }), staleTime: 60_000 });
    const { data: leaseData } = useQuery({ queryKey: ["leases-active-all"], queryFn: () => getLeases({ status: "active", limit: 100 }), staleTime: 30_000 });
    const { data: liveList } = useQuery({ queryKey: ["iot-live-status-all"], queryFn: getAllLiveStatus, refetchInterval: 10_000, staleTime: 10_000 });

    const liveMap = new Map((liveList ?? []).map((l) => [l.room_id, l]));
    const cycleByRoom = new Map((leaseData?.leases ?? []).map((l) => [l.room_id, l]));

    const alerts: (KandangAlert & { roomId: number; roomNumber: string })[] = [];
    for (const room of roomData?.rooms ?? []) {
        const cycle = cycleByRoom.get(room.id);
        if (!cycle) continue;
        const live = liveMap.get(room.id);
        const state = getCycleState(cycle.id, room.id);
        const ageDays = ageDaysFromChickIn(cycle.start_date);
        const insights = computeKandangInsights({
            hasActiveCycle: true,
            ageDays,
            daysToHarvest: ageDays != null ? daysUntilHarvest(ageDays, state.extra.harvest_target_days ?? 35) : null,
            populationNow: state.populationNow,
            online: isTelemetryFresh(live?.recorded_at),
            live,
            todayUsage: getTodayUsage(room.id, live?.water_total_liter, live?.energy_kwh_total),
            cycleUsage: null,
            expectedPowerKw: getRoomExtra(room.id).expected_power_kw,
        });
        insights.alerts.forEach((a) => alerts.push({ ...a, roomId: room.id, roomNumber: room.number }));
    }
    alerts.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

    return (
        <SectionCard>
            <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <ShieldAlert size={18} className="text-[#7B1113]" />
                </div>
                <div>
                    <p className="font-inter text-sm text-[#666]">Semua kandang aktif</p>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Guard — Peringatan</h3>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-4">
                        <ShieldCheck size={16} className="text-green-600" />
                        <p className="font-inter text-sm text-[#777]">Tidak ada peringatan di kandang aktif.</p>
                    </div>
                ) : (
                    alerts.slice(0, 5).map((a) => (
                        <Link
                            key={`${a.roomId}-${a.id}`}
                            href={`/dashboard/kamar/${a.roomId}`}
                            className={`flex items-center justify-between gap-3 rounded-xl border-l-4 p-3 transition hover:opacity-90 ${TIER_STYLE[a.tier]}`}
                        >
                            <div className="min-w-0">
                                <p className="font-inter text-[11px] font-bold">{a.tier.toUpperCase()} · Kandang {a.roomNumber}</p>
                                <p className="mt-0.5 font-inter text-sm font-semibold">{a.title}</p>
                                <p className="mt-0.5 font-inter text-xs opacity-90">{a.action}</p>
                            </div>
                            <ChevronRight size={16} className="shrink-0 opacity-60" />
                        </Link>
                    ))
                )}
                {alerts.length > 5 && (
                    <p className="font-inter text-xs text-[#999]">+{alerts.length - 5} peringatan lain — buka halaman kandang terkait.</p>
                )}
            </div>
        </SectionCard>
    );
}
