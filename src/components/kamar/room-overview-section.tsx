"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Swal from "sweetalert2";
import { Search, ChevronRight, Wifi, WifiOff, Plus } from "lucide-react";
import { createRoom, getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getAllLiveStatus } from "@/lib/live-status-api";
import { getCycleState, setRoomExtra, type RoomExtra } from "@/lib/broiler-local-store";
import { ageDaysFromChickIn, isTelemetryFresh } from "@/lib/broiler-reference";
import type { RoomFormPayload } from "@/types/room";
import RoomFormModal from "./room-form-modal";

type Filter = "all" | "aktif" | "istirahat";

export default function RoomOverviewSection() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [formOpen, setFormOpen] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["rooms-overview"],
        queryFn: () => getRooms({ limit: 100 }),
        staleTime: 60 * 1000,
    });
    const { data: leaseData } = useQuery({
        queryKey: ["leases-active-all"],
        queryFn: () => getLeases({ status: "active", limit: 100 }),
        staleTime: 30 * 1000,
    });
    const { data: liveList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 15 * 1000,
        staleTime: 10 * 1000,
    });

    const liveMap = new Map((liveList ?? []).map((l) => [l.room_id, l]));
    const cycleByRoom = new Map((leaseData?.leases ?? []).map((l) => [l.room_id, l]));
    const allRooms = data?.rooms ?? [];

    const rooms = allRooms.filter((r) => {
        const matchSearch = !search || r.number.toLowerCase().includes(search.toLowerCase());
        const active = cycleByRoom.has(r.id);
        const matchFilter = filter === "all" || (filter === "aktif" ? active : !active);
        return matchSearch && matchFilter;
    });

    const activeCount = allRooms.filter((r) => cycleByRoom.has(r.id)).length;

    async function handleCreate(payload: RoomFormPayload, extra: RoomExtra) {
        try {
            const res = await createRoom(payload);
            let roomId: number | undefined = res?.data?.room?.id ?? res?.data?.id;
            if (!roomId) {
                const found = await getRooms({ search: payload.number, limit: 20 });
                roomId = found.rooms.find((r) => r.number === payload.number)?.id;
            }
            if (roomId) setRoomExtra(roomId, extra);
            queryClient.invalidateQueries({ queryKey: ["rooms-overview"] });
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            setFormOpen(false);
            Swal.fire({ icon: "success", title: "Kandang ditambahkan", timer: 1300, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: err?.response?.data?.message || "Terjadi kesalahan.", confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Summary label="Total kandang" value={allRooms.length} />
                <Summary label="Aktif" value={activeCount} tone="green" />
                <Summary label="Istirahat" value={allRooms.length - activeCount} tone="gray" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5 sm:flex-none">
                        <Search size={15} className="text-[#999]" />
                        <input
                            type="text"
                            placeholder="Cari nomor kandang..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            suppressHydrationWarning
                            className="w-full bg-transparent font-inter text-sm outline-none placeholder:text-[#999] sm:w-40"
                        />
                    </div>
                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {(["all", "aktif", "istirahat"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                suppressHydrationWarning
                                className={`px-4 py-2.5 font-inter text-sm transition-colors ${filter === f ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                            >
                                {f === "all" ? "Semua" : f === "aktif" ? "Aktif" : "Istirahat"}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => setFormOpen(true)}
                    suppressHydrationWarning
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                >
                    <Plus size={16} /> Tambah Kandang
                </button>
            </div>

            {isLoading && (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">Gagal memuat data kandang.</div>
            )}

            {!isLoading && !isError && rooms.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-14 text-center">
                    <p className="font-inter text-sm text-[#999]">
                        {allRooms.length === 0 ? "Belum ada kandang. Tambahkan kandang pertama Anda." : "Tidak ada kandang yang cocok."}
                    </p>
                </div>
            )}

            {!isLoading && !isError && rooms.length > 0 && (
                <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
                    {rooms.map((room) => {
                        const cycle = cycleByRoom.get(room.id);
                        const ageDays = cycle ? ageDaysFromChickIn(cycle.start_date) : null;
                        const populationNow = cycle ? getCycleState(cycle.id, room.id).populationNow : undefined;
                        const online = isTelemetryFresh(liveMap.get(room.id)?.recorded_at);

                        return (
                            <Link
                                href={`/dashboard/kamar/${room.id}`}
                                key={room.id}
                                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#FAFAFA]"
                            >
                                <div className="min-w-0">
                                    <p className="font-poppins text-sm font-bold text-[#2F2F2F]">Kandang {room.number}</p>
                                    <p className="truncate font-inter text-xs text-[#999]">
                                        {room.floor != null ? `Blok ${room.floor}` : "Blok —"}
                                        {cycle
                                            ? ` · Hari ke-${ageDays}${populationNow ? ` · ${populationNow.toLocaleString("id-ID")} ekor` : ""}`
                                            : " · Siap untuk siklus baru"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className={`hidden items-center gap-1 rounded-full px-2.5 py-1 font-inter text-xs font-medium sm:flex ${online ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                                        {online ? "Online" : "Offline"}
                                    </span>
                                    {!online && <WifiOff size={14} className="text-gray-400 sm:hidden" />}
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${cycle ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                        {cycle ? "Aktif" : "Istirahat"}
                                    </span>
                                    <ChevronRight size={16} className="text-[#CCC]" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <RoomFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />
        </div>
    );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "green" | "gray" }) {
    const color = tone === "green" ? "text-green-700" : tone === "gray" ? "text-[#777]" : "text-[#2F2F2F]";
    return (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
            <p className="font-inter text-xs text-[#999]">{label}</p>
            <p className={`mt-1 font-poppins text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );
}
