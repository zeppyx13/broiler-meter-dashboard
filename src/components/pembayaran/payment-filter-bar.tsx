"use client";

import { Search } from "lucide-react";

type Props = {
    search: string;
    status: string;
    onSearchChange: (v: string) => void;
    onStatusChange: (v: string) => void;
};

const STATUS_OPTIONS = [
    { label: "Semua", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Lunas", value: "paid" },
    { label: "Gagal", value: "failed" },
    { label: "Expired", value: "expired" },
];

export default function PaymentFilterBar({ search, status, onSearchChange, onStatusChange }: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                    <Search size={16} className="text-[#999]" />
                    <input
                        type="text"
                        placeholder="Cari nama atau kamar..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        suppressHydrationWarning
                        className="w-44 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                    />
                </div>

                <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                    {STATUS_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onStatusChange(opt.value)}
                            suppressHydrationWarning
                            className={`px-4 py-2.5 font-inter text-sm transition-colors ${status === opt.value
                                    ? "bg-[#7B1113] text-white"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}