"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Search } from "lucide-react";
import { getAllReviews } from "@/lib/review-api";

function StarRating({ value }: { value: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={13}
                    className={
                        i < value
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-gray-200 text-gray-200"
                    }
                />
            ))}
        </div>
    );
}

const RATING_FILTERS = [
    { label: "Semua", value: 0 },
    { label: "⭐⭐⭐⭐⭐ 5", value: 5 },
    { label: "⭐⭐⭐⭐ 4", value: 4 },
    { label: "⭐⭐⭐ 3", value: 3 },
    { label: "⭐⭐ 2", value: 2 },
    { label: "⭐ 1", value: 1 },
];

export default function RatingAllTab() {
    const [search, setSearch] = useState("");
    const [ratingFilter, setRatingFilter] = useState(0);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["reviews-all"],
        queryFn: getAllReviews,
        staleTime: 60 * 1000,
    });

    const reviews = (data ?? []).filter((r) => {
        const matchSearch = search
            ? r.name?.toLowerCase().includes(search.toLowerCase()) ||
            r.number?.toLowerCase().includes(search.toLowerCase())
            : true;
        const matchRating = ratingFilter > 0 ? r.rating === ratingFilter : true;
        return matchSearch && matchRating;
    });

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {/* Search */}
                    <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                        <Search size={15} className="text-[#999]" />
                        <input
                            type="text"
                            placeholder="Cari nama atau kamar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            suppressHydrationWarning
                            className="w-44 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                        />
                    </div>

                    {/* Rating filter */}
                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {RATING_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setRatingFilter(f.value)}
                                suppressHydrationWarning
                                className={`px-3 py-2.5 font-inter text-xs transition-colors ${ratingFilter === f.value
                                        ? "bg-[#7B1113] text-white"
                                        : "text-[#666] hover:bg-[#F8F8F8]"
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="font-inter text-sm text-[#999]">
                    {reviews.length} ulasan
                </p>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat ulasan.
                </div>
            )}

            {!isLoading && !isError && reviews.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                    <p className="font-inter text-sm text-[#999]">Tidak ada ulasan ditemukan.</p>
                </div>
            )}

            {!isLoading && !isError && reviews.length > 0 && (
                <div className="overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-[#EAEAEA]">
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Penghuni</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kamar</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Rating</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Komentar</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.map((r, i) => {
                                const isLast = i === reviews.length - 1;
                                return (
                                    <tr
                                        key={i}
                                        className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                                    >
                                        <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                            {r.name}
                                        </td>
                                        <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                            {r.number}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <StarRating value={r.rating} />
                                                <span className="font-inter text-xs text-[#777]">
                                                    {r.rating}/5
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                            {r.comment ? (
                                                <span className="line-clamp-2 max-w-xs">{r.comment}</span>
                                            ) : (
                                                <span className="italic text-[#BBB]">Tanpa komentar</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-inter text-sm text-[#999]">
                                            {new Date(r.created_at).toLocaleDateString("id-ID", {
                                                day: "2-digit", month: "short", year: "numeric",
                                            })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}