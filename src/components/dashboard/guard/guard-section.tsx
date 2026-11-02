"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import SectionCard from "../section-card";
import { getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomExtra, getTodayUsage } from "@/lib/broiler-local-store";
import {
    expectedWaterPerBirdLPerDay, classifyWaterDeviation, ageDaysFromChickIn, isTelemetryFresh,
    type DeviationTier,
} from "@/lib/broiler-reference";

type LiveStatus = {
    room_id: number;
    water_total_liter: number;
    power: number;
    recorded_at: string;
};

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAllLiveStatus(): Promise<LiveStatus[]> {
    const response = await api.get("/api/iot/live-status", { headers: authHeader() });
    return response.data.data ?? [];
}

const TIER_STYLE: Record<DeviationTier, string> = {
    kritis: "bg-[#FDEAEA] text-[#B42318] border-l-[#B42318]",
    waspada: "bg-[#FFF4E5] text-[#B76E00] border-l-[#B76E00]",
    normal: "bg-[#EAFBF0] text-[#1F8A4C] border-l-[#1F8A4C]",
};

export default function GuardSection() {
    const { data: roomData } = useQuery({ queryKey: ["rooms", "", "", 1], queryFn: () => getRooms({ limit: 100 }), staleTime: 30_000 });
    const { data: leaseData } = useQuery({ queryKey: ["leases-active-all"], queryFn: () => getLeases({ status: "active", limit: 100 }), staleTime: 30_000 });
    const { data: liveList } = useQuery({ queryKey: ["iot-live-status-all"], queryFn: getAllLiveStatus, refetchInterval: 10_000, staleTime: 10_000 });

    const rooms = roomData?.rooms ?? [];
    const leases = leaseData?.leases ?? [];
    const liveMap = new Map((liveList ?? []).map((l) => [l.room_id, l]));

    type RoomAlert = { roomId: number; roomNumber: string; tier: DeviationTier; title: string; detail: string };
    const alerts: RoomAlert[] = [];

    for (const room of rooms) {
        const cycle = leases.find((l) => l.room_id === room.id);
        if (!cycle) continue;

        const live = liveMap.get(room.id);
        const online = isTelemetryFresh(live?.recorded_at);
        const extra = getRoomExtra(room.id);
        const ageDays = ageDaysFromChickIn(cycle.start_date);

        if (!online) {
            alerts.push({
                roomId: room.id, roomNumber: room.number, tier: "kritis",
                title: "Perangkat offline",
                detail: "Tidak ada data telemetry terbaru. Kemungkinan listrik padam atau koneksi terputus.",
            });
            continue;
        }

        if (extra.population && ageDays != null && live) {
            const { waterTodayLiter } = getTodayUsage(room.id, live.water_total_liter, 0);
            const perBirdLiter = waterTodayLiter / extra.population;
            const dev = classifyWaterDeviation(perBirdLiter, ageDays);
            if (dev.tier !== "normal") {
                alerts.push({
                    roomId: room.id, roomNumber: room.number, tier: dev.tier,
                    title: dev.direction === "turun" ? "Air minum di bawah pola normal" : "Air minum di atas pola normal",
                    detail: `${dev.pct >= 0 ? "+" : ""}${dev.pct.toFixed(0)}% dari estimasi ${expectedWaterPerBirdLPerDay(ageDays).toFixed(3)} L/ekor (hari ke-${ageDays}).`,
                });
            }
        }
    }

    const sorted = alerts.sort((a, b) => (a.tier === "kritis" ? -1 : 1) - (b.tier === "kritis" ? -1 : 1));

    return (
        <SectionCard>
            <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <ShieldAlert size={18} className="text-[#7B1113]" />
                </div>
                <div>
                    <p className="font-inter text-sm text-[#666]">Lintas Kandang</p>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Guard — Peringatan Aktif</h3>
                </div>
            </div>

            <p className="mt-3 rounded-2xl bg-[#FFF8EC] px-4 py-2 font-inter text-xs text-[#9A6B14]">
                Ambang & kurva pola normal berdasarkan estimasi referensi umum, bukan riwayat kandang Anda.
            </p>

            <div className="mt-4 space-y-3">
                {sorted.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-4">
                        <ShieldCheck size={16} className="text-green-600" />
                        <p className="font-inter text-sm text-[#777]">Tidak ada peringatan aktif di seluruh kandang.</p>
                    </div>
                ) : (
                    sorted.slice(0, 5).map((a, i) => (
                        <Link
                            key={`${a.roomId}-${i}`}
                            href={`/dashboard/kamar/${a.roomId}`}
                            className={`block rounded-xl border-l-4 p-3 transition hover:opacity-90 ${TIER_STYLE[a.tier]}`}
                        >
                            <p className="font-inter text-[11px] font-bold">{a.tier.toUpperCase()} · Kandang {a.roomNumber}</p>
                            <p className="mt-0.5 font-inter text-xs font-semibold">{a.title}</p>
                            <p className="mt-0.5 font-inter text-xs opacity-90">{a.detail}</p>
                        </Link>
                    ))
                )}
            </div>
        </SectionCard>
    );
}
