"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Cycle } from "@/lib/broiler-api";

export type CycleRow = { cycle: Cycle; coopCode: string; farmName?: string };

function formatDate(date: string | null | undefined) {
    if (!date) return "—";
    return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeaseTable({ rows }: { rows: CycleRow[] }) {
    if (rows.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Belum ada siklus produksi.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
            {rows.map(({ cycle: c, coopCode, farmName }) => {
                const active = c.status === "active";
                const harvest = c.actual_harvest_date ? formatDate(c.actual_harvest_date) : c.planned_harvest_date ? `±${formatDate(c.planned_harvest_date)}` : "—";
                const depletion = c.initial_population && active ? ((c.initial_population - c.current_population) / c.initial_population) * 100 : null;

                return (
                    <Link key={c.id} href={`/dashboard/kamar/${c.coop_id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#FAFAFA]">
                        <div className="min-w-0">
                            <p className="font-poppins text-sm font-bold text-[#2F2F2F]">
                                Kandang {coopCode}
                                {farmName && <span className="font-inter text-xs font-normal text-[#999]"> · {farmName}</span>}
                                <span className={`ml-2 rounded-full px-2.5 py-0.5 font-inter text-[11px] font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                    {active ? `Berjalan · hari ke-${c.day_age}` : "Selesai"}
                                </span>
                            </p>
                            <p className="mt-0.5 font-inter text-xs text-[#999]">
                                {c.cycle_code} · {formatDate(c.placement_date)} → {harvest}
                                {` · ${c.initial_population.toLocaleString("id-ID")} ekor`}
                                {depletion != null ? ` · deplesi ${Math.max(0, depletion).toFixed(1)}%` : ""}
                            </p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-[#CCC]" />
                    </Link>
                );
            })}
        </div>
    );
}
