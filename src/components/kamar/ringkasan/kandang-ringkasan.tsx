"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
    ComposedChart, Line, ReferenceDot, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
    Wifi, WifiOff, Droplets, Zap, Wallet, TrendingUp, ShieldAlert, Leaf, Lightbulb, Send, LoaderCircle, Bot, ArrowLeft,
} from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { getRoomById } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getTariff } from "@/lib/tariff-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { socket } from "@/lib/socket";
import { sendAdminChat } from "@/lib/admin-chat-api";
import { getRoomExtra, getCycleExtra, getTodayUsage } from "@/lib/broiler-local-store";
import {
    expectedWaterPerBirdLPerDay, expectedWaterRangeLPerDay, classifyWaterDeviation,
    classifyPowerDeviation, ageDaysFromChickIn, daysUntilHarvest, isTelemetryFresh, formatRupiah,
    type DeviationTier,
} from "@/lib/broiler-reference";

type LiveStatus = {
    room_id: number;
    flow_rate_lpm: number;
    water_total_liter: number;
    voltage: number;
    current: number;
    power: number;
    energy_kwh_total: number;
    frequency: number;
    pf: number;
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

const TIER_STYLE: Record<DeviationTier, { badge: string; border: string; label: string }> = {
    kritis: { badge: "bg-[#FDEAEA] text-[#B42318] border-l-[#B42318]", border: "border-[#F6D0D0]", label: "KRITIS" },
    waspada: { badge: "bg-[#FFF4E5] text-[#B76E00] border-l-[#B76E00]", border: "border-[#F3E2C0]", label: "WASPADA" },
    normal: { badge: "bg-[#EAFBF0] text-[#1F8A4C] border-l-[#1F8A4C]", border: "border-[#CFEFDC]", label: "NORMAL" },
};

type AlertItem = { id: string; tier: DeviationTier; title: string; detail: string; time: string };

export default function KandangRingkasan({ roomId }: { roomId: number }) {
    const [liveData, setLiveData] = useState<Record<number, LiveStatus>>({});

    const { data: roomDetail, isLoading: roomLoading, isError: roomError } = useQuery({
        queryKey: ["room-detail", roomId],
        queryFn: () => getRoomById(roomId),
        enabled: Number.isFinite(roomId),
    });

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

    const { data: liveStatusList } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 5 * 1000,
        staleTime: 10 * 1000,
    });

    useEffect(() => {
        if (liveStatusList) {
            const map: Record<number, LiveStatus> = {};
            liveStatusList.forEach((d) => { map[d.room_id] = d; });
            setLiveData(map);
        }
    }, [liveStatusList]);

    useEffect(() => {
        socket.connect();
        const onTelemetry = (payload: any) => {
            const rid = Number(payload.room_id);
            if (!rid) return;
            setLiveData((prev) => {
                const existing = prev[rid] ?? ({} as LiveStatus);
                return {
                    ...prev,
                    [rid]: {
                        ...existing,
                        room_id: rid,
                        flow_rate_lpm: payload.flow_rate_lpm ?? existing.flow_rate_lpm ?? 0,
                        water_total_liter: payload.water_total_liter ?? existing.water_total_liter ?? 0,
                        voltage: payload.voltage ?? existing.voltage ?? 0,
                        current: payload.current ?? existing.current ?? 0,
                        power: payload.power ?? existing.power ?? 0,
                        energy_kwh_total: payload.energy_kwh_total ?? existing.energy_kwh_total ?? 0,
                        frequency: payload.frequency ?? existing.frequency ?? 0,
                        pf: payload.pf ?? existing.pf ?? 0,
                        recorded_at: payload.recorded_at ?? new Date().toISOString(),
                    },
                };
            });
        };
        socket.on("telemetry_update", onTelemetry);
        return () => {
            socket.off("telemetry_update", onTelemetry);
            socket.disconnect();
        };
    }, []);

    const room = roomDetail?.room;
    const live = liveData[roomId];
    const online = isTelemetryFresh(live?.recorded_at);

    const activeCycle = useMemo(
        () => (leaseData?.leases ?? []).find((l) => l.room_id === roomId && l.status === "active") ?? null,
        [leaseData, roomId]
    );

    const roomExtra = useMemo(() => (Number.isFinite(roomId) ? getRoomExtra(roomId) : {}), [roomId]);
    const cycleExtra = useMemo(() => (activeCycle ? getCycleExtra(activeCycle.id) : {}), [activeCycle]);

    const population = roomExtra.population ?? cycleExtra.population_start;
    const strain = roomExtra.strain ?? cycleExtra.strain;
    const harvestTargetDays = cycleExtra.harvest_target_days ?? 35;
    const expectedPowerKw = roomExtra.expected_power_kw;

    const ageDays = activeCycle ? ageDaysFromChickIn(activeCycle.start_date) : null;
    const daysToHarvest = ageDays != null ? daysUntilHarvest(ageDays, harvestTargetDays) : null;

    const todayUsage = useMemo(
        () => getTodayUsage(roomId, live?.water_total_liter ?? 0, live?.energy_kwh_total ?? 0),
        [roomId, live?.water_total_liter, live?.energy_kwh_total]
    );

    const waterPerBirdToday = population ? todayUsage.waterTodayLiter / population : null;
    const waterDeviation = (waterPerBirdToday != null && ageDays != null)
        ? classifyWaterDeviation(waterPerBirdToday, ageDays)
        : null;

    const actualPowerKw = (live?.power ?? 0) / 1000;
    const powerDeviation = expectedPowerKw
        ? classifyPowerDeviation(actualPowerKw, expectedPowerKw, online)
        : null;

    // Proyeksi s.d. panen — rata-rata harian dari kumulatif alat / umur siklus berjalan.
    const dailyEnergyRate = (ageDays && ageDays > 0 && live?.energy_kwh_total) ? live.energy_kwh_total / ageDays : null;
    const dailyWaterRate = (ageDays && ageDays > 0 && live?.water_total_liter) ? (live.water_total_liter / 1000) / ageDays : null;
    const predictedEnergyKwh = (dailyEnergyRate != null && daysToHarvest != null)
        ? (live?.energy_kwh_total ?? 0) + dailyEnergyRate * daysToHarvest
        : null;
    const predictedWaterM3 = (dailyWaterRate != null && daysToHarvest != null)
        ? (live?.water_total_liter ?? 0) / 1000 + dailyWaterRate * daysToHarvest
        : null;
    const predictedCost = (predictedEnergyKwh != null && tariff) ? predictedEnergyKwh * tariff.electricity_rate : null;
    const energyTodayCost = tariff ? todayUsage.energyTodayKwh * tariff.electricity_rate : null;

    // Guard — peringatan dihitung dari data nyata (telemetry + kurva referensi), bukan statis.
    const alerts: AlertItem[] = [];
    if (activeCycle) {
        if (!online) {
            alerts.push({
                id: "offline",
                tier: "kritis",
                title: "Perangkat offline",
                detail: live?.recorded_at
                    ? `Tidak ada data masuk sejak ${new Date(live.recorded_at).toLocaleTimeString("id-ID")}. Kemungkinan listrik padam atau koneksi terputus.`
                    : "Belum ada data telemetry yang diterima untuk kandang ini.",
                time: live?.recorded_at ? new Date(live.recorded_at).toLocaleString("id-ID") : "-",
            });
        }
        if (waterDeviation && waterDeviation.tier !== "normal") {
            alerts.push({
                id: "water",
                tier: waterDeviation.tier,
                title: waterDeviation.direction === "turun" ? "Air minum di bawah pola normal" : "Air minum di atas pola normal (indikasi kebocoran)",
                detail: `${waterDeviation.pct >= 0 ? "+" : ""}${waterDeviation.pct.toFixed(0)}% dari estimasi pola normal hari ke-${ageDays} (${expectedWaterPerBirdLPerDay(ageDays ?? 0).toFixed(3)} L/ekor).`,
                time: "Hari ini",
            });
        }
        if (powerDeviation && powerDeviation.tier !== "normal" && online) {
            alerts.push({
                id: "power",
                tier: powerDeviation.tier,
                title: "Daya di bawah daya terpasang seharusnya",
                detail: `Daya aktual ${actualPowerKw.toFixed(2)} kW vs seharusnya ${expectedPowerKw?.toFixed(2)} kW (${powerDeviation.pct.toFixed(0)}%). Periksa kipas/beban kandang.`,
                time: "Baru saja",
            });
        }
    }

    // Copilot — chat ringkas khusus kandang ini, pakai backend AI yang sama (Gemini).
    const [copilotInput, setCopilotInput] = useState("");
    const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
    const [copilotLoading, setCopilotLoading] = useState(false);

    async function askCopilot(question: string) {
        if (!question.trim() || copilotLoading) return;
        setCopilotLoading(true);
        setCopilotAnswer(null);
        try {
            const context = `Konteks: Kandang ${room?.number ?? roomId}${ageDays != null ? `, siklus hari ke-${ageDays}` : ""}${population ? `, populasi ${population} ekor` : ""}${strain ? `, strain ${strain}` : ""}.`;
            const result = await sendAdminChat(`${context} ${question}`, []);
            setCopilotAnswer(result.answer);
        } catch {
            setCopilotAnswer("Maaf, terjadi kesalahan saat menghubungi Copilot. Coba lagi.");
        } finally {
            setCopilotLoading(false);
        }
    }

    // Data chart — pita pola normal (referensi literatur) + satu titik aktual hari ini.
    const chartMaxDay = Math.max(harvestTargetDays, (ageDays ?? 0) + 3, 14);
    const chartData = useMemo(() => {
        const points = [];
        for (let d = 1; d <= chartMaxDay; d += Math.max(1, Math.round(chartMaxDay / 20))) {
            const range = expectedWaterRangeLPerDay(d);
            points.push({ day: d, low: Number(range.low.toFixed(3)), mid: Number(range.mid.toFixed(3)), high: Number(range.high.toFixed(3)) });
        }
        return points;
    }, [chartMaxDay]);

    if (roomLoading) {
        return <div className="h-96 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />;
    }
    if (roomError || !room) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat data kandang.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <Link href="/dashboard/kamar" className="inline-flex items-center gap-1.5 font-inter text-sm text-[#777] hover:text-[#7B1113]">
                <ArrowLeft size={14} /> Kembali ke Data Kandang
            </Link>

            {/* Header */}
            <SectionCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="font-poppins text-xl font-bold text-[#2F2F2F]">
                            Kandang {room.number} – Ringkasan
                        </h2>
                        <p className="mt-1 font-inter text-sm text-[#777]">
                            {activeCycle
                                ? `Siklus aktif · Hari ke-${ageDays} · Populasi ${population ? population.toLocaleString("id-ID") : "-"} ekor`
                                : "Belum ada siklus produksi aktif untuk kandang ini"}
                        </p>
                    </div>
                    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-inter text-xs font-medium ${online ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
                        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {online ? "Perangkat online" : "Perangkat offline"}
                        {live?.recorded_at && ` · ${new Date(live.recorded_at).toLocaleTimeString("id-ID")}`}
                    </span>
                </div>
            </SectionCard>

            {/* 4 KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><Droplets size={14} className="text-blue-500" /> Air minum hari ini</div>
                    <p className="mt-2 font-poppins text-2xl font-bold text-[#2F2F2F]">{todayUsage.waterTodayLiter.toFixed(1)} L</p>
                    <p className={`mt-1 font-inter text-xs ${waterDeviation?.tier === "kritis" ? "text-red-600" : waterDeviation?.tier === "waspada" ? "text-amber-600" : "text-[#999]"}`}>
                        {waterPerBirdToday != null
                            ? `${waterPerBirdToday.toFixed(3)} L/ekor${waterDeviation ? ` · ${waterDeviation.pct >= 0 ? "+" : ""}${waterDeviation.pct.toFixed(0)}% dari pola normal` : ""}`
                            : "Isi populasi kandang untuk lihat per-ekor"}
                    </p>
                </div>

                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><Zap size={14} className="text-amber-500" /> Daya saat ini</div>
                    <p className="mt-2 font-poppins text-2xl font-bold text-[#2F2F2F]">{actualPowerKw.toFixed(2)} kW</p>
                    <p className={`mt-1 font-inter text-xs ${powerDeviation?.tier === "kritis" ? "text-red-600" : powerDeviation?.tier === "waspada" ? "text-amber-600" : "text-[#999]"}`}>
                        {expectedPowerKw ? `Seharusnya ${expectedPowerKw.toFixed(2)} kW` : "Isi daya terpasang di Edit Kandang"}
                    </p>
                </div>

                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><TrendingUp size={14} className="text-[#7B1113]" /> Energi hari ini</div>
                    <p className="mt-2 font-poppins text-2xl font-bold text-[#2F2F2F]">{todayUsage.energyTodayKwh.toFixed(2)} kWh</p>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        {energyTodayCost != null ? `≈ ${formatRupiah(energyTodayCost)}` : "-"}
                        {population ? ` · ${((todayUsage.energyTodayKwh * 1000) / population).toFixed(0)} Wh/ekor` : ""}
                    </p>
                </div>

                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    <div className="flex items-center gap-2 font-inter text-xs text-[#999]"><Wallet size={14} className="text-green-600" /> Prediksi s.d. panen</div>
                    <p className="mt-2 font-poppins text-2xl font-bold text-[#2F2F2F]">
                        {predictedEnergyKwh != null ? `${predictedEnergyKwh.toFixed(0)} kWh` : "-"}
                    </p>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        {predictedCost != null ? `≈ ${formatRupiah(predictedCost)}` : "Butuh data siklus & tanggal panen"}
                        {predictedWaterM3 != null ? ` · Air ±${predictedWaterM3.toFixed(1)} m³` : ""}
                    </p>
                </div>
            </div>

            {/* Chart + Alerts */}
            <div className="grid gap-6 xl:grid-cols-3">
                <SectionCard className="xl:col-span-2">
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Konsumsi air per ekor menurut hari umur</p>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        Pita &quot;pola normal&quot; adalah estimasi referensi umum (bukan data spesifik strain Anda). Titik merah adalah pengukuran aktual hari ini.
                    </p>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#999" }} label={{ value: "hari umur", position: "insideBottom", offset: -3, fontSize: 11, fill: "#999" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#999" }} label={{ value: "L/ekor/hari", angle: -90, position: "insideLeft", fontSize: 11, fill: "#999" }} />
                                <Tooltip formatter={(v) => `${v} L/ekor`} labelFormatter={(d) => `Hari ke-${d}`} />
                                <Line type="monotone" dataKey="low" stroke="#E8CFCF" strokeWidth={1} dot={false} name="Batas bawah wajar" />
                                <Line type="monotone" dataKey="mid" stroke="#7B1113" strokeDasharray="5 4" strokeWidth={2} dot={false} name="Pola normal" />
                                <Line type="monotone" dataKey="high" stroke="#E8CFCF" strokeWidth={1} dot={false} name="Batas atas wajar" />
                                {ageDays != null && waterPerBirdToday != null && (
                                    <ReferenceDot x={ageDays} y={Number(waterPerBirdToday.toFixed(3))} r={6} fill="#B42318" stroke="white" strokeWidth={2} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                <SectionCard>
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={18} className="text-[#7B1113]" />
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Peringatan terbaru</p>
                    </div>
                    <div className="mt-4 space-y-3">
                        {!activeCycle ? (
                            <p className="font-inter text-sm text-[#999]">Mulai siklus produksi untuk mengaktifkan Guard.</p>
                        ) : alerts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] p-4 text-center">
                                <p className="font-inter text-sm text-[#777]">Tidak ada peringatan aktif. 🎉</p>
                            </div>
                        ) : (
                            alerts.map((a) => (
                                <div key={a.id} className={`rounded-xl border-l-4 ${TIER_STYLE[a.tier].badge} p-3`}>
                                    <p className="font-inter text-[11px] font-bold">{TIER_STYLE[a.tier].label} · {a.time}</p>
                                    <p className="mt-0.5 font-inter text-xs font-semibold">{a.title}</p>
                                    <p className="mt-0.5 font-inter text-xs opacity-90">{a.detail}</p>
                                </div>
                            ))
                        )}
                    </div>
                </SectionCard>
            </div>

            {/* Forecast + Eco-Advisor */}
            <div className="grid gap-6 xl:grid-cols-2">
                <SectionCard>
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-[#7B1113]" />
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Forecast</p>
                    </div>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        Proyeksi linear dari rata-rata konsumsi harian siklus ini — akurasi meningkat seiring data terkumpul.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#FAFAFA] p-3">
                            <p className="font-inter text-xs text-[#999]">Sisa hari ke panen</p>
                            <p className="mt-1 font-poppins text-lg font-bold text-[#2F2F2F]">{daysToHarvest ?? "-"} hari</p>
                        </div>
                        <div className="rounded-2xl bg-[#FAFAFA] p-3">
                            <p className="font-inter text-xs text-[#999]">Estimasi biaya energi</p>
                            <p className="mt-1 font-poppins text-lg font-bold text-[#2F2F2F]">{predictedCost != null ? formatRupiah(predictedCost) : "-"}</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard>
                    <div className="flex items-center gap-2">
                        <Leaf size={18} className="text-green-600" />
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Eco-Advisor</p>
                    </div>
                    <div className="mt-4 space-y-2.5">
                        {live && live.pf > 0 && live.pf < 0.85 && (
                            <EcoTip title="Power factor rendah" detail={`PF terukur ${live.pf.toFixed(2)}. Periksa beban motor/kipas, pertimbangkan kapasitor bank.`} />
                        )}
                        {waterDeviation?.direction === "naik" && waterDeviation.tier !== "normal" && (
                            <EcoTip title="Indikasi kebocoran/rembes" detail="Konsumsi air di atas pola normal. Cek jalur nipple dan tandon untuk kebocoran." />
                        )}
                        <EcoTip title="Geser jadwal pemanas ke waktu lebih hangat" detail="Nyalakan pemanas lebih lambat saat suhu lingkungan sudah mendekati target brooding." />
                        <EcoTip title="Matikan pencahayaan tambahan di siang hari" detail="Manfaatkan cahaya alami saat intensitasnya sudah cukup untuk aktivitas ayam." />
                    </div>
                </SectionCard>
            </div>

            {/* Copilot */}
            <SectionCard>
                <div className="flex items-center gap-2">
                    <Bot size={18} className="text-[#7B1113]" />
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Copilot</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {["Kenapa air minum turun hari ini?", "Bagaimana kondisi kandang ini secara umum?", "Apa yang perlu saya lakukan sekarang?"].map((q) => (
                        <button
                            key={q}
                            onClick={() => { setCopilotInput(q); askCopilot(q); }}
                            suppressHydrationWarning
                            className="rounded-2xl bg-[#7B1113] px-4 py-2 font-inter text-xs font-medium text-white transition hover:opacity-90"
                        >
                            {q}
                        </button>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <input
                        type="text"
                        value={copilotInput}
                        onChange={(e) => setCopilotInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askCopilot(copilotInput)}
                        placeholder="Tanya Copilot tentang kandang ini..."
                        suppressHydrationWarning
                        className="flex-1 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2.5 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    />
                    <button
                        title="Kirim"
                        onClick={() => askCopilot(copilotInput)}
                        disabled={copilotLoading || !copilotInput.trim()}
                        suppressHydrationWarning
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113] disabled:opacity-40"
                    >
                        {copilotLoading ? <LoaderCircle size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                    </button>
                </div>
                {copilotAnswer && (
                    <div className="mt-3 rounded-2xl bg-[#F8F8F8] p-4 font-inter text-sm leading-relaxed text-[#2F2F2F]">
                        {copilotAnswer}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

function EcoTip({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-3.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-green-50">
                <Lightbulb size={14} className="text-green-600" />
            </div>
            <div>
                <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{title}</p>
                <p className="mt-0.5 font-inter text-xs text-[#666]">{detail}</p>
            </div>
        </div>
    );
}
