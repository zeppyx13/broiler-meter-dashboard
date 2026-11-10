"use client";

import { useMemo, useState } from "react";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import Link from "next/link";
import {
    ComposedChart, Line, ReferenceDot, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
    Droplets, Zap, Wallet, TrendingUp, AlertCircle, ChevronRight, MessageSquare,
} from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { askCopilot, KANDANG_QUESTIONS } from "@/lib/copilot-context";
import { expectedWaterRangeLPerDay, formatRupiah, type DeviationTier } from "@/lib/broiler-reference";
import { ALERT_TIER_STYLE } from "@/components/peringatan/peringatan-section";
import type { KandangData } from "./use-kandang-data";
import RealtimeCharts from "./realtime-charts";

const TONE_TEXT: Record<DeviationTier, string> = {
    kritis: "text-red-600",
    waspada: "text-amber-600",
    normal: "text-[#999]",
};

type Props = {
    data: KandangData;
    onEditCycle: () => void;
    onOpenEquipment: () => void;
};

export default function KandangRingkasan({ data, onEditCycle, onOpenEquipment }: Props) {
    const { live, activeCycle, cycle, expectedPowerKw, ageDays, harvestTargetDays, daysToHarvest, todayUsage, cycleUsage, insights } = data;
    const populationNow = cycle?.populationNow;
    const [ecoError, setEcoError] = useState<string | null>(null);
    const [ecoPending, setEcoPending] = useState<number | null>(null);
    async function setRecommendation(id: number, status: string) {
        if (ecoPending != null) return;
        setEcoPending(id); setEcoError(null);
        try { await writeData("patch", `/api/eco-recommendations/${id}/status`, { status }); data.refreshAll(); }
        catch (error) { setEcoError(apiErrorMessage(error)); }
        finally { setEcoPending(null); }
    }

    const checklist = [
        activeCycle && !cycle?.populationStart && {
            text: "Populasi awal siklus belum diisi. per-ekor dan Guard air belum bisa dihitung.",
            action: <button onClick={onEditCycle} className="font-semibold text-[#7B1113] hover:underline">Isi sekarang</button>,
        },
        !expectedPowerKw && {
            text: "Isi daftar peralatan dulu.",
            action: <button onClick={onOpenEquipment} className="font-semibold text-[#7B1113] hover:underline">Isi peralatan</button>,
        },
        !live && {
            text: "Perangkat IoT kandang ini belum mengirim data.",
            action: <Link href="/dashboard/iot" className="font-semibold text-[#7B1113] hover:underline">Buka Alat IoT</Link>,
        },
    ].filter(Boolean) as { text: string; action: React.ReactNode }[];

    // Baseline siklus dibuat setelah chick-in (mis. siklus lama) → beri tahu sejak kapan dihitung.
    const cycleSinceNote = cycleUsage && activeCycle
        && cycleUsage.since.getTime() - new Date(activeCycle.start_date).getTime() > 36 * 3_600_000
        ? `sejak ${cycleUsage.since.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`
        : null;

    // ── Chart ──
    const chartMaxDay = Math.max(harvestTargetDays, (ageDays ?? 0) + 3, 14);
    const chartData = useMemo(() => {
        const step = Math.max(1, Math.round(chartMaxDay / 20));
        const points = [];
        for (let d = 1; d <= chartMaxDay; d += step) {
            const r = expectedWaterRangeLPerDay(d);
            points.push({ day: d, low: +r.low.toFixed(3), mid: +r.mid.toFixed(3), high: +r.high.toFixed(3) });
        }
        return points;
    }, [chartMaxDay]);

    const waterTone = insights.waterDeviation?.tier ?? "normal";
    const powerTone = insights.powerDeviation?.tier ?? "normal";

    return (
        <div className="space-y-5">
            {checklist.length > 0 && (
                <div className="rounded-3xl border border-[#F3E2C0] bg-[#FFFAF0] p-5">
                    <p className="flex items-center gap-2 font-poppins text-sm font-semibold text-[#9A6B14]">
                        <AlertCircle size={16} /> Lengkapi data kandang
                    </p>
                    <ul className="mt-3 space-y-2">
                        {checklist.map((item) => (
                            <li key={item.text} className="flex flex-col gap-1 font-inter text-sm text-[#555] sm:flex-row sm:items-center sm:justify-between">
                                <span>{item.text}</span>
                                <span className="shrink-0 font-inter text-sm">{item.action}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* KPI */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi icon={<Droplets size={14} className="text-blue-500" />} label="Air inlet hari ini"
                    value={todayUsage.waterTodayLiter != null ? `${todayUsage.waterTodayLiter.toFixed(0)} L` : "—"}
                    tone={waterTone}
                    sub={todayUsage.waterTodayLiter == null
                        ? "Menunggu data perangkat"
                        : insights.waterPerBirdSoFar == null
                            ? "Isi populasi untuk per-ekor"
                            : insights.waterDeviation
                                ? `${insights.waterPerBirdSoFar.toFixed(3)} L/ekor · ${insights.waterDeviation.pct >= 0 ? "+" : ""}${insights.waterDeviation.pct.toFixed(0)}% dari pola normal`
                                : `${insights.waterPerBirdSoFar.toFixed(3)} L/ekor`}
                />
                <Kpi icon={<Zap size={14} className="text-amber-500" />} label="Daya saat ini"
                    value={live && insights.actualPowerKw != null ? `${insights.actualPowerKw.toFixed(2)} kW` : "—"}
                    tone={powerTone}
                    sub={expectedPowerKw ? `Seharusnya ${expectedPowerKw.toFixed(2)} kW` : "Peralatan belum diisi"}
                />
                <Kpi icon={<TrendingUp size={14} className="text-[#7B1113]" />} label="Energi siklus berjalan"
                    value={cycleUsage?.energyKwh != null ? `${cycleUsage.energyKwh.toFixed(1)} kWh` : "—"}
                    sub={!activeCycle
                        ? "Mulai siklus untuk menghitung"
                        : !cycleUsage
                            ? "Menunggu data perangkat"
                            : [
                                insights.cycleEnergyCost != null && `≈ ${formatRupiah(insights.cycleEnergyCost)}`,
                                populationNow && cycleUsage.energyKwh != null && `${((cycleUsage.energyKwh * 1000) / populationNow).toFixed(0)} Wh/ekor`,
                                cycleSinceNote,
                            ].filter(Boolean).join(" · ")}
                />
                <Kpi icon={<Wallet size={14} className="text-green-600" />} label={`Prediksi s.d. panen (hari ${harvestTargetDays})`}
                    value={insights.predictedEnergyKwh != null ? `${insights.predictedEnergyKwh.toFixed(0)} kWh` : "—"}
                    sub={!activeCycle
                        ? "Mulai siklus untuk memprediksi"
                        : insights.predictedEnergyKwh == null
                            ? `Forecast server: ${data.forecastState}; minimal 3 tanggal selesai`
                            : [
                                insights.predictedCost != null && `≈ ${formatRupiah(insights.predictedCost)}`,
                                insights.predictedWaterM3 != null && `air ±${insights.predictedWaterM3.toFixed(1)} m³`,
                            ].filter(Boolean).join(" · ")}
                />
            </div>

            <RealtimeCharts samples={data.samples} expectedPowerKw={expectedPowerKw} online={data.online} />

            {/* Chart + Peringatan */}
            <div className="grid gap-6 xl:grid-cols-3">
                <SectionCard className="xl:col-span-2">
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Air per ekor per hari</p>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        Putus-putus: pola normal · titik merah: hari ini
                    </p>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#999" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#999" }} />
                                <Tooltip formatter={(v) => `${v} L/ekor`} labelFormatter={(d) => `Hari ke-${d}`} />
                                <Line type="monotone" dataKey="low" stroke="#E8CFCF" strokeWidth={1} dot={false} name="Batas bawah wajar" />
                                <Line type="monotone" dataKey="mid" stroke="#7B1113" strokeDasharray="5 4" strokeWidth={2} dot={false} name="Pola normal" />
                                <Line type="monotone" dataKey="high" stroke="#E8CFCF" strokeWidth={1} dot={false} name="Batas atas wajar" />
                                {ageDays != null && insights.waterPerBirdPace != null && (
                                    <ReferenceDot x={ageDays} y={+insights.waterPerBirdPace.toFixed(3)} r={6} fill="#B42318" stroke="white" strokeWidth={2} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-center font-inter text-[11px] text-[#AAA]">hari umur · L/ekor/hari</p>
                </SectionCard>

                <SectionCard>
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Peringatan</p>
                    <div className="mt-4 space-y-3">
                        {!activeCycle ? (
                            <p className="font-inter text-sm text-[#999]">Belum ada siklus berjalan.</p>
                        ) : insights.alerts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-4 text-center">
                                <p className="font-inter text-sm text-[#777]">Tidak ada peringatan.</p>
                            </div>
                        ) : (
                            insights.alerts.map((a) => (
                                <div key={a.id} className={`rounded-xl border-l-4 p-3 text-[#2F2F2F] ${ALERT_TIER_STYLE[a.tier].box}`}>
                                    <p className="font-inter text-[11px] font-bold text-[#555]">{ALERT_TIER_STYLE[a.tier].label.toUpperCase()}</p>
                                    <p className="mt-0.5 font-inter text-sm font-semibold">{a.title}</p>
                                    <p className="mt-0.5 font-inter text-xs text-[#555]">{a.detail}</p>
                                    <p className="mt-1.5 flex items-start gap-1 font-inter text-xs font-medium">
                                        <ChevronRight size={14} className="mt-px shrink-0" /> {a.action}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </SectionCard>
            </div>

            {/* Forecast + Eco-Advisor */}
            <div className="grid gap-6 xl:grid-cols-2">
                <SectionCard>
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Perkiraan sampai panen</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniStat label="Sisa hari ke panen" value={daysToHarvest != null ? `${daysToHarvest} hari` : "—"} />
                        <MiniStat label="Estimasi biaya energi" value={insights.predictedCost != null ? formatRupiah(insights.predictedCost) : "—"} />
                    </div>
                </SectionCard>

                <SectionCard>
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Saran hemat</p>
                    <div className="mt-4 space-y-2.5">
                        {data.ecoRecommendations.map((r) => <EcoTip key={r.id} title={r.status === "new" ? r.title : `${r.title} · ${r.status === "accepted" ? "diterima" : r.status === "dismissed" ? "diabaikan" : r.status}`} detail={`${r.description ?? r.recommendation_text ?? r.message ?? ""}${r.estimated_savings_idr != null ? ` · hemat ±${formatRupiah(r.estimated_savings_idr)}` : ""}`} action={<>{data.canOperate && data.canInsights && r.status === "new" && <span className="flex gap-3">{["accepted", "dismissed"].map((status) => <button key={status} disabled={ecoPending != null} onClick={() => setRecommendation(r.id, status)} className="font-inter text-xs text-[#7B1113] underline">{status === "accepted" ? "Terima saran" : "Abaikan"}</button>)}</span>}</>} />)}
                        {!data.ecoRecommendations.length && <p className="font-inter text-xs text-[#999]">{!data.canInsights ? "Akses insight belum diberikan untuk kandang ini." : data.ecoError ? "Saran gagal dimuat." : "Belum ada saran."}</p>}
                        {ecoError && <p role="alert" className="font-inter text-xs text-red-600">{ecoError}</p>}
                    </div>
                </SectionCard>
            </div>

            {/* Copilot — pintasan ke chat Copilot (pojok kanan bawah), yang otomatis fokus ke kandang ini. */}
            {data.canInsights && <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Tanya Copilot</p>
                    <button
                        onClick={() => askCopilot()}
                        suppressHydrationWarning
                        className="flex items-center gap-1.5 rounded-2xl bg-[#7B1113] px-4 py-2.5 font-inter text-sm font-medium text-white transition hover:opacity-90"
                    >
                        <MessageSquare size={15} /> Buka chat
                    </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {KANDANG_QUESTIONS.map((q) => (
                        <button
                            key={q}
                            onClick={() => askCopilot(q)}
                            suppressHydrationWarning
                            className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2 font-inter text-xs font-medium text-[#555] transition hover:border-[#7B1113]/30 hover:text-[#7B1113]"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </SectionCard>}
        </div>
    );
}

function Kpi({ icon, label, value, sub, tone = "normal" }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: DeviationTier }) {
    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
            <div className="flex items-center gap-2 font-inter text-xs text-[#999]">{icon} {label}</div>
            <p className="mt-2 font-poppins text-2xl font-bold text-[#2F2F2F]">{value}</p>
            <p className={`mt-1 font-inter text-xs ${TONE_TEXT[tone]}`}>{sub}</p>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-[#FAFAFA] p-3">
            <p className="font-inter text-xs text-[#999]">{label}</p>
            <p className="mt-1 font-poppins text-lg font-bold text-[#2F2F2F]">{value}</p>
        </div>
    );
}

function EcoTip({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-3.5">
            <div>
                <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{title}</p>
                <p className="mt-0.5 font-inter text-xs text-[#666]">{detail}</p>
                {action}
            </div>
        </div>
    );
}
