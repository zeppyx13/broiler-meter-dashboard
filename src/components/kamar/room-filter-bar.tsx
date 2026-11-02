"use client";

import { Search } from "lucide-react";

type FilterBarProps = {
    search: string;
    status: "" | "0" | "1";
    onSearchChange: (v: string) => void;
    onStatusChange: (v: "" | "0" | "1") => void;
    onTambah: () => void;
};

const STATUS_OPTIONS: { label: string; value: "" | "0" | "1" }[] = [
    { label: "Semua", value: "" },
    { label: "Tersedia", value: "1" },
    { label: "Terisi", value: "0" },
];

export default function RoomFilterBar({
    search,
    status,
    onSearchChange,
    onStatusChange,
    onTambah,
}: FilterBarProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                    <Search size={16} className="text-[#999]" />
                    <input
                        type="text"
                        placeholder="Cari nomor kamar..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-44 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                    />
                </div>

                {/* Filter Status */}
                <div className="flex rounded-2xl border border-[#EAEAEA] bg-white overflow-hidden">
                    {STATUS_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onStatusChange(opt.value)}
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

            {/* Tombol Tambah */}
            <button
                onClick={onTambah}
                className="rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
            >
                + Tambah Kamar
            </button>
        </div>
    );
}