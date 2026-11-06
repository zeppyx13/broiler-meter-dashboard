"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { localDateKey } from "@/lib/broiler-local-store";
import { formatRupiah } from "@/lib/broiler-reference";
import type { MonthlyEfficiency } from "@/lib/cycle-history";
import { readData, type DailyMetric } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";

type MonthRow = DailyMetric & { month: string; water_bird_days?: number; energy_bird_days?: number; electricity_cost_idr?: number | null };

type MetricKey = "energyCost" | "whPerBirdDay" | "literPerBirdDay";

const METRICS: Record<MetricKey, { tab: string; title: string; format: (v: number) => string; axis: (v: number) => string }> = {
    energyCost: {
        tab: "Biaya listrik",
        title: "Biaya listrik per bulan",
        format: (v) => formatRupiah(v),
        axis: (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1000 ? `${Math.round(v / 1000)} rb` : String(Math.round(v))),
    },
    whPerBirdDay: {
        tab: "Listrik / ekor",
        title: "Listrik per ekor per hari",
        format: (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Wh`,
        axis: (v) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 }),
    },
    literPerBirdDay: {
        tab: "Air / ekor",
        title: "Air minum per ekor per hari",
        format: (v) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 3 })} L`,
        axis: (v) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 }),
    },
};

type Props = {
    /** Kandang yang dijumlahkan (lahan terpilih di Beranda). */
    coopIds: number[];
};

const MONTHS = 6;

