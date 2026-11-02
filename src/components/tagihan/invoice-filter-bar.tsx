"use client";

import { Search } from "lucide-react";

type Props = {
    search: string;
    month: string;
    onSearchChange: (v: string) => void;
    onMonthChange: (v: string) => void;
};

export default function InvoiceFilterBar({
    search, month,
    onSearchChange, onMonthChange,
}: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                    <Search size={16} className="text-[#999]" />
                    <input
                        type="text"
                        placeholder="Cari nomor kandang..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        suppressHydrationWarning
                        className="w-44 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                    />
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
