"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { Panel, buttonStyle } from "@/components/broiler/ui";
import { useKandangSnapshots } from "@/lib/kandang-snapshot";
import { DEFAULT_IMPACT_SETTINGS, farmEconomics, getImpactSettings, type ImpactSettings } from "@/lib/impact";
import { formatRupiah } from "@/lib/broiler-reference";
import ImpactSummary from "./impact-summary";

type Scenario = {
    kandangCount: number;
    population: number;
    cycleDays: number;
    deviceCost: number;
    opexMonthly: number;
    maintenancePerYear: number;
    pricePerKg: number;
    harvestWeightKg: number;
    preventedMortalityPct: number;
    electricityRate: number;
    waterRate: number;
    electricitySavedKwh: number;
    waterSavedM3: number;
};
type Field = { key: keyof Scenario; label: string; unit: string; min?: number; max?: number; integer?: boolean };
const GROUPS: { title: string; hint?: string; fields: Field[] }[] = [
    { title: "Kandang & siklus", hint: "Populasi diasumsikan sama di setiap kandang.", fields: [
        { key: "kandangCount", label: "Jumlah kandang", unit: "kandang", min: 1, max: 10_000, integer: true },
        { key: "population", label: "Populasi per kandang", unit: "ekor", max: 10_000_000, integer: true },
        { key: "cycleDays", label: "Siklus + istirahat", unit: "hari", min: 1, max: 3650, integer: true },
    ] },
    { title: "Investasi & biaya operasional", fields: [
        { key: "deviceCost", label: "Biaya perangkat", unit: "Rp/kandang" },
        { key: "opexMonthly", label: "Langganan internet, server, AI", unit: "Rp/lahan/bulan" },
        { key: "maintenancePerYear", label: "Perawatan perangkat", unit: "Rp/kandang/tahun" },
    ] },
    { title: "Nilai ayam & kematian dicegah", fields: [
        { key: "pricePerKg", label: "Harga ayam hidup", unit: "Rp/kg" },
        { key: "harvestWeightKg", label: "Bobot panen", unit: "kg/ekor", max: 100 },
        { key: "preventedMortalityPct", label: "Kematian dicegah", unit: "%/siklus", max: 100 },
    ] },
    { title: "Tarif & estimasi penghematan", hint: "Penghematan per kandang per siklus dikalikan tarif untuk menghitung manfaat. Isi dari estimasi atau hasil uji Anda.", fields: [
        { key: "electricityRate", label: "Tarif listrik", unit: "Rp/kWh" },
        { key: "waterRate", label: "Tarif air", unit: "Rp/m³" },
        { key: "electricitySavedKwh", label: "Estimasi hemat listrik", unit: "kWh/kandang/siklus" },
        { key: "waterSavedM3", label: "Estimasi hemat air", unit: "m³/kandang/siklus" },
    ] },
];
const FIELDS = GROUPS.flatMap(group => group.fields);
type Values = Record<keyof Scenario, string>;
const subscribeHydration = () => () => {};

function fieldError(field: Field, raw: string) {
    if (raw.trim() === "") return "Wajib diisi.";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < (field.min ?? 0) || value > (field.max ?? 1_000_000_000_000)) {
        return `Isi angka antara ${(field.min ?? 0).toLocaleString("id-ID")} dan ${(field.max ?? 1_000_000_000_000).toLocaleString("id-ID")}.`;
    }
    return field.integer && !Number.isInteger(value) ? "Gunakan bilangan bulat." : null;
}

