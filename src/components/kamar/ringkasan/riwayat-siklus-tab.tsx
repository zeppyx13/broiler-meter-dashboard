"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, History, Printer, Trophy, TrendingDown } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { readData } from "@/lib/broiler-api";
import { cycleToLease } from "@/lib/broiler-adapters";
import { useCycles, type CycleReport } from "@/lib/broiler-queries";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { formatRupiah } from "@/lib/broiler-reference";
import { rankMetric, summarizeServerCycle, type BestWorst, type CycleSummary } from "@/lib/cycle-history";
import type { KandangData } from "./use-kandang-data";

const num = (v: number, digits = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

type Metric = {
    key: string;
    label: string;
    pick: (r: CycleSummary) => number | null | undefined;
    format: (v: number) => string;
    higherIsBetter: boolean;
};

const METRICS: Metric[] = [
    { key: "ip", label: "Indeks Performa", pick: (r) => r.ip, format: (v) => num(v), higherIsBetter: true },
    { key: "fcr", label: "FCR", pick: (r) => r.fcr, format: (v) => num(v, 2), higherIsBetter: false },
    { key: "dep", label: "Deplesi", pick: (r) => r.depletionPct, format: (v) => `${num(v, 1)}%`, higherIsBetter: false },
    { key: "water", label: "Air / ekor", pick: (r) => r.waterPerBirdL, format: (v) => `${num(v, 1)} L`, higherIsBetter: false },
    { key: "kwh", label: "Listrik / ekor", pick: (r) => r.kwhPerBird, format: (v) => `${num(v, 3)} kWh`, higherIsBetter: false },
    { key: "cost", label: "Biaya energi / ekor", pick: (r) => r.energyCostPerBird, format: (v) => formatRupiah(v), higherIsBetter: false },
];

export default function RiwayatSiklusTab({ data }: { data: KandangData }) {
    const { room, serverRecords } = data;
    const b = useBroiler();
    const [openId, setOpenId] = useState<number | null>(null);
    const [printedAt, setPrintedAt] = useState("");

    const cyclesQuery = useCycles(room?.id, 50);
    const { isLoading, isError } = cyclesQuery;
    const cycles = useMemo(
        () => (cyclesQuery.data?.cycles ?? []).filter((c) => c.status === "active" || c.status === "completed"),
        [cyclesQuery.data],
    );
    const reports = useQueries({
        queries: cycles.map((c) => ({
            queryKey: ["broiler", b.user?.id, room?.id, "cycle-report", c.id],
            queryFn: () => readData<CycleReport>(`/api/flock-cycles/${c.id}/report`, { source: b.source }),
            staleTime: 60_000,
        })),
    });
    const reportKey = reports.map((r) => r.dataUpdatedAt).join(",");

    const rows = useMemo(() => {
        const today = data.localDate;
        return cycles
            .map((c, i) => summarizeServerCycle(c, cycleToLease(c), reports[i]?.data, c.status === "active" ? serverRecords.length : 0, today))
            .sort((a, b) => b.startDate.localeCompare(a.startDate));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cycles, reportKey, serverRecords.length, data.localDate]);

    // Peringkat hanya antar siklus yang sudah selesai — siklus berjalan belum lengkap.
    const ranks = useMemo(() => {
        const finished = rows.filter((r) => !r.running);
        return Object.fromEntries(METRICS.map((m) => [m.key, rankMetric(finished, m.pick, m.higherIsBetter)])) as Record<string, BestWorst>;
    }, [rows]);

    const cycleNumber = (r: CycleSummary) => rows.length - rows.indexOf(r);

    if (isLoading) return <div className="h-48 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />;
    if (isError) {
        return <SectionCard><p className="font-inter text-sm text-red-600">Gagal memuat riwayat siklus.</p></SectionCard>;
    }
    if (rows.length === 0) {
        return (
            <SectionCard>
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <History size={28} className="text-[#C6A971]" />
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">Belum ada riwayat siklus</p>
                    <p className="max-w-sm font-inter text-xs text-[#999]">
                        Belum ada siklus yang selesai.
                    </p>
                </div>
            </SectionCard>
        );
    }

    return (
        <div className="space-y-4">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #riwayat-print, #riwayat-print * { visibility: visible; }
                    #riwayat-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; display: block !important; }
                }
            `}</style>

            <SectionCard className="p-5!">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Riwayat siklus</p>
                        <p className="font-inter text-xs text-[#999]">
                            {rows.filter((r) => !r.running).length} siklus selesai
                            {rows.some((r) => r.running) ? " · 1 berjalan" : ""}. Tanda <Trophy size={11} className="inline text-green-600" /> terbaik dan{" "}
                            <TrendingDown size={11} className="inline text-red-600" /> terburuk antar siklus selesai.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setPrintedAt(`${new Date().toLocaleString("id-ID", { timeZone: data.timezone })} · zona ${data.timezone}`);
                            setTimeout(() => window.print(), 0);
                        }}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-2.5 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                    >
                        <Printer size={15} /> Cetak perbandingan
                    </button>
                </div>
            </SectionCard>

            <ul className="space-y-3">
                {rows.map((r) => {
                    const open = openId === r.lease.id;
                    return (
                        <li key={r.lease.id} className="overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
                            <button
                                onClick={() => setOpenId(open ? null : r.lease.id)}
                                aria-expanded={open}
                                suppressHydrationWarning
                                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#FAFAFA]"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                        Siklus #{cycleNumber(r)}
                                        {r.running && <span className="rounded-full bg-green-50 px-2 py-0.5 font-inter text-[11px] font-medium text-green-700">Berjalan</span>}
                                    </p>
                                    <p className="mt-0.5 font-inter text-xs text-[#999]">
                                        {fmtDate(r.startDate)} – {r.endDate ? fmtDate(r.endDate) : "sekarang"} · {r.durationDays} hari
                                        {r.birds != null && ` · ${num(r.birds)} ekor${r.running ? "" : " dipanen"}`}
                                    </p>
                                </div>
                                <div className="hidden text-right sm:block">
                                    <p className="font-inter text-[11px] text-[#999]">IP</p>
                                    <p className="font-poppins text-base font-bold text-[#7B1113]">{r.ip != null ? num(r.ip) : "—"}</p>
                                </div>
                                <ChevronDown size={18} className={`shrink-0 text-[#999] transition ${open ? "rotate-180" : ""}`} />
                            </button>

                            {open && (
                                <div className="border-t border-[#F0F0F0] px-5 py-4">
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {METRICS.map((m) => {
                                            const v = m.pick(r);
                                            const rank = ranks[m.key];
                                            const isBest = rank?.best === r.lease.id;
                                            const isWorst = rank?.worst === r.lease.id;
                                            return (
                                                <div key={m.key} className={`rounded-2xl px-3 py-2.5 ${isBest ? "bg-green-50" : isWorst ? "bg-red-50" : "bg-[#FAFAFA]"}`}>
                                                    <p className="flex items-center gap-1 font-inter text-[11px] text-[#777]">
                                                        {m.label}
                                                        {isBest && <Trophy size={11} className="text-green-600" aria-label="terbaik" />}
                                                        {isWorst && <TrendingDown size={11} className="text-red-600" aria-label="terburuk" />}
                                                    </p>
                                                    <p className="mt-0.5 font-poppins text-sm font-semibold text-[#2F2F2F]">{v != null ? m.format(v) : "—"}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-3 font-inter text-xs text-[#999]">
                                        {[
                                            r.populationStart != null && `Populasi awal ${num(r.populationStart)} ekor`,
                                            r.feedKg != null && `pakan ${num(r.feedKg)} kg`,
                                            r.lastWeightG != null && `bobot terakhir ${num(r.lastWeightG)} g`,
                                            r.waterLiter != null && `air ${num(r.waterLiter)} L`,
                                            r.energyKwh != null && `listrik ${num(r.energyKwh, 1)} kWh`,
                                            r.waterLiter != null && r.feedKg && `rasio air:pakan ${num(r.waterLiter / r.feedKg, 2)}`,
                                            r.recordCount > 0 && `${r.recordCount} catatan harian`,
                                        ].filter(Boolean).join(" · ")}
                                    </p>
                                    {(r.fcr == null || r.ip == null) && (
                                        <p className="mt-2 font-inter text-xs text-[#9A6B14]">
                                            FCR dan IP perlu data pakan dan bobot di Catat Harian.
                                        </p>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {/* Versi cetak: tabel perbandingan semua siklus. */}
            <div id="riwayat-print" className="hidden">
                <h1 style={{ fontSize: 18, fontWeight: 700 }}>Perbandingan Siklus · Kandang {room?.number}</h1>
                <p style={{ fontSize: 11, color: "#777", marginBottom: 12 }}>Dicetak {printedAt}</p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                        <tr>
                            {["Siklus", "Periode", "Hari", "Ekor", ...METRICS.map((m) => m.label)].map((h) => (
                                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #999", padding: "4px 6px" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.lease.id}>
                                <td style={{ padding: "4px 6px" }}>#{cycleNumber(r)}{r.running ? " (berjalan)" : ""}</td>
                                <td style={{ padding: "4px 6px" }}>{fmtDate(r.startDate)} – {r.endDate ? fmtDate(r.endDate) : "sekarang"}</td>
                                <td style={{ padding: "4px 6px" }}>{r.durationDays}</td>
                                <td style={{ padding: "4px 6px" }}>{r.birds != null ? num(r.birds) : "—"}</td>
                                {METRICS.map((m) => {
                                    const v = m.pick(r);
                                    return <td key={m.key} style={{ padding: "4px 6px" }}>{v != null ? m.format(v) : "—"}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
