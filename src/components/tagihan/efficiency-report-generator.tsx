"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileText, Droplets, Zap, Wallet, TrendingUp } from "lucide-react";
import { getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getTariff } from "@/lib/tariff-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomExtra, getCycleExtra, getTodayUsage } from "@/lib/broiler-local-store";
import {
    expectedWaterPerBirdLPerDay, classifyWaterDeviation, ageDaysFromChickIn,
    daysUntilHarvest, formatRupiah,
} from "@/lib/broiler-reference";

type LiveStatus = {
    room_id: number;
    water_total_liter: number;
    power: number;
    energy_kwh_total: number;
    recorded_at: string;
};

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAllLiveStatus(): Promise<LiveStatus[]> {
    const response = await api.get("/api/iot/live-status", { headers: authHeader() });
    return response.data.data ?? [];
}

export default function EfficiencyReportGenerator() {
    const [roomId, setRoomId] = useState<number | "">("");
    const [generated, setGenerated] = useState(false);

    const { data: roomData } = useQuery({
        queryKey: ["rooms", "report-picker"],
        queryFn: () => getRooms({ limit: 100 }),
        staleTime: 60 * 1000,
    });
    const rooms = roomData?.rooms ?? [];

    const { data: leaseData } = useQuery({
        queryKey: ["leases-active-all"],
        queryFn: () => getLeases({ status: "active", limit: 100 }),
        staleTime: 30 * 1000,
    });

    const { data: tariff } = useQuery({
        queryKey: ["tariff"],
        queryFn: getTariff,
        staleTime: 5 * 60 * 1000,
    });

    const { data: liveList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        staleTime: 10 * 1000,
    });

    const room = rooms.find((r) => r.id === roomId);
    const live = (liveList ?? []).find((l) => l.room_id === roomId);
    const activeCycle = (leaseData?.leases ?? []).find((l) => l.room_id === roomId && l.status === "active") ?? null;

    const roomExtra = roomId ? getRoomExtra(Number(roomId)) : {};
    const cycleExtra = activeCycle ? getCycleExtra(activeCycle.id) : {};
    const population = roomExtra.population ?? cycleExtra.population_start;
    const strain = roomExtra.strain ?? cycleExtra.strain;
    const harvestTargetDays = cycleExtra.harvest_target_days ?? 35;
    const ageDays = activeCycle ? ageDaysFromChickIn(activeCycle.start_date) : null;
    const daysToHarvest = ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null;

    const todayUsage = useMemo(
        () => roomId ? getTodayUsage(Number(roomId), live?.water_total_liter ?? 0, live?.energy_kwh_total ?? 0) : { waterTodayLiter: 0, energyTodayKwh: 0 },
        [roomId, live?.water_total_liter, live?.energy_kwh_total]
    );

    const waterPerBirdToday = population ? todayUsage.waterTodayLiter / population : null;
    const waterDeviation = (waterPerBirdToday != null && ageDays != null)
        ? classifyWaterDeviation(waterPerBirdToday, ageDays)
        : null;

    const dailyEnergyRate = (ageDays && ageDays > 0 && live?.energy_kwh_total) ? live.energy_kwh_total / ageDays : null;
    const dailyWaterRate = (ageDays && ageDays > 0 && live?.water_total_liter) ? (live.water_total_liter / 1000) / ageDays : null;
    const predictedEnergyKwh = (dailyEnergyRate != null && daysToHarvest != null)
        ? (live?.energy_kwh_total ?? 0) + dailyEnergyRate * daysToHarvest
        : null;
    const predictedWaterM3 = (dailyWaterRate != null && daysToHarvest != null)
        ? (live?.water_total_liter ?? 0) / 1000 + dailyWaterRate * daysToHarvest
        : null;

    const cumulativeEnergyKwh = live?.energy_kwh_total ?? 0;
    const cumulativeWaterM3 = (live?.water_total_liter ?? 0) / 1000;
    const energyCostCumulative = tariff ? Math.max(0, cumulativeEnergyKwh - tariff.electricity_free_quota) * tariff.electricity_rate : null;
    const waterCostCumulative = tariff ? Math.max(0, cumulativeWaterM3 - tariff.water_free_quota) * tariff.water_rate : null;
    const totalCostCumulative = (energyCostCumulative != null && waterCostCumulative != null)
        ? energyCostCumulative + waterCostCumulative
        : null;
    const predictedCost = (predictedEnergyKwh != null && tariff)
        ? Math.max(0, predictedEnergyKwh - tariff.electricity_free_quota) * tariff.electricity_rate
        : null;

    function handleGenerate() {
        if (!roomId) return;
        setGenerated(true);
    }

    function handlePrint() {
        window.print();
    }

    return (
        <div className="space-y-5">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #efficiency-report-print, #efficiency-report-print * { visibility: visible; }
                    #efficiency-report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Picker */}
            <div className="no-print rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-[#7B1113]" />
                    <h3 className="font-poppins text-base font-semibold text-[#2F2F2F]">Generate Laporan Efisiensi</h3>
                </div>
                <p className="mt-1 font-inter text-xs text-[#999]">
                    Pilih kandang untuk membuat laporan efisiensi air, listrik, dan biaya energi berdasarkan data aktual.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                        title="Pilih kandang"
                        value={roomId}
                        onChange={(e) => { setRoomId(e.target.value ? Number(e.target.value) : ""); setGenerated(false); }}
                        suppressHydrationWarning
                        className="flex-1 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    >
                        <option value="">-- Pilih Kandang --</option>
                        {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                                Kandang {r.number}{r.floor ? ` · Blok ${r.floor}` : ""}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleGenerate}
                        disabled={!roomId}
                        suppressHydrationWarning
                        className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-6 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                    >
                        <FileText size={15} />
                        Generate Laporan
                    </button>
                </div>
            </div>

            {/* Generated report */}
            {generated && room && (
                <div id="efficiency-report-print" className="rounded-3xl border border-[#EAEAEA] bg-white p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-inter text-xs text-[#999]">Laporan Efisiensi Energi & Air</p>
                            <h2 className="mt-1 font-poppins text-xl font-bold text-[#2F2F2F]">
                                Kandang {room.number}{room.floor ? ` · Blok ${room.floor}` : ""}
                            </h2>
                            <p className="mt-1 font-inter text-xs text-[#999]">
                                Dicetak: {new Date().toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            suppressHydrationWarning
                            className="no-print flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-2.5 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                        >
                            <Printer size={15} />
                            Cetak / Unduh PDF
                        </button>
                    </div>

                    {!activeCycle ? (
                        <p className="mt-6 rounded-2xl bg-[#FFF8EC] px-4 py-3 font-inter text-sm text-[#9A6B14]">
                            Kandang ini belum memiliki siklus produksi aktif — laporan efisiensi memerlukan data siklus (chick-in, populasi).
                        </p>
                    ) : (
                        <>
                            {/* Info siklus */}
                            <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-[#F8F8F8] p-4 sm:grid-cols-4">
                                <div>
                                    <p className="font-inter text-xs text-[#999]">Hari Umur</p>
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{ageDays ?? "-"}</p>
                                </div>
                                <div>
                                    <p className="font-inter text-xs text-[#999]">Populasi</p>
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{population ? population.toLocaleString("id-ID") : "-"}</p>
                                </div>
                                <div>
                                    <p className="font-inter text-xs text-[#999]">Strain</p>
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{strain ?? "-"}</p>
                                </div>
                                <div>
                                    <p className="font-inter text-xs text-[#999]">Target Panen</p>
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">Hari ke-{harvestTargetDays}</p>
                                </div>
                            </div>

                            {/* Efisiensi */}
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[#EAEAEA] p-4">
                                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><Droplets size={14} className="text-blue-500" /> Efisiensi Air</div>
                                    <p className="mt-2 font-poppins text-lg font-bold text-[#2F2F2F]">{cumulativeWaterM3.toFixed(2)} m³ <span className="text-xs font-normal text-[#999]">kumulatif alat</span></p>
                                    <p className="mt-1 font-inter text-xs text-[#666]">
                                        {waterPerBirdToday != null ? `${waterPerBirdToday.toFixed(3)} L/ekor hari ini` : "Isi populasi untuk hitung per-ekor"}
                                        {waterDeviation && waterDeviation.tier !== "normal" && (
                                            <span className={waterDeviation.tier === "kritis" ? " text-red-600" : " text-amber-600"}>
                                                {" "}· {waterDeviation.pct >= 0 ? "+" : ""}{waterDeviation.pct.toFixed(0)}% dari pola normal
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-[#EAEAEA] p-4">
                                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><Zap size={14} className="text-amber-500" /> Efisiensi Listrik</div>
                                    <p className="mt-2 font-poppins text-lg font-bold text-[#2F2F2F]">{cumulativeEnergyKwh.toFixed(2)} kWh <span className="text-xs font-normal text-[#999]">kumulatif alat</span></p>
                                    <p className="mt-1 font-inter text-xs text-[#666]">
                                        {population ? `${((cumulativeEnergyKwh * 1000) / population).toFixed(0)} Wh/ekor sejak alat terpasang` : "Isi populasi untuk hitung per-ekor"}
                                    </p>
                                </div>
                            </div>

                            {/* Biaya */}
                            <div className="mt-5 rounded-2xl bg-[#7B1113] p-5 text-white">
                                <div className="flex items-center gap-2 font-inter text-xs text-white/70"><Wallet size={14} /> Estimasi Biaya Energi (kumulatif)</div>
                                <p className="mt-2 font-poppins text-2xl font-bold text-[#C6A971]">
                                    {totalCostCumulative != null ? formatRupiah(totalCostCumulative) : "-"}
                                </p>
                                <p className="mt-1 font-inter text-xs text-white/70">
                                    Air {waterCostCumulative != null ? formatRupiah(waterCostCumulative) : "-"} + Listrik {energyCostCumulative != null ? formatRupiah(energyCostCumulative) : "-"} (tarif dari Pengaturan)
                                </p>
                            </div>

                            {/* Forecast */}
                            <div className="mt-5 rounded-2xl border border-[#EAEAEA] p-4">
                                <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><TrendingUp size={14} className="text-[#7B1113]" /> Proyeksi s.d. Panen (hari ke-{harvestTargetDays})</div>
                                <div className="mt-2 grid grid-cols-3 gap-3">
                                    <div>
                                        <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{daysToHarvest ?? "-"} hari</p>
                                        <p className="font-inter text-xs text-[#999]">Sisa waktu</p>
                                    </div>
                                    <div>
                                        <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{predictedWaterM3 != null ? `${predictedWaterM3.toFixed(1)} m³` : "-"}</p>
                                        <p className="font-inter text-xs text-[#999]">Proyeksi air</p>
                                    </div>
                                    <div>
                                        <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{predictedCost != null ? formatRupiah(predictedCost) : "-"}</p>
                                        <p className="font-inter text-xs text-[#999]">Proyeksi biaya listrik</p>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-5 font-inter text-[11px] text-[#AAA]">
                                Catatan: angka kumulatif dihitung sejak alat IoT terpasang di kandang ini, bukan sejak awal siklus. Proyeksi memakai rata-rata harian siklus berjalan (linear) dan akurasinya meningkat seiring data terkumpul.
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
