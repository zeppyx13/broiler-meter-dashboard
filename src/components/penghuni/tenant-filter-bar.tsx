"use client";

import { Search } from "lucide-react";

type Props = {
    search: string;
    role: "" | "tenant" | "admin" | "manager";
    onSearchChange: (v: string) => void;
    onRoleChange: (v: "" | "tenant" | "admin" | "manager") => void;
};

const ROLE_OPTIONS: { label: string; value: "" | "tenant" | "admin" | "manager" }[] = [
    { label: "Semua", value: "" },
    { label: "Tenant", value: "tenant" },
    { label: "Admin", value: "admin" },
    { label: "Manager", value: "manager" },
];

export default function TenantFilterBar({ search, role, onSearchChange, onRoleChange }: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5">
                    <Search size={16} className="text-[#999]" />
                    <input
                        type="text"
                        placeholder="Cari nama atau email..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        suppressHydrationWarning
                        className="w-48 bg-transparent font-inter text-sm outline-none placeholder:text-[#999]"
                    />
                </div>

                <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                    {ROLE_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onRoleChange(opt.value)}
                            suppressHydrationWarning
                            className={`px-4 py-2.5 font-inter text-sm transition-colors ${role === opt.value
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