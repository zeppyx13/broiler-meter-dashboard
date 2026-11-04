"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, ShieldAlert } from "lucide-react";
import { getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getCycleState, localDateKey } from "@/lib/broiler-local-store";
import { formatRupiah } from "@/lib/broiler-reference";
import { summarizeCycle } from "@/lib/cycle-history";
import { DEFAULT_IMPACT_SETTINGS, getImpactSettings, kandangImpact, setImpactSettings, type ImpactSettings } from "@/lib/impact";
import { useGuard } from "@/components/dashboard/guard/guard-monitor";

const num = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const DEFAULT_HARVEST_KG = 2;
const EVIDENCE_DAYS = 30;

const EVENT_LABEL: Record<string, string> = {
    power: "Kipas mati / daya turun",
    offline: "Listrik padam / alat offline",
    voltage: "Tegangan tidak stabil",
    water: "Air minum tidak normal",
};

/** Kartu dampak: nilai kematian yang dicegah per siklus & berapa lama perangkat balik modal. */
export default function ImpactCard() {
    const [settings, setSettings] = useState<ImpactSettings>(DEFAULT_IMPACT_SETTINGS);
    // Asumsi tersimpan di browser → dibaca setelah mount agar HTML server & klien sama.
    useEffect(() => setSettings(getImpactSettings()), []);
    const { active, history } = useGuard();
    const [sinceMs] = useState(() => Date.now() - EVIDENCE_DAYS * 86_400_000);

    const { data: roomData } = useQuery({ queryKey: ["rooms-overview"], queryFn: () => getRooms({ limit: 100 }), staleTime: 60_000 });
    const { data: activeData } = useQuery({ queryKey: ["leases-active-all"], queryFn: () => getLeases({ status: "active", limit: 100 }), staleTime: 30_000 });
    const { data: endedData } = useQuery({ queryKey: ["leases-ended-all"], queryFn: () => getLeases({ status: "ended", limit: 100 }), staleTime: 60_000 });

    const rows = useMemo(() => {
        const today = localDateKey();
        const ended = endedData?.leases ?? [];
        return (activeData?.leases ?? [])
            .filter((l) => l.status === "active")
            .map((lease) => {
                const room = roomData?.rooms.find((r) => r.id === lease.room_id);
                const population = getCycleState(lease.id, lease.room_id).populationNow ?? 0;
                // Bobot panen: dari siklus terakhir kandang ini, atau 2 kg bila belum ada.
                const lastEnded = ended.filter((l) => l.room_id === lease.room_id).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
                const lastWeight = lastEnded ? summarizeCycle(lastEnded, { today }).lastWeightG : undefined;
                const harvestKg = lastWeight ? lastWeight / 1000 : DEFAULT_HARVEST_KG;
                return { lease, number: room?.number ?? lease.room_number, population, harvestKg, impact: kandangImpact(population, harvestKg, settings) };
            })
            .sort((a, b) => a.number.localeCompare(b.number, "id", { numeric: true }));
    }, [activeData, endedData, roomData, settings]);

    const totalPopulation = rows.reduce((s, r) => s + r.population, 0);
    const totalValue = rows.reduce((s, r) => s + r.impact.valuePerCycle, 0);
    const totalCost = rows.length * settings.deviceCost;
    const totalPaybackCycles = totalValue > 0 ? totalCost / totalValue : null;
    const avgKg = totalPopulation > 0 ? rows.reduce((s, r) => s + r.population * r.harvestKg, 0) / totalPopulation : DEFAULT_HARVEST_KG;

    const evidence = useMemo(() => {
        const counts: Record<string, number> = {};
        [...active, ...history]
            .filter((a) => a.tier !== "info" && new Date(a.firstSeen).getTime() >= sinceMs)
            .forEach((a) => { counts[a.alertId] = (counts[a.alertId] ?? 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [active, history, sinceMs]);

    function update<K extends keyof ImpactSettings>(key: K, value: number) {
        if (!Number.isFinite(value) || value < 0) return;
        const next = { ...settings, [key]: value };
        setSettings(next);
        setImpactSettings(next);
    }

    return (
        <section className="rounded-3xl border border-[#EAEAEA] bg-white p-6" aria-labelledby="impact-title">
            <div className="flex items-center gap-2">
                <HandCoins size={18} className="text-[#7B1113]" />
                <h3 id="impact-title" className="font-poppins text-base font-semibold text-[#2F2F2F]">Dampak & balik modal</h3>
            </div>
            <p className="mt-1 font-inter text-xs text-[#999]">
                Nilai ayam yang terselamatkan bila COASTHER mencegah sebagian kematian, dibanding biaya perangkat. Rumus sesuai proposal: populasi × kematian dicegah × bobot panen × harga.
            </p>

            {/* Asumsi */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AssumptionInput label="Harga ayam hidup" prefix="Rp" suffix="/kg" value={settings.pricePerKg} step={500} onChange={(v) => update("pricePerKg", v)} />
                <AssumptionInput label="Kematian dicegah" suffix="% / siklus" value={settings.preventedMortalityPct} step={0.5} onChange={(v) => update("preventedMortalityPct", v)} />
                <AssumptionInput label="Biaya perangkat" prefix="Rp" suffix="/kandang" value={settings.deviceCost} step={10_000} onChange={(v) => update("deviceCost", v)} />
                <AssumptionInput label="Siklus + istirahat" suffix="hari" value={settings.cycleDays} step={1} onChange={(v) => update("cycleDays", v)} />
            </div>

            {rows.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#FAFAFA] px-4 py-6 text-center font-inter text-sm text-[#999]">Belum ada siklus berjalan untuk dihitung.</p>
            ) : (
                <>
                    {/* Ringkasan */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <Big label="Nilai terselamatkan / siklus" value={formatRupiah(totalValue)} sub={`±${num(totalPopulation * settings.preventedMortalityPct / 100)} ekor dari ${num(totalPopulation)} ekor`} />
                        <Big label="Biaya perangkat" value={formatRupiah(totalCost)} sub={`${rows.length} kandang × ${formatRupiah(settings.deviceCost)}`} />
                        <Big
                            label="Balik modal"
                            value={totalPaybackCycles != null ? `${num(totalPaybackCycles, 1)} siklus` : "—"}
                            sub={totalPaybackCycles != null ? `≈ ${num((totalPaybackCycles * settings.cycleDays) / 30, 1)} bulan` : "isi populasi siklus"}
                            highlight
                        />
                    </div>

                    {/* Per kandang */}
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[520px] font-inter text-sm">
                            <thead>
                                <tr className="border-b border-[#EAEAEA] text-left text-xs text-[#999]">
                                    <th className="py-2 font-medium">Kandang</th>
                                    <th className="py-2 text-right font-medium">Populasi</th>
                                    <th className="py-2 text-right font-medium">Bobot panen</th>
                                    <th className="py-2 text-right font-medium">Nilai / siklus</th>
                                    <th className="py-2 text-right font-medium">Balik modal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.lease.id} className="border-b border-[#F5F5F5] last:border-0">
                                        <td className="py-2.5 font-medium text-[#2F2F2F]">{r.number}</td>
                                        <td className="py-2.5 text-right text-[#555]">{num(r.population)} ekor</td>
                                        <td className="py-2.5 text-right text-[#555]">{num(r.harvestKg, 2)} kg</td>
                                        <td className="py-2.5 text-right text-[#555]">{formatRupiah(r.impact.valuePerCycle)}</td>
                                        <td className="py-2.5 text-right font-medium text-[#2F2F2F]">
                                            {r.impact.paybackCycles != null ? `${num(r.impact.paybackCycles, 1)} siklus` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Sensitivitas */}
                    <div className="mt-4 rounded-2xl bg-[#FAFAFA] p-4">
                        <p className="font-inter text-xs font-medium text-[#555]">Bila kematian yang dicegah berbeda:</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            {[0.5, 1, 2].map((pct) => {
                                const value = (totalPopulation * pct / 100) * avgKg * settings.pricePerKg;
                                const cycles = value > 0 ? totalCost / value : null;
                                return (
                                    <div key={pct} className={`rounded-xl px-3 py-2 ${pct === settings.preventedMortalityPct ? "bg-white ring-1 ring-[#7B1113]/30" : "bg-white"}`}>
                                        <p className="font-inter text-[11px] text-[#999]">{num(pct, 1)}% dicegah</p>
                                        <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{formatRupiah(value)}</p>
                                        <p className="font-inter text-[11px] text-[#777]">{cycles != null ? `balik modal ${num(cycles, 1)} siklus` : "—"}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Bukti kejadian */}
            <div className="mt-4">
                <p className="flex items-center gap-1.5 font-inter text-xs font-medium text-[#555]">
                    <ShieldAlert size={13} className="text-[#7B1113]" /> Kejadian yang tertangkap Guard {EVIDENCE_DAYS} hari terakhir
                </p>
                {evidence.length === 0 ? (
                    <p className="mt-1 font-inter text-xs text-[#999]">Belum ada kejadian kritis/waspada tercatat.</p>
                ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {evidence.map(([id, count]) => (
                            <span key={id} className="rounded-full bg-[#F8F1E7] px-3 py-1 font-inter text-xs text-[#7A5C1E]">
                                {EVENT_LABEL[id] ?? id}: <span className="font-semibold">{count}×</span>
                            </span>
                        ))}
                    </div>
                )}
                <p className="mt-2 font-inter text-[11px] text-[#AAA]">
                    Angka di atas adalah estimasi dari asumsi yang bisa diubah, bukan hasil uji lapangan. Kejadian nyata (kipas mati saat siang panas, listrik padam malam hari) bisa menyebabkan kematian jauh di atas 1%.
                </p>
            </div>
        </section>
    );
}

function AssumptionInput({ label, prefix, suffix, value, step, onChange }: { label: string; prefix?: string; suffix?: string; value: number; step: number; onChange: (v: number) => void }) {
    return (
        <label className="block">
            <span className="font-inter text-xs text-[#777]">{label}</span>
            <span className="mt-1 flex items-center gap-1.5 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2 focus-within:border-[#7B1113]">
                {prefix && <span className="font-inter text-xs text-[#999]">{prefix}</span>}
                <input
                    type="number"
                    min={0}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    suppressHydrationWarning
                    className="w-full min-w-0 bg-transparent font-inter text-sm text-[#2F2F2F] outline-none"
                />
                {suffix && <span className="shrink-0 font-inter text-xs text-[#999]">{suffix}</span>}
            </span>
        </label>
    );
}

function Big({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
    return (
        <div className={`rounded-2xl p-4 ${highlight ? "bg-[#7B1113] text-white" : "bg-[#FAFAFA]"}`}>
            <p className={`font-inter text-xs ${highlight ? "text-white/70" : "text-[#999]"}`}>{label}</p>
            <p className={`mt-1 font-poppins text-xl font-bold ${highlight ? "text-[#C6A971]" : "text-[#2F2F2F]"}`}>{value}</p>
            <p className={`font-inter text-[11px] ${highlight ? "text-white/70" : "text-[#999]"}`}>{sub}</p>
        </div>
    );
}
