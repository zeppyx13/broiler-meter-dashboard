"use client";

import { Search } from "lucide-react";

type Props = {
    search: string;
    status: string;
    month: string;
    onSearchChange: (v: string) => void;
    onStatusChange: (v: string) => void;
    onMonthChange: (v: string) => void;
};

const STATUS_OPTIONS = [
    { label: "Semua", value: "" },
    { label: "Belum Bayar", value: "unpaid" },
    { label: "Lunas", value: "paid" },
    { label: "Overdue", value: "overdue" },
];

export default function InvoiceFilterBar({
    search, status, month,
    onSearchChange, onStatusChange, onMonthChange,
}: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                {/* Search */}
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

                {/* Filter Status */}
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

                {/* Filter Bulan */}
                <input
                    title="filter bulan"
                    type="month"
                    value={month}
                    onChange={(e) => onMonthChange(e.target.value)}
                    suppressHydrationWarning
                    className="rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5 font-inter text-sm text-[#666] outline-none transition focus:border-[#7B1113]"
                />
            </div>
        </div>
    );
}