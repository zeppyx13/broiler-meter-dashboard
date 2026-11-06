"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassWater } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import type { DailyRecord } from "@/lib/broiler-local-store";
import { WATER_FEED_NORMAL, classifyWaterFeed, waterFeedSeries, type WaterFeedPoint, type WaterFeedStatus } from "@/lib/water-feed";

const STATUS: Record<WaterFeedStatus, { chip: string; label: string; advice: string }> = {
    rendah: {
        chip: "bg-[#FFF4E5] text-[#B76E00]",
        label: "Di bawah normal",
        advice: "Ayam minum lebih sedikit dari biasanya terhadap pakannya. Cek tekanan & sumbatan nipple/tempat minum, lalu amati ayam yang lesu — ini sering tanda awal sakit.",
    },
    normal: {
        chip: "bg-green-50 text-green-700",
        label: "Normal",
        advice: "Perbandingan minum dan makan sesuai acuan. Tetap catat pakan setiap hari agar tren terpantau.",
    },
    tinggi: {
        chip: "bg-[#FFF4E5] text-[#B76E00]",
        label: "Di atas normal",
        advice: "Minum jauh lebih banyak dari pakannya. Kemungkinan cekaman panas, kebocoran pipa/nipple, atau pakan tidak termakan — cek suhu siang hari dan jalur air.",
    },
};

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const num = (v: number, d = 2) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function WaterFeedCard({ records, dailyWater }: { records: DailyRecord[]; dailyWater: Record<string, number> }) {
    const series = waterFeedSeries(records, dailyWater, 14);
    const last = series[series.length - 1];
    const status = last ? classifyWaterFeed(last.ratio) : null;

    return (
        <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <GlassWater size={18} className="mt-0.5 text-[#2F5BBA]" />
                    <div>
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Rasio air : pakan</p>
                        <p className="font-inter text-xs text-[#999]">Liter air per kg pakan · normal {num(WATER_FEED_NORMAL.min, 1)}–{num(WATER_FEED_NORMAL.max, 1)}</p>
                    </div>
                </div>
                {last && status && (
                    <div className="text-right">
                        <p className="font-poppins text-2xl font-bold text-[#2F2F2F]">{num(last.ratio)}</p>
                        <span className={`rounded-full px-2.5 py-0.5 font-inter text-[11px] font-medium ${STATUS[status].chip}`}>{STATUS[status].label} · {fmtDay(last.date)}</span>
                    </div>
                )}
            </div>

            {series.length < 2 ? (
                <p className="mt-4 rounded-2xl bg-[#FAFAFA] px-4 py-6 text-center font-inter text-sm text-[#999]">
                    Isi <span className="font-medium text-[#555]">pakan terpakai (kg)</span> di catatan harian. Rasio dihitung dari pemakaian air harian alat ÷ pakan hari itu.
                </p>
            ) : (
                <>
                    <div className="mt-4 h-44" role="img" aria-label={`Rasio air pakan ${series.length} hari terakhir: ${series.map((p) => `${fmtDay(p.date)} ${num(p.ratio)}`).join(", ")}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={series} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#F0F0F0" />
                                <ReferenceArea y1={WATER_FEED_NORMAL.min} y2={WATER_FEED_NORMAL.max} fill="#16a34a" fillOpacity={0.07} strokeOpacity={0} />
                                <XAxis dataKey="date" tickFormatter={fmtDay} tickLine={false} axisLine={{ stroke: "#E5E5E5" }} tick={{ fontSize: 10, fill: "#888" }} minTickGap={16} />
                                <YAxis width={40} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888" }} domain={[1, 3]} tickFormatter={(v) => num(Number(v), 1)} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        const p = payload?.[0]?.payload as WaterFeedPoint | undefined;
                                        if (!active || !p) return null;
                                        return (
                                            <div className="rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 font-inter text-xs shadow-md">
                                                <p className="font-semibold text-[#2F2F2F]">{fmtDay(p.date)} · rasio {num(p.ratio)}</p>
                                                <p className="text-[#777]">{num(p.waterL, 0)} L air ÷ {num(p.feedKg, 1)} kg pakan</p>
                                            </div>
                                        );
                                    }}
                                />
                                <Line type="monotone" dataKey="ratio" stroke="#2F5BBA" strokeWidth={2} dot={{ r: 3, fill: "#2F5BBA" }} activeDot={{ r: 5 }} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    {status && <p className="mt-2 font-inter text-xs text-[#555]">{STATUS[status].advice}</p>}
                    <p className="mt-1 font-inter text-[11px] text-[#AAA]">Pita hijau = rentang normal (acuan: Williams et al., 2013; Aviagen, 2018). Air harian dari meter alat, pakan dari catatan harian.</p>
                </>
            )}
        </SectionCard>
    );
}
