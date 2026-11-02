"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Lease } from "@/types/lease";

type Props = {
    leases: Lease[];
    onEdit: (lease: Lease) => void;
    onDelete: (lease: Lease) => void;
};

function formatDate(date: string | null) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

export default function LeaseTable({ leases, onEdit, onDelete }: Props) {
    if (leases.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada data siklus produksi ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kandang</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Chick-in</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Estimasi Panen</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {leases.map((l, i) => {
                        const isLast = i === leases.length - 1;
                        return (
                            <tr
                                key={l.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {l.room_number}
                                    {l.room_floor ? ` · Blok ${l.room_floor}` : ""}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{formatDate(l.start_date)}</td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{formatDate(l.end_date)}</td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${l.status === "active"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-600"
                                        }`}>
                                        {l.status === "active" ? "Aktif" : "Selesai"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            title="edit"
                                            onClick={() => onEdit(l)}
                                            suppressHydrationWarning
                                            className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                        >
                                            <Pencil size={15} className="text-[#555]" />
                                        </button>
                                        <button
                                            title="hapus"
                                            onClick={() => onDelete(l)}
                                            suppressHydrationWarning
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