function safeSetting(settings: ImpactSettings, key: keyof ImpactSettings) {
    const value = settings[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : DEFAULT_IMPACT_SETTINGS[key] ?? 0;
}

export default function RoiSimulation() {
    const b = useBroiler();
    const { snapshots, tariff, isLoading, isError } = useKandangSnapshots();
    const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-poppins text-2xl font-bold text-[#2F2F2F]">Simulasi Balik Modal</h1>
                    <p className="mt-1 font-inter text-sm text-[#777]">Bandingkan manfaat dan biaya COASTHER sesuai skala kandang Anda.</p>
                </div>
                <Link href="/dashboard/tagihan" className={`${buttonStyle} gap-2`}>
                    <ArrowLeft size={16} aria-hidden="true" /> Kembali ke Laporan
                </Link>
            </div>
            {!hydrated || isLoading ? (
                <p role="status" className="rounded-3xl border border-[#EAEAEA] bg-white p-6 font-inter text-sm">Menyiapkan asumsi simulasi…</p>
            ) : (
                <SimulationForm
                    key={`${b.user?.id}:${b.farmId}`}
                    initialSettings={getImpactSettings()}
                    activePopulations={snapshots.filter(s => s.cycle).map(s => s.populationNow ?? 0)}
                    electricityRate={tariff?.electricity_rate ?? 0}
                    waterRate={tariff?.water_rate ?? 0}
                    missingData={isError || !snapshots.some(s => s.cycle)}
                />
            )}
        </>
    );
}

function SimulationForm({ initialSettings, activePopulations, electricityRate, waterRate, missingData }: {
    initialSettings: ImpactSettings; activePopulations: number[]; electricityRate: number; waterRate: number; missingData: boolean;
}) {
    const [initialValues] = useState<Values>(() => {
        const initial: Scenario = {
            kandangCount: activePopulations.length || 1,
            population: activePopulations.length ? Math.round(activePopulations.reduce((sum, population) => sum + population, 0) / activePopulations.length) : 500,
            cycleDays: safeSetting(initialSettings, "cycleDays"),
            deviceCost: safeSetting(initialSettings, "deviceCost"),
            opexMonthly: safeSetting(initialSettings, "opexMonthly"),
            maintenancePerYear: safeSetting(initialSettings, "maintenancePerYear"),
            pricePerKg: safeSetting(initialSettings, "pricePerKg"),
            harvestWeightKg: safeSetting(initialSettings, "harvestWeightKg"),
            preventedMortalityPct: safeSetting(initialSettings, "preventedMortalityPct"),
            electricityRate: Number.isFinite(electricityRate) && electricityRate >= 0 ? electricityRate : 0,
            waterRate: Number.isFinite(waterRate) && waterRate >= 0 ? waterRate : 0,
            electricitySavedKwh: electricityRate > 0 ? safeSetting(initialSettings, "electricitySavingPerCycle") / electricityRate : 0,
            waterSavedM3: waterRate > 0 ? safeSetting(initialSettings, "waterSavingPerCycle") / waterRate : 0,
        };
        return Object.fromEntries(FIELDS.map(field => {
            const raw = String(initial[field.key]);
            return [field.key, fieldError(field, raw) ? String(field.min ?? 0) : raw];
        })) as Values;
    });
    // Seluruh perubahan skenario hanya hidup di state halaman ini.
    const [values, setValues] = useState(initialValues);
    const invalid = FIELDS.some(field => fieldError(field, values[field.key]));
    const scenario = Object.fromEntries(FIELDS.map(field => [field.key, Number(values[field.key])])) as Scenario;
    const settings: ImpactSettings = {
        pricePerKg: scenario.pricePerKg,
        harvestWeightKg: scenario.harvestWeightKg,
        preventedMortalityPct: scenario.preventedMortalityPct,
        deviceCost: scenario.deviceCost,
        cycleDays: scenario.cycleDays,
        opexMonthly: scenario.opexMonthly,
        maintenancePerYear: scenario.maintenancePerYear,
        electricitySavingPerCycle: scenario.electricitySavedKwh * scenario.electricityRate,
        waterSavingPerCycle: scenario.waterSavedM3 * scenario.waterRate,
    };
    const economics = invalid ? null : farmEconomics(
        Array.from({ length: scenario.kandangCount }, () => ({ population: scenario.population, harvestKg: scenario.harvestWeightKg })), settings,
    );

    return (
        <>
            <div className="rounded-2xl border border-[#E8D9BD] bg-[#F8F1E7] px-5 py-4 font-inter text-sm text-[#7A5C1E]">
                Perubahan hanya untuk simulasi dan tidak disimpan. Data kandang, tarif aktual, dan Laporan tetap menggunakan data semula.
                {missingData && <p className="mt-2 text-xs">Belum ada data siklus aktif yang dapat digunakan. Mulai dari contoh 1 kandang dengan 500 ekor, lalu sesuaikan asumsi Anda.</p>}
            </div>
            <Panel title="Ubah asumsi" action={
                <button type="button" onClick={() => setValues(initialValues)} className="inline-flex items-center gap-2 rounded-xl border border-[#EAEAEA] px-4 py-2.5 font-inter text-sm text-[#7B1113] hover:bg-[#FAFAFA]">
                    <RotateCcw size={15} aria-hidden="true" /> Reset asumsi
                </button>
            }>
                <div className="space-y-6">
                    {GROUPS.map(group => (
                        <fieldset key={group.title} className="min-w-0">
                            <legend className="font-poppins text-sm font-semibold text-[#2F2F2F]">{group.title}</legend>
                            {group.hint && <p className="mt-1 font-inter text-xs text-[#999]">{group.hint}</p>}
                            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {group.fields.map(field => {
                                    const error = fieldError(field, values[field.key]);
                                    return (
                                        <label key={field.key} className="block min-w-0">
                                            <span className="font-inter text-xs text-[#777]">{field.label}</span>
                                            <input type="number" aria-label={field.label} aria-invalid={Boolean(error)} aria-describedby={`${field.key}-unit${error ? ` ${field.key}-error` : ""}`}
                                                min={field.min ?? 0} max={field.max ?? 1_000_000_000_000} step={field.integer ? 1 : "any"}
                                                value={values[field.key]} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))}
                                                className={`mt-1 w-full min-w-0 rounded-xl border bg-[#FAFAFA] px-3 py-2.5 font-inter text-sm text-[#2F2F2F] outline-none focus:border-[#7B1113] ${error ? "border-red-400" : "border-[#EAEAEA]"}`} />
                                            <span id={`${field.key}-unit`} className="mt-1 block font-inter text-[11px] text-[#999]">{field.unit}</span>
                                            {error && <span id={`${field.key}-error`} role="alert" className="mt-1 block font-inter text-xs text-[#7B1113]">{error}</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    ))}
                </div>
            </Panel>
            <Panel title="Hasil simulasi">
                {economics ? <>
                    <ImpactSummary economics={economics} />
                    <div className="mt-4 grid gap-3 font-inter text-xs text-[#777] sm:grid-cols-3">
                        <p>Hemat listrik: <strong className="text-[#2F2F2F]">{formatRupiah(economics.electricityPerCycle)}</strong> / siklus</p>
                        <p>Hemat air: <strong className="text-[#2F2F2F]">{formatRupiah(economics.waterPerCycle)}</strong> / siklus</p>
                        <p>Biaya operasional: <strong className="text-[#2F2F2F]">{formatRupiah(economics.opexPerYear)}</strong> / tahun</p>
                    </div>
                </> : <p role="status" className="font-inter text-sm text-[#7B1113]">Lengkapi asumsi dengan angka yang valid untuk melihat hasil simulasi.</p>}
                <details className="mt-5 rounded-2xl bg-[#FAFAFA] p-4 font-inter text-xs text-[#777]">
                    <summary className="cursor-pointer font-medium text-[#7B1113]">Dasar perhitungan</summary>
                    <div className="mt-3 space-y-2">
                        <p>Manfaat tahunan mencakup nilai kematian yang diperkirakan dicegah serta penghematan air dan listrik. Jumlah siklus per tahun = 365 ÷ (durasi siklus + istirahat).</p>
                        <p>ROI tahun pertama = (manfaat tahunan − investasi − operasional tahunan) ÷ (investasi + operasional tahunan). Langganan dipakai bersama dalam satu lahan; perawatan dihitung per kandang.</p>
                        <p>Balik modal menggunakan manfaat bersih setelah operasional. Titik impas mengasumsikan penghematan sebanding populasi. Angka simulasi merupakan estimasi, bukan bukti hasil lapangan.</p>
                    </div>
                </details>
            </Panel>
        </>
    );
}
