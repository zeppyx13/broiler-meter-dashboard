"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileText, Droplets, Zap, Wallet, TrendingUp, ShieldAlert } from "lucide-react";
import { getRooms } from "@/lib/room-api";
import { formatRupiah } from "@/lib/broiler-reference";
import { useKandangData } from "@/components/kamar/ringkasan/use-kandang-data";

export default function EfficiencyReportGenerator() {
    const [roomId, setRoomId] = useState<number | "">("");
    const [generatedFor, setGeneratedFor] = useState<number | null>(null);

    const { data: roomData } = useQuery({
        queryKey: ["rooms-overview"],
        queryFn: () => getRooms({ limit: 100 }),
        staleTime: 60 * 1000,
    });
    const rooms = roomData?.rooms ?? [];

    return (
        <div className="space-y-5">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #efficiency-report-print, #efficiency-report-print * { visibility: visible; }
                    #efficiency-report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; border: none; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-[#7B1113]" />
                    <h3 className="font-poppins text-base font-semibold text-[#2F2F2F]">Laporan Efisiensi Kandang</h3>
                </div>
                <p className="mt-1 font-inter text-xs text-[#999]">
                    Ringkasan efisiensi air, listrik, dan biaya energi siklus berjalan, siap dicetak atau disimpan sebagai PDF.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                        title="Pilih kandang"
                        value={roomId}
                        onChange={(e) => { setRoomId(e.target.value ? Number(e.target.value) : ""); setGeneratedFor(null); }}
                        suppressHydrationWarning
                        className="flex-1 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    >
                        <option value="">Pilih kandang</option>
                        {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                                Kandang {r.number}{r.floor ? ` · Blok ${r.floor}` : ""}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => roomId && setGeneratedFor(Number(roomId))}
                        disabled={!roomId}
                        suppressHydrationWarning
                        className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-6 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                    >
                        <FileText size={15} /> Buat Laporan
                    </button>
                </div>
            </div>

            {generatedFor != null && <EfficiencyReport key={generatedFor} roomId={generatedFor} />}
        </div>
    );
}

