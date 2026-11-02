"use client";

import type { Complaint } from "@/types/complaint";

type Props = {
    complaints: Complaint[];
    onUpdateStatus: (complaint: Complaint, status: "open" | "in_progress" | "closed") => void;
};

const STATUS_STYLE: Record<string, string> = {
    open: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    closed: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<string, string> = {
    open: "Waspada",
    in_progress: "Ditindaklanjuti",
    closed: "Selesai",
};

// Tombol aksi berdasarkan status saat ini
const NEXT_ACTIONS: Record<string, { label: string; next: "open" | "in_progress" | "closed"; style: string }[]> = {
    open: [
        { label: "Tindak Lanjuti", next: "in_progress", style: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
    ],
    in_progress: [
        { label: "Selesai", next: "closed", style: "bg-green-50 text-green-600 hover:bg-green-100" },
        { label: "Aktifkan Lagi", next: "open", style: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100" },
    ],
    closed: [
        { label: "Aktifkan Lagi", next: "open", style: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100" },
    ],
};

export default function ComplaintTable({ complaints, onUpdateStatus }: Props) {
    if (complaints.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada alert ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Alert</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Keterangan</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kandang</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Tanggal</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {complaints.map((c, i) => {
                        const isLast = i === complaints.length - 1;
                        const actions = NEXT_ACTIONS[c.status] ?? [];
                        return (
                            <tr
                                key={c.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4 max-w-xs">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F] line-clamp-1">
                                        {c.title}
                                    </p>
                                </td>
                                <td className="px-6 py-4 max-w-xs">
                                    <p className="font-poppins text-sm font-medium text-[#2F2F2F] line-clamp-1">
                                        {c.description ?? "-"}
                                    </p>
                                </td>
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {c.room_number}
                                    {c.room_floor ? ` · Blok ${c.room_floor}` : ""}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {new Date(c.created_at).toLocaleDateString("id-ID", {
                                        day: "2-digit", month: "short", year: "numeric",
                                    })}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                                        {STATUS_LABEL[c.status]}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {actions.map((action) => (
                                            <button
                                                key={action.next}
                                                onClick={() => onUpdateStatus(c, action.next)}
                                                suppressHydrationWarning
                                                className={`rounded-xl px-3 py-1.5 font-inter text-xs font-medium transition ${action.style}`}
                                            >
                                                {action.label}
                                            </button>
                                        ))}
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