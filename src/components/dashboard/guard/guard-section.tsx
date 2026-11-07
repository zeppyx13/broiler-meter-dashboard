"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import SectionCard from "../section-card";
import { useGuard } from "./guard-monitor";
import { ALERT_TIER_STYLE } from "@/components/peringatan/peringatan-section";

export default function GuardSection() {
    const { ready, error, active } = useGuard();
    const shown = active.slice(0, 5);

    return (
        <SectionCard>
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Peringatan aktif</h3>
                <Link href="/dashboard/peringatan" className="shrink-0 font-inter text-sm font-semibold text-[#7B1113] hover:underline">
                    Lihat semua
                </Link>
            </div>

            <div className="mt-4 space-y-3">
                {error ? (
                    <p className="rounded-2xl bg-red-50 p-4 font-inter text-sm text-red-700">
                        Data peringatan gagal dimuat.
                    </p>
                ) : !ready ? (
                    <div className="h-16 animate-pulse rounded-2xl bg-[#F8F8F8]" />
                ) : shown.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-4">
                        <ShieldCheck size={16} className="text-green-600" />
                        <p className="font-inter text-sm text-[#777]">Tidak ada peringatan.</p>
                    </div>
                ) : (
                    shown.map((a) => (
                        <Link
                            key={a.key}
                            href={`/dashboard/kamar/${a.roomId}`}
                            className={`flex items-center justify-between gap-3 rounded-xl border-l-4 p-3 transition hover:opacity-90 ${ALERT_TIER_STYLE[a.tier].box}`}
                        >
                            <div className="min-w-0">
                                <p className="font-inter text-[11px] font-bold text-[#555]">
                                    {ALERT_TIER_STYLE[a.tier].label.toUpperCase()} · Kandang {a.roomNumber}
                                </p>
                                <p className="mt-0.5 font-inter text-sm font-semibold text-[#2F2F2F]">{a.title}</p>
                                <p className="mt-0.5 font-inter text-xs text-[#555]">{a.action}</p>
                            </div>
                            <ChevronRight size={16} className="shrink-0 text-[#999]" />
                        </Link>
                    ))
                )}
                {active.length > shown.length && (
                    <p className="font-inter text-xs text-[#999]">+{active.length - shown.length} peringatan lain</p>
                )}
            </div>
        </SectionCard>
    );
}