function EfficiencyReport({ roomId }: { roomId: number }) {
    const { room, isLoading, activeCycle, cycle, roomExtra, ageDays, harvestTargetDays, daysToHarvest, cycleUsage, insights } = useKandangData(roomId);

    if (isLoading) return <div className="h-64 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />;
    if (!room) return null;

    const populationNow = cycle?.populationNow;

    return (
        <div id="efficiency-report-print" className="rounded-3xl border border-[#EAEAEA] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-inter text-xs text-[#999]">Laporan Efisiensi Energi & Air · COASTHER</p>
                    <h2 className="mt-1 font-poppins text-xl font-bold text-[#2F2F2F]">
                        Kandang {room.number}{room.floor != null ? ` · Blok ${room.floor}` : ""}
                    </h2>
                    <p className="mt-1 font-inter text-xs text-[#999]">
                        Dicetak {new Date().toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                </div>
                <button
                    onClick={() => window.print()}
                    suppressHydrationWarning
                    className="no-print flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-2.5 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                >
                    <Printer size={15} /> Cetak / PDF
                </button>
            </div>

            {!activeCycle || !cycle ? (
                <p className="mt-6 rounded-2xl bg-[#FFF8EC] px-4 py-3 font-inter text-sm text-[#9A6B14]">
                    Kandang ini sedang istirahat. Laporan efisiensi tersedia saat ada siklus berjalan.
                </p>
            ) : (
                <>
                    <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-[#F8F8F8] p-4 sm:grid-cols-4">
                        <Info label="Hari umur" value={`${ageDays} / ${harvestTargetDays}`} />
                        <Info label="Populasi" value={populationNow != null ? `${populationNow.toLocaleString("id-ID")} ekor` : "—"} />
                        <Info label="Deplesi" value={cycle.depletionPct != null ? `${cycle.depletion} ekor (${cycle.depletionPct.toFixed(1)}%)` : `${cycle.depletion} ekor`} />
                        <Info label="Strain" value={cycle.extra.strain ?? "—"} />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <Block icon={<Droplets size={14} className="text-blue-500" />} title="Air minum siklus ini">
                            <p className="font-poppins text-lg font-bold text-[#2F2F2F]">
                                {cycleUsage ? `${(cycleUsage.waterLiter / 1000).toFixed(2)} m³` : "—"}
                            </p>
                            <p className="font-inter text-xs text-[#666]">
                                {cycleUsage && populationNow ? `${(cycleUsage.waterLiter / populationNow).toFixed(2)} L/ekor kumulatif` : "Butuh populasi & data perangkat"}
                                {insights.waterDeviation && ` · laju hari ini ${insights.waterDeviation.pct >= 0 ? "+" : ""}${insights.waterDeviation.pct.toFixed(0)}% dari pola normal`}
                            </p>
                        </Block>
                        <Block icon={<Zap size={14} className="text-amber-500" />} title="Listrik siklus ini">
                            <p className="font-poppins text-lg font-bold text-[#2F2F2F]">
                                {cycleUsage ? `${cycleUsage.energyKwh.toFixed(1)} kWh` : "—"}
                            </p>
                            <p className="font-inter text-xs text-[#666]">
                                {cycleUsage && populationNow ? `${((cycleUsage.energyKwh * 1000) / populationNow).toFixed(0)} Wh/ekor` : "Butuh populasi & data perangkat"}
                                {roomExtra.expected_power_kw ? ` · daya terpasang ${roomExtra.expected_power_kw} kW` : ""}
                            </p>
                        </Block>
                    </div>

                    <div className="mt-5 rounded-2xl bg-[#7B1113] p-5 text-white">
                        <div className="flex items-center gap-2 font-inter text-xs text-white/70"><Wallet size={14} /> Biaya energi siklus berjalan</div>
                        <p className="mt-2 font-poppins text-2xl font-bold text-[#C6A971]">
                            {insights.cycleEnergyCost != null ? formatRupiah(insights.cycleEnergyCost + (insights.cycleWaterCost ?? 0)) : "—"}
                        </p>
                        <p className="mt-1 font-inter text-xs text-white/70">
                            Listrik {insights.cycleEnergyCost != null ? formatRupiah(insights.cycleEnergyCost) : "—"} · Air {insights.cycleWaterCost != null ? formatRupiah(insights.cycleWaterCost) : "—"} (tarif dari Pengaturan)
                        </p>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <Block icon={<TrendingUp size={14} className="text-[#7B1113]" />} title={`Proyeksi s.d. panen (hari ${harvestTargetDays})`}>
                            <p className="font-inter text-sm text-[#2F2F2F]">
                                {insights.predictedEnergyKwh != null
                                    ? `${insights.predictedEnergyKwh.toFixed(0)} kWh · air ±${insights.predictedWaterM3?.toFixed(1)} m³ · ≈ ${formatRupiah(insights.predictedCost ?? 0)}`
                                    : "Butuh minimal 6 jam data siklus"}
                            </p>
                            <p className="font-inter text-xs text-[#999]">Sisa {daysToHarvest} hari</p>
                        </Block>
                        <Block icon={<ShieldAlert size={14} className="text-[#7B1113]" />} title="Peringatan aktif">
                            {insights.alerts.length === 0 ? (
                                <p className="font-inter text-sm text-[#2F2F2F]">Tidak ada</p>
                            ) : (
                                <ul className="space-y-0.5 font-inter text-sm text-[#2F2F2F]">
                                    {insights.alerts.map((a) => <li key={a.id}>• {a.title}</li>)}
                                </ul>
                            )}
                        </Block>
                    </div>

                    <p className="mt-5 font-inter text-[11px] text-[#AAA]">
                        Konsumsi siklus dihitung dari angka meter sejak {cycleUsage ? cycleUsage.since.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—"}.
                        Pola normal air adalah estimasi referensi umum, bukan data spesifik strain.
                    </p>
                </>
            )}
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="font-inter text-xs text-[#999]">{label}</p>
            <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{value}</p>
        </div>
    );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-[#EAEAEA] p-4">
            <div className="mb-2 flex items-center gap-2 font-inter text-xs text-[#999]">{icon} {title}</div>
            {children}
        </div>
    );
}
