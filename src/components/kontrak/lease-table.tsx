"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { Lease } from "@/types/lease";
import { getCycleState } from "@/lib/broiler-local-store";

type Props = {
    leases: Lease[];
    onEdit: (lease: Lease) => void;
    onDelete: (lease: Lease) => void;
};

function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function estimatedHarvest(startDate: string, targetDays: number) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + targetDays);
    return d.toISOString();
}

export default function LeaseTable({ leases, onEdit, onDelete }: Props) {
    if (leases.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Belum ada siklus produksi.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
            {leases.map((l) => {
                const state = getCycleState(l.id, l.room_id);
                const active = l.status === "active";
                const harvest = l.end_date
                    ? formatDate(l.end_date)
                    : `±${formatDate(estimatedHarvest(l.start_date, state.extra.harvest_target_days ?? 35))}`;

                return (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                            <p className="font-poppins text-sm font-bold text-[#2F2F2F]">
                                <Link href={`/dashboard/kamar/${l.room_id}`} className="hover:text-[#7B1113] hover:underline">
                                    Kandang {l.room_number}
                                </Link>
                                <span className={`ml-2 rounded-full px-2.5 py-0.5 font-inter text-[11px] font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                    {active ? "Berjalan" : "Selesai"}
                                </span>
                            </p>
                            <p className="mt-0.5 font-inter text-xs text-[#999]">
                                {formatDate(l.start_date)} → {harvest}
                                {state.populationStart ? ` · ${state.populationStart.toLocaleString("id-ID")} ekor` : ""}
                                {state.depletionPct != null ? ` · deplesi ${state.depletionPct.toFixed(1)}%` : ""}
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <button title="Edit" onClick={() => onEdit(l)} suppressHydrationWarning className="rounded-xl bg-[#F8F8F8] p-2.5 transition hover:bg-[#EAEAEA]">
                                <Pencil size={15} className="text-[#555]" />
                            </button>
                            <button title="Hapus" onClick={() => onDelete(l)} suppressHydrationWarning className="rounded-xl bg-red-50 p-2.5 transition hover:bg-red-100">
                                <Trash2 size={15} className="text-red-500" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
