"use client";

import { LineChart, Droplets, Zap, Wallet } from "lucide-react";
import SectionCard from "../section-card";

const FORECAST_STATS = [
    {
        label: "Perkiraan Kebutuhan Air",
        value: "18.4 m³",
        desc: "Sampai estimasi panen (14 hari lagi)",
        icon: Droplets,
        color: "text-blue-600 bg-blue-50",
    },
    {
        label: "Perkiraan Kebutuhan Listrik",
        value: "612 kWh",
        desc: "Sampai estimasi panen (14 hari lagi)",
        icon: Zap,
        color: "text-amber-600 bg-amber-50",
    },
    {
        label: "Estimasi Biaya Energi",
        value: "Rp 1.240.000",
        desc: "Total air + listrik sampai panen",
        icon: Wallet,
        color: "text-[#7B1113] bg-[#7B1113]/10",
    },
];

// Placeholder tren mingguan — proporsi batang statis untuk mock chart
const TREND_WEEKS = [
    { label: "M1", value: 35 },
    { label: "M2", value: 52 },
    { label: "M3", value: 68 },
    { label: "M4", value: 81 },
    { label: "M5", value: 94 },
];

export default function ForecastSection() {
    return (
        <SectionCard>
            <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <LineChart size={18} className="text-[#7B1113]" />
                </div>
                <div>
                    <p className="font-inter text-sm text-[#666]">Prediksi Kebutuhan</p>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Forecast</h3>
                </div>
            </div>

            <p className="mt-3 rounded-2xl bg-[#FFF8EC] px-4 py-2 font-inter text-xs text-[#9A6B14]">
                Data contoh — menunggu integrasi backend AI
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {FORECAST_STATS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.label}
                            className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4"
                        >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.color}`}>
                                <Icon size={15} />
                            </div>
                            <p className="mt-3 font-poppins text-xl font-bold text-[#2F2F2F]">
                                {stat.value}
                            </p>
                            <p className="mt-1 font-inter text-xs font-medium text-[#555]">{stat.label}</p>
                            <p className="mt-0.5 font-inter text-[11px] text-[#999]">{stat.desc}</p>
                        </div>
                    );
                })}
            </div>

            {/* Mini chart placeholder */}
            <div className="mt-5 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4">
                <p className="font-inter text-xs font-medium text-[#555]">Tren Pemakaian Mingguan (proyeksi)</p>
                <div className="mt-4 flex h-24 items-end gap-3">
                    {TREND_WEEKS.map((week) => (
                        <div key={week.label} className="flex flex-1 flex-col items-center gap-1.5">
                            <div
                                className="w-full rounded-t-lg bg-[#7B1113]/80"
                                style={{ height: `${week.value}%` }}
                            />
                            <span className="font-inter text-[10px] text-[#999]">{week.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </SectionCard>
    );
}
