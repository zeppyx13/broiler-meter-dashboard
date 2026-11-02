"use client";

import { Pencil, Trash2, LineChart, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Room } from "@/types/room";
import { getFacilities } from "@/lib/facility-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomExtra } from "@/lib/broiler-local-store";
import { isTelemetryFresh } from "@/lib/broiler-reference";

type RoomTableProps = {
    rooms: Room[];
    onEdit: (room: Room) => void;
    onDelete: (room: Room) => void;
};

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAllLiveStatus(): Promise<{ room_id: number; recorded_at: string }[]> {
    const response = await api.get("/api/iot/live-status", { headers: authHeader() });
    return response.data.data ?? [];
}

export default function RoomTable({ rooms, onEdit, onDelete }: RoomTableProps) {
    const { data: facilityData } = useQuery({
        queryKey: ["facilities"],
        queryFn: getFacilities,
        staleTime: 5 * 60 * 1000,
    });
    const totalFacilities = facilityData?.facilities?.length ?? 0;

    const { data: liveList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 15 * 1000,
        staleTime: 10 * 1000,
    });
    const liveMap = new Map((liveList ?? []).map((l) => [l.room_id, l]));

    if (rooms.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada kandang ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full border-separate border-spacing-y-0">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kandang</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Blok</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Populasi</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Perangkat</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Komponen</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {rooms.map((room, i) => {
                        const isAvailable = Boolean(room.is_available);
                        const isLast = i === rooms.length - 1;
                        const roomFacilityCount = room.facilities?.length ?? 0;
                        const ratio = totalFacilities > 0
                            ? roomFacilityCount / totalFacilities
                            : 0;
                        const badgeStyle =
                            ratio >= 0.7
                                ? "bg-green-100 text-green-700"
                                : ratio >= 0.4
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-600";
                        const population = getRoomExtra(room.id).population;
                        const online = isTelemetryFresh(liveMap.get(room.id)?.recorded_at);

                        return (
                            <tr
                                key={room.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    <Link href={`/dashboard/kamar/${room.id}`} className="hover:text-[#7B1113] hover:underline">
                                        {room.number}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {room.floor !== null ? `Blok ${room.floor}` : "-"}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {population ? `${population.toLocaleString("id-ID")} ekor` : "-"}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1 font-inter text-xs font-medium ${online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
                                        {online ? "Online" : "Offline"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="group relative w-fit">
                                        {/* Badge count */}
                                        <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium cursor-default ${badgeStyle}`}>
                                            {roomFacilityCount}/{totalFacilities}
                                        </span>
                                        {/* Tooltip nama fasilitas */}
                                        {roomFacilityCount > 0 && (
                                            <div className="invisible absolute bottom-full left-0 z-10 mb-2 w-max max-w-xs rounded-2xl border border-[#EAEAEA] bg-white p-3 shadow-lg group-hover:visible">
                                                <p className="mb-2 font-inter text-xs font-medium text-[#777]">
                                                    Komponen kandang:
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {room.facilities?.map((f) => (
                                                        <span
                                                            key={f.id}
                                                            className="rounded-xl bg-[#F8F8F8] px-2 py-0.5 font-inter text-xs text-[#555]"
                                                        >
                                                            {f.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${isAvailable
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                        }`}>
                                        {isAvailable ? "Tersedia" : "Terisi"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/kamar/${room.id}`}
                                            title="Lihat Ringkasan"
                                            className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                        >
                                            <LineChart size={15} className="text-[#7B1113]" />
                                        </Link>
                                        <button
                                            onClick={() => onEdit(room)}
                                            title="Edit"
                                            className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                        >
                                            <Pencil size={15} className="text-[#555]" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(room)}
                                            title="Hapus"
                                            className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100"
                                        >
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}