/** Gabungkan seri bulanan server semua kandang; per ekor memakai penyebut bird-days dari server. */
function combineMonths(rows: MonthRow[][], today: string): MonthlyEfficiency[] {
    const [ty, tm] = today.split("-").map(Number);
    const out: MonthlyEfficiency[] = [];
    for (let i = MONTHS - 1; i >= 0; i--) {
        const d = new Date(ty, tm - 1 - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        let energy = 0, water = 0, cost = 0, energyBirdDays = 0, waterBirdDays = 0, cycles = 0;
        for (const series of rows) {
            const m = series.find((r) => r.month === key);
            if (!m) continue;
            cycles++;
            if (m.energy_kwh != null) { energy += Number(m.energy_kwh); energyBirdDays += Number(m.energy_bird_days ?? 0); }
            if (m.water_liters != null) { water += Number(m.water_liters); waterBirdDays += Number(m.water_bird_days ?? 0); }
            if (m.electricity_cost_idr != null) cost += Number(m.electricity_cost_idr);
        }
        out.push({
            month: key,
            label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
            energyKwh: energy,
            waterLiter: water,
            energyCost: cost,
            whPerBirdDay: energyBirdDays > 0 ? (energy * 1000) / energyBirdDays : null,
            literPerBirdDay: waterBirdDays > 0 ? water / waterBirdDays : null,
            cycles,
        });
    }
    return out;
}

/** Grafik efisiensi umum per bulan (semua kandang) untuk Beranda. */
export default function MonthlyEfficiencyChart({ coopIds }: Props) {
    const [metric, setMetric] = useState<MetricKey>("energyCost");
    const b = useBroiler();
    const monthly = useQueries({
        queries: coopIds.map((id) => ({
            queryKey: ["broiler", b.user?.id, id, "monthly", b.source],
            queryFn: () => readData<{ series: MonthRow[] }>(`/api/coops/${id}/reports/monthly`, { source: b.source }),
            enabled: Boolean(b.user),
            staleTime: 5 * 60_000,
        })),
    });

    const { data, daysElapsed } = useMemo(() => {
        const today = localDateKey();
        return { data: combineMonths(monthly.map((q) => q.data?.series ?? []), today), daysElapsed: Number(today.slice(8, 10)) };
    }, [monthly]);

    const spec = METRICS[metric];
    const values = data.map((d) => d[metric]);
    const hasData = values.some((v) => v != null && v > 0);

    // Bulan ini vs bulan lalu (yang ada datanya). Biaya dibandingkan per hari,
    // karena bulan berjalan baru berisi beberapa hari.
    const current = data[data.length - 1];
    const previous = [...data.slice(0, -1)].reverse().find((d) => d[metric] != null && d[metric]! > 0);
    const currentValue = current?.[metric];
    const perDay = (d: MonthlyEfficiency, days: number) => (d[metric] ?? 0) / Math.max(1, days);
    const daysInMonth = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
    const changePct = currentValue != null && previous?.[metric]
        ? metric === "energyCost"
            ? ((perDay(current, daysElapsed) - perDay(previous, daysInMonth(previous.month))) / perDay(previous, daysInMonth(previous.month))) * 100
            : ((currentValue - previous[metric]!) / previous[metric]!) * 100
        : null;

    return (
        <section className="rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6" aria-labelledby="monthly-eff-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <BarChart3 size={20} className="mt-0.5 shrink-0 text-[#7B1113]" />
                    <div>
                        <h3 id="monthly-eff-title" className="font-poppins text-base font-semibold text-[#2F2F2F]">Efisiensi bulanan</h3>
                        <p className="font-inter text-xs text-[#999]">Semua kandang · 6 bulan terakhir</p>
                    </div>
                </div>
                <div role="tablist" aria-label="Pilih ukuran" className="flex rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-1">
                    {(Object.keys(METRICS) as MetricKey[]).map((key) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={metric === key}
                            onClick={() => setMetric(key)}
                            suppressHydrationWarning
                            className={`rounded-xl px-3 py-1.5 font-inter text-xs font-medium transition ${metric === key ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-white"}`}
                        >
                            {METRICS[key].tab}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <p className="mt-5 rounded-2xl bg-[#FAFAFA] px-4 py-10 text-center font-inter text-sm text-[#999]">
                    Belum ada data konsumsi. Grafik terisi setelah siklus berjalan dan alat mencatat angka meter.
                </p>
            ) : (
                <>
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="font-poppins text-2xl font-bold text-[#2F2F2F]">{currentValue != null ? spec.format(currentValue) : "—"}</p>
                        <p className="font-inter text-xs text-[#777]">
                            {spec.title} · {current?.label}{metric === "energyCost" && ` (${daysElapsed} hari berjalan)`}
                        </p>
                        {changePct != null && Math.abs(changePct) >= 1 && (
                            <span className={`flex items-center gap-1 font-inter text-xs font-medium ${changePct < 0 ? "text-green-700" : "text-[#B42318]"}`}>
                                {changePct < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                                {changePct > 0 ? "+" : ""}{changePct.toFixed(0)}%{metric === "energyCost" ? " per hari" : ""} dari {previous?.label}
                            </span>
                        )}
                    </div>

                    <div className="mt-4 h-56" role="img" aria-label={`${spec.title}: ${data.map((d) => `${d.label} ${d[metric] != null ? spec.format(d[metric]!) : "tidak ada data"}`).join(", ")}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
                                <CartesianGrid vertical={false} stroke="#F0F0F0" />
                                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#E5E5E5" }} tick={{ fontSize: 11, fill: "#888" }} />
                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888" }} tickFormatter={spec.axis} width={48} />
                                <Tooltip
                                    cursor={{ fill: "rgba(123,17,19,0.06)" }}
                                    content={({ active, payload }) => {
                                        const row = payload?.[0]?.payload as MonthlyEfficiency | undefined;
                                        if (!active || !row) return null;
                                        return (
                                            <div className="rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 font-inter text-xs shadow-md">
                                                <p className="font-semibold text-[#2F2F2F]">{row.label}</p>
                                                <p className="text-[#555]">{row[metric] != null ? spec.format(row[metric]!) : "Tidak ada data"}</p>
                                                <p className="mt-1 text-[#999]">
                                                    {row.energyKwh.toLocaleString("id-ID", { maximumFractionDigits: 0 })} kWh · {row.waterLiter.toLocaleString("id-ID", { maximumFractionDigits: 0 })} L · {row.cycles} siklus
                                                </p>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar dataKey={metric} fill="#7B1113" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <p className="mt-2 font-inter text-[11px] text-[#AAA]">
                        Estimasi: konsumsi tiap siklus (selisih angka meter) dibagi rata per hari siklus. Per ekor = dibagi populasi rata-rata.
                    </p>
                </>
            )}
        </section>
    );
}
