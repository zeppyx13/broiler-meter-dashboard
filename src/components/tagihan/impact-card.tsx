"use client";

import { useEffect, useMemo, useState } from "react";
import { HandCoins, ShieldAlert } from "lucide-react";
import { useKandangSnapshots } from "@/lib/kandang-snapshot";
import { formatRupiah } from "@/lib/broiler-reference";
import { DEFAULT_IMPACT_SETTINGS, DEVICE_LIFETIME_YEARS, farmEconomics, getImpactSettings, kandangImpact, setImpactSettings, type ImpactSettings } from "@/lib/impact";
import { useGuard } from "@/components/dashboard/guard/guard-monitor";

const num = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const EVIDENCE_DAYS = 30;

const EVENT_LABEL: Record<string, string> = {
    power: "Daya panel turun (cek kipas/pemanas)",
    offline: "Data terputus (cek listrik/internet)",
    voltage: "Tegangan tidak stabil",
    water: "Air minum tidak normal",
};

const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${num(Math.abs(v) * 100)}%`);
const months = (v: number | null) => (v == null ? "Tidak tercapai" : v < 1 ? "< 1 bulan" : `±${num(v, 1)} bulan`);

/** Kartu dampak: manfaat per tahun dibanding perangkat DAN semua biaya berjalan (internet, server, AI, perawatan). */
export default function ImpactCard() {
    const [settings, setSettings] = useState<ImpactSettings>(DEFAULT_IMPACT_SETTINGS);
    // Asumsi tersimpan di browser → dibaca setelah mount agar HTML server & klien sama.
    useEffect(() => setSettings(getImpactSettings()), []);
    const { active, history } = useGuard();
    const [sinceMs] = useState(() => Date.now() - EVIDENCE_DAYS * 86_400_000);

    const { snapshots } = useKandangSnapshots();

    const rows = useMemo(() => snapshots
        .filter((s) => s.cycle)
        .map((s) => {
            const population = s.populationNow ?? 0;
            // Bobot panen acuan dari pengaturan (default 1,73 kg Kementan); bobot sampel per siklus ada di laporan siklus.
            const harvestKg = settings.harvestWeightKg;
            return { lease: s.cycle!, number: s.room.number, population, harvestKg, impact: kandangImpact(population, harvestKg, settings) };
        })
        .sort((a, c) => a.number.localeCompare(c.number, "id", { numeric: true })), [snapshots, settings]);

    const economics = useMemo(() => farmEconomics(rows, settings), [rows, settings]);

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
                Manfaat setahun (kematian dicegah × bobot panen × harga, ditambah hemat listrik) dibanding biaya perangkat dan semua biaya berjalan lahan: internet, server, AI, dan perawatan.
            </p>

            {/* Asumsi */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AssumptionInput label="Harga ayam hidup" prefix="Rp" suffix="/kg" value={settings.pricePerKg} step={500} onChange={(v) => update("pricePerKg", v)} />
                <AssumptionInput label="Kematian dicegah" suffix="% / siklus" value={settings.preventedMortalityPct} step={0.5} onChange={(v) => update("preventedMortalityPct", v)} />
                <AssumptionInput label="Biaya perangkat" prefix="Rp" suffix="/kandang" value={settings.deviceCost} step={10_000} onChange={(v) => update("deviceCost", v)} />
                <AssumptionInput label="Siklus + istirahat" suffix="hari" value={settings.cycleDays} step={1} onChange={(v) => update("cycleDays", v)} />
                <AssumptionInput label="Bobot panen" suffix="kg/ekor" value={settings.harvestWeightKg} step={0.05} onChange={(v) => update("harvestWeightKg", v)} />
                <AssumptionInput label="Hemat listrik (hasil uji)" prefix="Rp" suffix="/kandang/siklus" value={settings.electricitySavingPerCycle} step={5_000} onChange={(v) => update("electricitySavingPerCycle", v)} />
                <AssumptionInput label="Langganan internet, server, AI" prefix="Rp" suffix="/lahan/bulan" value={settings.opexMonthly} step={5_000} onChange={(v) => update("opexMonthly", v)} />
                <AssumptionInput label="Perawatan perangkat" prefix="Rp" suffix="/kandang/tahun" value={settings.maintenancePerYear} step={10_000} onChange={(v) => update("maintenancePerYear", v)} />
            </div>

            {rows.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#FAFAFA] px-4 py-6 text-center font-inter text-sm text-[#999]">Belum ada siklus berjalan untuk dihitung.</p>
            ) : (
                <>
                    {/* Ringkasan */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Big
                            label="Manfaat / tahun"
                            value={formatRupiah(economics.benefitPerYear)}
                            sub={`±${num(economics.cyclesPerYear, 1)} siklus × (${formatRupiah(economics.mortalityValuePerCycle)} ayam + ${formatRupiah(economics.electricityPerCycle)} listrik)`}
                        />
                        <Big
                            label="Investasi + operasional / tahun"
                            value={formatRupiah(economics.investment + economics.opexPerYear)}
                            sub={`perangkat ${formatRupiah(economics.investment)} · operasional ${formatRupiah(economics.opexPerYear)}`}
                        />
                        <Big label="ROI tahun pertama" value={pct(economics.roiFirstYear)} sub="(manfaat − operasional − investasi) ÷ (investasi + operasional)" />
                        <Big label="Balik modal" value={months(economics.paybackMonths)} sub="sudah termasuk biaya operasional" highlight />
                    </div>
                    <p className={`mt-3 rounded-2xl px-4 py-3 font-inter text-xs ${economics.paybackMonths == null ? "bg-[#FBEDED] text-[#7B1113]" : "bg-[#FAFAFA] text-[#555]"}`}>
                        {economics.breakEvenPopulation != null
                            ? `Titik impas ±${num(economics.breakEvenPopulation)} ekor per kandang (perangkat disusutkan ${DEVICE_LIFETIME_YEARS} tahun, ${economics.kandangCount} kandang berbagi satu langganan). `
                            : "Titik impas belum bisa dihitung: isi kematian dicegah atau hemat listrik. "}
                        {economics.paybackMonths == null && "Biaya operasional lebih besar dari manfaat: gabungkan beberapa kandang dalam satu lahan agar langganan dipakai bersama."}
                    </p>

                    {/* Per kandang */}
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[520px] font-inter text-sm">
                            <thead>
                                <tr className="border-b border-[#EAEAEA] text-left text-xs text-[#999]">
                                    <th className="py-2 font-medium">Kandang</th>
                                    <th className="py-2 text-right font-medium">Populasi</th>
                                    <th className="py-2 text-right font-medium">Bobot panen</th>
                                    <th className="py-2 text-right font-medium">Nilai / siklus</th>
                                    <th className="py-2 text-right font-medium">Balik modal alat*</th>
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
                        <p className="mt-1 font-inter text-[11px] text-[#AAA]">*Hanya harga perangkat ÷ nilai kematian dicegah, belum termasuk langganan dan perawatan.</p>
                    </div>

                    {/* Sensitivitas */}
                    <div className="mt-4 rounded-2xl bg-[#FAFAFA] p-4">
                        <p className="font-inter text-xs font-medium text-[#555]">Bila kematian yang dicegah berbeda:</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            {[0.5, 1, 2].map((mortality) => {
                                const e = farmEconomics(rows, settings, mortality);
                                return (
                                    <div key={mortality} className={`rounded-xl px-3 py-2 ${mortality === settings.preventedMortalityPct ? "bg-white ring-1 ring-[#7B1113]/30" : "bg-white"}`}>
                                        <p className="font-inter text-[11px] text-[#999]">{num(mortality, 1)}% dicegah</p>
                                        <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">ROI {pct(e.roiFirstYear)}</p>
                                        <p className="font-inter text-[11px] text-[#777]">balik modal: {months(e.paybackMonths)}</p>
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
                    Angka di atas adalah estimasi dari asumsi yang bisa diubah, bukan hasil uji lapangan. Default: Rp19.500/kg (HAP Juli 2026), bobot 1,73 kg (Kementan 2024), langganan ±Rp195rb/bulan (internet ±Rp100rb, server ±Rp87rb, AI ±Rp8rb; HiveMQ Cloud & Telegram Bot gratis). Hemat listrik diisi dari hasil uji efisiensi. Kejadian nyata (kipas mati saat siang panas, listrik padam malam hari) bisa menyebabkan kematian jauh di atas 1%.
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
