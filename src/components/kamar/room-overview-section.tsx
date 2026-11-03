"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomExtra } from "@/lib/broiler-local-store";
import { isTelemetryFresh } from "@/lib/broiler-reference";

type RoomWithDetails = {
    id: number;
    number: string;
    floor: number | null;
    is_available: boolean | number;
};

async function getAllRooms(): Promise<RoomWithDetails[]> {
    const response = await api.get("/api/rooms/all");
    return response.data?.data?.rooms ?? [];
}

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAllLiveStatus(): Promise<{ room_id: number; recorded_at: string }[]> {
    const response = await api.get("/api/iot/live-status", { headers: authHeader() });
    return response.data.data ?? [];
}

export default function RoomOverviewSection() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "available" | "occupied">("all");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["rooms-overview"],
        queryFn: getAllRooms,
        staleTime: 60 * 1000,
    });

    const { data: liveList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 15 * 1000,
        staleTime: 10 * 1000,
    });
    const liveMap = new Map((liveList ?? []).map((l) => [l.room_id, l]));

    const rooms = (data ?? []).filter((r) => {
        const matchSearch = search
            ? r.number.toLowerCase().includes(search.toLowerCase())
            : true;
        const matchFilter =
            filter === "all"
                ? true
                : filter === "available"
                    ? Boolean(r.is_available)
                    : !Boolean(r.is_available);
        return matchSearch && matchFilter;
    });

    const totalRooms = data?.length ?? 0;
    const occupiedCount = data?.filter((r) => !Boolean(r.is_available)).length ?? 0;
    const availableCount = data?.filter((r) => Boolean(r.is_available)).length ?? 0;

    return (
        <div className="space-y-5">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
                    <p className="font-inter text-xs text-[#999]">Total Kandang</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{totalRooms}</p>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-center">
                    <p className="font-inter text-xs text-green-600">Tersedia</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-green-700">{availableCount}</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
                    <p className="font-inter text-xs text-red-500">Terisi</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-red-700">{occupiedCount}</p>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                        <Search size={15} className="text-[#999]" />
                        <input
                            type="text"
                            placeholder="Cari nomor kandang..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            suppressHydrationWarning
                            className="w-36 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                        />
                    </div>

                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {(["all", "available", "occupied"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                suppressHydrationWarning
                                className={`px-4 py-2.5 font-inter text-sm transition-colors ${filter === f
                                    ? "bg-[#7B1113] text-white"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                    }`}
                            >
                                {f === "all" ? "Semua" : f === "available" ? "Tersedia" : "Terisi"}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="font-inter text-sm text-[#999]">
                    Menampilkan {rooms.length} kandang
                </p>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data kandang.
                </div>
            )}

            {!isLoading && !isError && rooms.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                    <p className="font-inter text-sm text-[#999]">Tidak ada kandang ditemukan.</p>
                </div>
            )}

            {/* List — ringkas, klik baris untuk lihat Ringkasan lengkap */}
            {!isLoading && !isError && rooms.length > 0 && (
                <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
                    {rooms.map((room) => {
                        const available = Boolean(room.is_available);
                        const population = getRoomExtra(room.id).population;
                        const online = isTelemetryFresh(liveMap.get(room.id)?.recorded_at);

                        return (
                            <Link
                                href={`/dashboard/kamar/${room.id}`}
                                key={room.id}
                                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#FAFAFA]"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div>
                                        <p className="font-poppins text-sm font-bold text-[#2F2F2F]">
                                            Kandang {room.number}
                                        </p>
                                        <p className="font-inter text-xs text-[#999]">
                                            {room.floor !== null ? `Blok ${room.floor}` : "Blok -"}
                                            {" · "}
                                            {population ? `${population.toLocaleString("id-ID")} ekor` : "Populasi belum diisi"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-xs font-medium ${online ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                                        {online ? "Online" : "Offline"}
                                    </span>
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${available
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                        }`}>
                                        {available ? "Tersedia" : "Terisi"}
                                    </span>
                                    <ChevronRight size={16} className="text-[#CCC]" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
