"use client";

import Swal from "sweetalert2";
import { ClipboardPlus, Pencil, Trash2 } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { recordDate } from "@/lib/broiler-adapters";
import { useCycleReport } from "@/lib/broiler-queries";
import { useBroiler } from "@/components/broiler/broiler-provider";
import type { KandangData } from "./use-kandang-data";
import WaterFeedCard from "./water-feed-card";

type Props = {
    data: KandangData;
    onOpenRecord: (date?: string) => void;
};

function dayNumber(date: string, startDate: string) {
    const diff = new Date(`${date}T00:00:00`).getTime() - new Date(`${startDate.slice(0, 10)}T00:00:00`).getTime();
    // Hari chick-in = hari ke-1 (sama dengan day_age server).
    return Math.floor(diff / 86_400_000) + 1;
}

export default function CatatHarianTab({ data, onOpenRecord }: Props) {
    const { room, activeCycle, cycle, refreshAll, serverCycle, serverRecords, canOperate } = data;
    const { source } = useBroiler();
    const report = useCycleReport(serverCycle?.id, room?.id, source);
    const dailyWater: Record<string, number> = {};
    for (const m of report.data?.series ?? []) {
        if (m.metric_date && m.water_liters != null) dailyWater[m.metric_date.slice(0, 10)] = Number(m.water_liters);
    }

    if (!activeCycle || !cycle) {
        return (
            <SectionCard>
                <p className="font-inter text-sm text-[#777]">Catatan harian tersedia saat ada siklus berjalan.</p>
            </SectionCard>
        );
    }

    const today = data.localDate;
    const recordedToday = cycle.records.some((r) => r.date === today);

    async function handleDelete(date: string) {
        const server = serverRecords.find((r) => recordDate(r) === date);
        if (!server) return;
        const result = await Swal.fire({
            title: "Batalkan catatan ini?",
            text: `${new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} — populasi dikoreksi kembali, jejak audit tetap tersimpan.`,
            input: "textarea",
            inputPlaceholder: "Alasan pembatalan (min. 8 karakter)",
            inputValidator: (v) => (v.trim().length < 8 ? "Isi alasan minimal 8 karakter." : undefined),
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, batalkan",
            cancelButtonText: "Kembali",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;
        try {
            await writeData("delete", `/api/flock-cycles/${serverCycle!.id}/daily-records/${date}`, {
                expected_revision: server.revision,
                note: String(result.value).trim().slice(0, 500),
                request_id: crypto.randomUUID(),
            });
            refreshAll();
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal membatalkan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
                <Stat label="Populasi awal" value={cycle.populationStart ? cycle.populationStart.toLocaleString("id-ID") : "—"} />
                <Stat
                    label="Total deplesi"
                    value={cycle.depletion.toLocaleString("id-ID")}
                    sub={cycle.depletionPct != null ? `${cycle.depletionPct.toFixed(2)}%` : undefined}
                />
                <Stat label="Populasi sekarang" value={cycle.populationNow != null ? cycle.populationNow.toLocaleString("id-ID") : "—"} />
            </div>

            {canOperate && <button
                onClick={() => onOpenRecord(today)}
                suppressHydrationWarning
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-4 font-poppins text-base font-semibold text-[#C6A971] transition hover:opacity-90"
            >
                <ClipboardPlus size={20} />
                {recordedToday ? "Ubah Catatan Hari Ini" : "Catat Hari Ini"}
            </button>}

            {room && <WaterFeedCard records={cycle.records} dailyWater={dailyWater} />}

            <SectionCard className="overflow-hidden p-0!">
                {cycle.records.length === 0 ? (
                    <p className="px-6 py-10 text-center font-inter text-sm text-[#999]">
                        Belum ada catatan. Catat ayam mati dan afkir setiap hari agar populasi dan konsumsi per ekor akurat.
                    </p>
                ) : (
                    <ul className="divide-y divide-[#F0F0F0]">
                        {cycle.records.map((r) => (
                            <li key={r.date} className="flex items-center justify-between gap-3 px-5 py-4">
                                <div className="min-w-0">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })}
                                        <span className="ml-2 font-inter text-xs font-normal text-[#999]">hari ke-{dayNumber(r.date, activeCycle.start_date)}</span>
                                    </p>
                                    <p className="mt-0.5 font-inter text-xs text-[#666]">
                                        Mati {r.dead} · Afkir {r.culled}
                                        {r.avg_weight_g != null && ` · ${r.avg_weight_g} g`}
                                        {r.feed_kg != null && ` · pakan ${r.feed_kg} kg`}
                                    </p>
                                    {r.note && <p className="mt-0.5 truncate font-inter text-xs text-[#999]">{r.note}</p>}
                                </div>
                                {canOperate && <div className="flex shrink-0 gap-2">
                                    <button onClick={() => onOpenRecord(r.date)} title="Ubah" className="rounded-xl bg-[#F8F8F8] p-2.5 transition hover:bg-[#EAEAEA]">
                                        <Pencil size={15} className="text-[#555]" />
                                    </button>
                                    <button onClick={() => handleDelete(r.date)} title="Batalkan catatan" className="rounded-xl bg-red-50 p-2.5 transition hover:bg-red-100">
                                        <Trash2 size={15} className="text-red-500" />
                                    </button>
                                </div>}
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
            <p className="font-inter text-xs text-[#999]">{label}</p>
            <p className="mt-1 font-poppins text-xl font-bold text-[#2F2F2F]">{value}</p>
            {sub && <p className="font-inter text-xs text-[#B42318]">{sub}</p>}
        </div>
    );
}
