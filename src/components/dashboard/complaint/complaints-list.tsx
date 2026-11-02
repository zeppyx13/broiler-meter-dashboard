"use client";

import Link from "next/link";
import Swal from "sweetalert2";
import SectionCard from "../section-card";
import type { ComplaintItem } from "@/types/dashboard";

type ComplaintsListProps = {
    items: ComplaintItem[];
    onUpdateStatus: (id: number, status: "open" | "in_progress" | "closed") => Promise<void>;
};

const statusMap: Record<ComplaintItem["status"], string> = {
    open: "bg-[#FFF4E5] text-[#B76E00]",
    in_progress: "bg-[#EAF2FF] text-[#2F5BBA]",
    closed: "bg-[#EAFBF0] text-[#1F8A4C]",
};

const statusLabelMap: Record<ComplaintItem["status"], string> = {
    open: "Open",
    in_progress: "Diproses",
    closed: "Selesai",
};

function formatComplaintDate(date: string) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(date));
}

export default function ComplaintsList({ items, onUpdateStatus }: ComplaintsListProps) {
    async function handleAction(
        item: ComplaintItem,
        next: "in_progress" | "closed"
    ) {
        const label = next === "in_progress" ? "memproses" : "menyelesaikan";
        const result = await Swal.fire({
            title: `${label.charAt(0).toUpperCase() + label.slice(1)} keluhan ini?`,
            text: `"${item.title}"`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });
        if (!result.isConfirmed) return;
        await onUpdateStatus(item.id, next);
    }

    return (
        <SectionCard>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-inter text-sm text-[#666]">Keluhan Penghuni</p>
                    <h3 className="mt-1 font-poppins text-xl font-semibold text-[#2F2F2F]">
                        Complaint Management
                    </h3>
                </div>
            </div>

            <div className="mt-6 space-y-4">
                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-6 text-center">
                        <p className="font-inter text-sm text-[#777]">
                            Tidak ada keluhan yang perlu ditindaklanjuti. 🎉
                        </p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-2xl border border-[#EAEAEA] bg-[#F8F8F8] p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-inter text-sm font-semibold text-[#2F2F2F]">
                                        {item.title}
                                    </p>
                                    <p className="mt-1 font-inter text-xs text-[#777]">
                                        Kamar {item.room_number} • Lantai {item.room_floor}
                                    </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${statusMap[item.status]}`}>
                                    {statusLabelMap[item.status]}
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                                <p className="font-inter text-xs text-[#888]">
                                    {formatComplaintDate(item.created_at)}
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href="/dashboard/keluhan"
                                        className="rounded-xl border border-[#D6D6D6] px-3 py-2 font-inter text-xs font-medium text-[#2F2F2F] transition hover:bg-[#F1F1F1]"
                                    >
                                        Detail
                                    </Link>
                                    {item.status === "open" && (
                                        <button
                                            type="button"
                                            onClick={() => handleAction(item, "in_progress")}
                                            suppressHydrationWarning
                                            className="rounded-xl border border-[#C6A971] px-3 py-2 font-inter text-xs font-medium text-[#7B1113] transition hover:bg-[#F8F1E7]"
                                        >
                                            Proses
                                        </button>
                                    )}
                                    {(item.status === "open" || item.status === "in_progress") && (
                                        <button
                                            type="button"
                                            onClick={() => handleAction(item, "closed")}
                                            suppressHydrationWarning
                                            className="rounded-xl bg-[#7B1113] px-3 py-2 font-inter text-xs font-medium text-white transition hover:opacity-90"
                                        >
                                            Selesai
                                        </button>
                                    )}

                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="mt-4">
                <Link
                    href="/dashboard/keluhan"
                    className="flex w-full items-center justify-center rounded-2xl border border-[#EAEAEA] py-3 font-inter text-sm font-medium text-[#7B1113] transition hover:bg-[#ebe9e9]"
                >
                    Lihat Semua Keluhan →
                </Link>
            </div>
        </SectionCard>
    );
}