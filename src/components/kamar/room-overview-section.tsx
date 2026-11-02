"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Star, BedDouble } from "lucide-react";
import { api } from "@/lib/api";

type RoomWithDetails = {
    id: number;
    number: string;
    floor: number | null;
    price_monthly: number;
    deposit: number;
    is_available: boolean | number;
    description: string | null;
    main_image_url: string | null;
    is_occupied: boolean | number;
    facilities: { id: number; name: string }[];
    review_avg: number;
    review_count: number;
};

async function getAllRooms(): Promise<RoomWithDetails[]> {
    const response = await api.get("/api/rooms/all");
    return response.data?.data?.rooms ?? [];
}

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

// ← Dipindah ke luar komponen
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function resolveImageUrl(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${BASE_URL}${path}`;
}

export default function RoomOverviewSection() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "available" | "occupied">("all");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["rooms-overview"],
        queryFn: getAllRooms,
        staleTime: 60 * 1000,
    });

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
                    <p className="font-inter text-xs text-[#999]">Total Kamar</p>
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
                            placeholder="Cari nomor kamar..."
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
                    Menampilkan {rooms.length} kamar
                </p>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-56 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data kamar.
                </div>
            )}

            {!isLoading && !isError && rooms.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                    <p className="font-inter text-sm text-[#999]">Tidak ada kamar ditemukan.</p>
                </div>
            )}

            {!isLoading && !isError && rooms.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {rooms.map((room) => {
                        const available = Boolean(room.is_available);
                        const rating = Number(room.review_avg ?? 0);
                        // ← Resolve sekali, simpan ke variabel
                        const imageUrl = resolveImageUrl(room.main_image_url);

                        return (
                            <div
                                key={room.id}
                                className={`overflow-hidden rounded-3xl border bg-white transition hover:shadow-md ${available ? "border-[#EAEAEA]" : "border-red-100"
                                    }`}
                            >
                                {/* Image */}
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={`Kamar ${room.number}`}
                                        className="h-36 w-full object-cover"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            target.style.display = "none";
                                            // Tampilkan parent dengan placeholder
                                            target.parentElement!.classList.add("flex", "items-center", "justify-center");
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-36 w-full items-center justify-center bg-[#F8F8F8]">
                                        <BedDouble size={36} className="text-[#D0D0D0]" />
                                    </div>
                                )}

                                <div className="p-4">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-poppins text-lg font-bold text-[#2F2F2F]">
                                                Kamar {room.number}
                                            </h3>
                                            <p className="font-inter text-xs text-[#999]">
                                                {room.floor !== null ? `Lantai ${room.floor}` : "Lantai -"}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${available
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-700"
                                            }`}>
                                            {available ? "Tersedia" : "Terisi"}
                                        </span>
                                    </div>

                                    {/* Harga */}
                                    <p className="mt-3 font-poppins text-base font-semibold text-[#7B1113]">
                                        {formatRupiah(room.price_monthly)}
                                        <span className="font-inter text-xs font-normal text-[#999]"> / bulan</span>
                                    </p>

                                    {/* Rating */}
                                    {rating > 0 && (
                                        <div className="mt-2 flex items-center gap-1">
                                            <Star size={13} className="fill-yellow-400 text-yellow-400" />
                                            <span className="font-inter text-xs text-[#555]">
                                                {rating.toFixed(1)}
                                            </span>
                                            <span className="font-inter text-xs text-[#999]">
                                                ({room.review_count} ulasan)
                                            </span>
                                        </div>
                                    )}

                                    {/* Deskripsi */}
                                    {room.description && (
                                        <p className="mt-2 font-inter text-xs text-[#777] line-clamp-2">
                                            {room.description}
                                        </p>
                                    )}

                                    {/* Fasilitas */}
                                    {room.facilities.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {room.facilities.slice(0, 5).map((f) => (
                                                <span
                                                    key={f.id}
                                                    className="rounded-xl bg-[#F8F8F8] px-2.5 py-1 font-inter text-xs text-[#555]"
                                                >
                                                    {f.name}
                                                </span>
                                            ))}
                                            {room.facilities.length > 5 && (
                                                <span className="rounded-xl bg-[#F0F0F0] px-2.5 py-1 font-inter text-xs text-[#999]">
                                                    +{room.facilities.length - 5} lainnya
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Deposit */}
                                    {room.deposit > 0 && (
                                        <p className="mt-3 font-inter text-xs text-[#999]">
                                            Deposit: {formatRupiah(room.deposit)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}