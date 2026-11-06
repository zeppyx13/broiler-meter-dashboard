"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { REALTIME_WINDOW_MS, type RealtimeSample } from "./use-kandang-data";

function hhmm(t: number) {
    return new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

type Props = {
    samples: RealtimeSample[];
    expectedPowerKw?: number;
    online: boolean;
};

export default function RealtimeCharts({ samples, expectedPowerKw, online }: Props) {
    const last = samples[samples.length - 1];
    // Jendela maksimal 30 menit yang berakhir di pembacaan terakhir. Selama data belum
    // sampai 30 menit, sumbu dimulai dari pembacaan pertama supaya grafik tetap penuh.
    const end = last?.t ?? 0;
    const start = Math.max(samples[0]?.t ?? 0, end - REALTIME_WINDOW_MS);
    const domain: [number, number] = [start, end];
    const showSeconds = end - start < 5 * 60_000;

    return (
        <SectionCard>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-[#7B1113]" />
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Real-time · 30 menit terakhir</p>
                </div>
                <span className={`flex items-center gap-1.5 font-inter text-xs ${online ? "text-green-700" : "text-[#999]"}`}>
                    <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-green-500" : "bg-[#CCC]"}`} />
                    {online ? "Live" : last ? `Data terakhir ${hhmm(last.t)}` : "Menunggu data"}
                </span>
            </div>

            {samples.length < 2 ? (
                <p className="mt-6 rounded-2xl bg-[#FAFAFA] px-4 py-8 text-center font-inter text-sm text-[#999]">
                    {online ? "Mengumpulkan data… grafik muncul setelah beberapa pembacaan alat." : "Belum ada data dari perangkat dalam 30 menit terakhir."}
                </p>
            ) : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    <MiniChart
                        title="Daya (kW)"
                        current={last ? `${last.powerKw.toFixed(2)} kW` : "—"}
                        data={samples}
                        dataKey="powerKw"
                        color="#B76E00"
                        domain={domain}
                        showSeconds={showSeconds}
                        unit="kW"
                        reference={expectedPowerKw}
                        referenceLabel="seharusnya"
                    />
                    <MiniChart
                        title="Debit air (L/menit)"
                        current={last ? `${last.flowLpm.toFixed(1)} L/menit` : "—"}
                        data={samples}
                        dataKey="flowLpm"
                        color="#2F5BBA"
                        domain={domain}
                        showSeconds={showSeconds}
                        unit="L/menit"
                    />
                </div>
            )}
            <p className="mt-3 font-inter text-[11px] text-[#AAA]">
                Data dikumpulkan browser selama tab ini terbuka (tetap ada saat dimuat ulang, hilang saat tab ditutup).
            </p>
        </SectionCard>
    );
}

function MiniChart({
    title, current, data, dataKey, color, domain, showSeconds, unit, reference, referenceLabel,
}: {
    title: string;
    current: string;
    data: RealtimeSample[];
    dataKey: "powerKw" | "flowLpm";
    color: string;
    domain: [number, number];
    showSeconds: boolean;
    unit: string;
    reference?: number;
    referenceLabel?: string;
}) {
    return (
        <div>
            <div className="flex items-baseline justify-between">
                <p className="font-inter text-xs text-[#999]">{title}</p>
                <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{current}</p>
            </div>
            <div className="mt-2 h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ left: -12, right: 6, top: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                        <XAxis
                            dataKey="t" type="number" domain={domain} tickCount={4} tick={{ fontSize: 10, fill: "#999" }}
                            tickFormatter={(t) => (showSeconds ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : hhmm(t))}
                        />
                        <YAxis
                            width={40} tick={{ fontSize: 10, fill: "#999" }} allowDecimals
                            tickFormatter={(v) => Number(v).toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                            domain={[0, (max: number) => Math.ceil((Math.max(max, reference ?? 0) * 1.15 || 1) * 2) / 2]}
                        />
                        <Tooltip labelFormatter={(t) => hhmm(Number(t))} formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, title]} />
                        {reference != null && (
                            <ReferenceLine y={reference} stroke="#7B1113" strokeDasharray="5 4" label={{ value: referenceLabel, position: "insideTopRight", fontSize: 10, fill: "#7B1113" }} />
                        )}
                        <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
