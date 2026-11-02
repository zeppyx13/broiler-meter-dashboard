"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getRoomsSummary } from "@/lib/review-api";

function StarRating({ value }: { value: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={14}
                    className={
                        i < Math.round(value)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-gray-200 text-gray-200"
                    }
                />
            ))}
        </div>
    );
}

export default function RatingSummaryTab() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["reviews-summary"],
        queryFn: getRoomsSummary,
        staleTime: 60 * 1000,
    });

    const rooms = data ?? [];
    const reviewedRooms = rooms.filter((r) => r.total_reviews > 0);
    const avgAll = reviewedRooms.length > 0
        ? reviewedRooms.reduce((s, r) => s + Number(r.avg_rating ?? 0), 0) / reviewedRooms.length
        : 0;

    if (isLoading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat data rating.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Overall summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
                    <p className="font-inter text-xs text-[#999]">Total Kamar</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{rooms.length}</p>
                </div>
                <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4 text-center">
                    <p className="font-inter text-xs text-yellow-600">Sudah Diulas</p>
                    <p className="mt-1 font-poppins text-2xl font-bold text-yellow-700">{reviewedRooms.length}</p>
                </div>
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
                    <p className="font-inter text-xs text-[#999]">Rata-rata Semua</p>
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                        <p className="font-poppins text-2xl font-bold text-[#2F2F2F]">
                            {avgAll > 0 ? avgAll.toFixed(1) : "-"}
                        </p>
                        {avgAll > 0 && <Star size={18} className="fill-yellow-400 text-yellow-400" />}
                    </div>
                </div>
            </div>

            {/* Grid per kamar */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rooms
                    .sort((a, b) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0))
                    .map((room) => {
                        const avg = Number(room.avg_rating ?? 0);
                        const hasReview = room.total_reviews > 0;

                        return (
                            <div
                                key={room.room_id}
                                className={`rounded-2xl border bg-white p-4 transition hover:shadow-sm ${hasReview ? "border-[#EAEAEA]" : "border-dashed border-[#E0E0E0]"
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-poppins text-base font-bold text-[#2F2F2F]">
                                            Kamar {room.number}
                                        </p>
                                        <p className="font-inter text-xs text-[#999]">
                                            {room.total_reviews} ulasan
                                        </p>
                                    </div>
                                    {hasReview ? (
                                        <div className="text-right">
                                            <p className="font-poppins text-xl font-bold text-[#2F2F2F]">
                                                {avg.toFixed(1)}
                                            </p>
                                            <StarRating value={avg} />
                                        </div>
                                    ) : (
                                        <span className="rounded-full bg-[#F8F8F8] px-3 py-1 font-inter text-xs text-[#999]">
                                            Belum ada
                                        </span>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {hasReview && (
                                    <div className="mt-3">
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
                                            <div
                                                className="h-full rounded-full bg-yellow-400 transition-all"
                                                style={{ width: `${(avg / 5) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}