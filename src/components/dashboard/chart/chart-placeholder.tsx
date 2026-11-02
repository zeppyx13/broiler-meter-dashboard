"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Droplets, Zap } from "lucide-react";
import SectionCard from "../section-card";
import { getDashboardChart } from "@/lib/dashboard-api";
import type { ChartDataPoint } from "@/types/dashboard-api";

type Mode = "water" | "elec";

function formatMonth(yyyymm: string): string {
    const [y, m] = yyyymm.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleString("id-ID", {
        month: "short",
    });
}

export default function UsageChart() {
    const [mode, setMode] = useState<Mode>("water");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["dashboard-chart"],
        queryFn: () => getDashboardChart(8),
        refetchInterval: 5 * 60 * 1000,
        staleTime: 4 * 60 * 1000,
    });

    const chart: ChartDataPoint[] = data?.data?.chart ?? [];

    const values = chart.map((d) =>
        mode === "water" ? d.water_used : d.elec_used
    );
    const max = Math.max(...values, 1);
    const BAR_MAX_PX = 160;

    return (
        <SectionCard className="xl:col-span-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-inter text-sm text-[#666]">Statistik Penggunaan</p>
                    <h3 className="mt-1 font-poppins text-xl font-semibold text-[#2F2F2F]">
                        Air & Listrik Bulanan
                    </h3>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-[#F8F8F8] px-3 py-2">
                    <TrendingUp size={16} className="text-[#7B1113]" />
                    <span className="font-inter text-sm text-[#666]">Bulan ini</span>
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => setMode("water")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-inter text-xs transition-colors ${mode === "water"
                        ? "bg-[#7B1113] text-white"
                        : "bg-[#F0F0F0] text-[#666] hover:bg-[#E5E5E5]"
                        }`}
                >
                    <Droplets size={12} />
                    Air (m³)
                </button>
                <button
                    onClick={() => setMode("elec")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-inter text-xs transition-colors ${mode === "elec"
                        ? "bg-[#7B1113] text-white"
                        : "bg-[#F0F0F0] text-[#666] hover:bg-[#E5E5E5]"
                        }`}
                >
                    <Zap size={12} />
                    Listrik (kWh)
                </button>
            </div>

            <div className="mt-4 flex h-56 items-end gap-3 rounded-3xl bg-[#FAFAFA] p-6">
                {isLoading &&
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-3">
                            <div
                                className="w-full animate-pulse rounded-t-2xl bg-[#E5E5E5]"
                                style={{ height: "80px" }}
                            />
                            <span className="h-3 w-6 animate-pulse rounded bg-[#E5E5E5]" />
                        </div>
                    ))}

                {isError && (
                    <p className="w-full text-center text-sm text-red-500">
                        Gagal memuat data chart.
                    </p>
                )}

                {!isLoading &&
                    !isError &&
                    chart.map((d) => {
                        const val = mode === "water" ? d.water_used : d.elec_used;
                        const BAR_MIN_PX = 20;
                        const barH = Math.max((val / max) * BAR_MAX_PX, BAR_MIN_PX);
                        const isCurrentMonth =
                            d.month === new Date().toISOString().slice(0, 7);

                        return (
                            <div
                                key={d.month}
                                className="group relative flex flex-1 flex-col items-center gap-2"
                            >
                                <div className="invisible absolute bottom-full mb-2 left-1/2 -translate-x-1/2 group-hover:visible rounded-lg bg-[#2F2F2F] px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                                    {val.toFixed(2)} {mode === "water" ? "m³" : "kWh"}
                                </div>
                                {val > 0 && val / max < 0.1 && (
                                    <span className="font-inter text-[10px] text-[#999]">
                                        {val.toFixed(1)}
                                    </span>
                                )}
                                <div
                                    className={`w-full rounded-t-2xl transition-all duration-300 ${isCurrentMonth ? "bg-[#7B1113]" : "bg-[#7B1113]/70"
                                        }`}
                                    style={{ height: `${barH}px` }}
                                />
                                <span className="font-inter text-xs text-[#777]">
                                    {formatMonth(d.month)}
                                </span>
                            </div>
                        );
                    })}
            </div>
        </SectionCard>
    );
}