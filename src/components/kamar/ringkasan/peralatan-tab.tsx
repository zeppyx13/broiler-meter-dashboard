"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { Fan, Lightbulb, Flame, Droplets, Plug, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { getExpectedPowerKw, setRoomExtra, type Equipment, type EquipmentType } from "@/lib/broiler-local-store";
import { inputClass } from "./form-parts";
import type { KandangData } from "./use-kandang-data";

// Watt awal per jenis — hanya titik mulai, peternak menyesuaikan dengan label alat.
const TYPES: Record<EquipmentType, { label: string; icon: LucideIcon; watt: number }> = {
    kipas: { label: "Kipas", icon: Fan, watt: 750 },
    lampu: { label: "Lampu", icon: Lightbulb, watt: 15 },
    pemanas: { label: "Pemanas", icon: Flame, watt: 1000 },
    pompa: { label: "Pompa air", icon: Droplets, watt: 375 },
    lainnya: { label: "Lainnya", icon: Plug, watt: 100 },
};

function newId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function PeralatanTab({ data }: { data: KandangData }) {
    const { room, roomExtra, live, insights, refreshLocal } = data;
    // Tab dipasang ulang setiap dibuka, jadi cukup diisi dari data tersimpan saat pertama render.
    const [items, setItems] = useState<Equipment[]>(() => roomExtra.equipment ?? []);
    const [manualKw, setManualKw] = useState(() => (roomExtra.expected_power_kw != null ? String(roomExtra.expected_power_kw) : ""));
    const [dirty, setDirty] = useState(false);

    if (!room) return null;

    const expectedKw = getExpectedPowerKw({ equipment: items, expected_power_kw: manualKw ? Number(manualKw) : undefined });

    function update(id: string, patch: Partial<Equipment>) {
        setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
        setDirty(true);
    }

    function add(type: EquipmentType) {
        setItems((prev) => [...prev, { id: newId(), type, count: 1, watt: TYPES[type].watt, active: true }]);
        setDirty(true);
    }

    function remove(id: string) {
        setItems((prev) => prev.filter((e) => e.id !== id));
        setDirty(true);
    }

    function handleSave() {
        setRoomExtra(room!.id, {
            equipment: items.filter((e) => e.count > 0 && e.watt > 0),
            expected_power_kw: manualKw ? Number(manualKw) : undefined,
        });
        refreshLocal();
        setDirty(false);
        Swal.fire({ icon: "success", title: "Peralatan tersimpan", timer: 1200, showConfirmButton: false });
    }

    return (
        <div className="space-y-5">
            <SectionCard>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <p className="font-inter text-xs text-[#999]">Daya seharusnya</p>
                        <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{expectedKw != null ? `${expectedKw.toFixed(2)} kW` : "—"}</p>
                        <p className="mt-1 font-inter text-xs text-[#999]">Jumlah dari peralatan yang ditandai menyala.</p>
                    </div>
                    <div>
                        <p className="font-inter text-xs text-[#999]">Daya terukur sekarang</p>
                        <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{live ? `${insights.actualPowerKw.toFixed(2)} kW` : "—"}</p>
                        <p className="mt-1 font-inter text-xs text-[#999]">Guard memberi peringatan bila jauh di bawah daya seharusnya (misal kipas mati).</p>
                    </div>
                </div>
            </SectionCard>

            <SectionCard className="overflow-hidden p-0!">
                {items.length === 0 ? (
                    <div className="px-6 py-8">
                        <p className="font-inter text-sm text-[#777]">Belum ada peralatan. Tambahkan kipas, lampu, dan pemanas di kandang ini, atau isi total dayanya saja.</p>
                        <div className="mt-4 max-w-xs">
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Total daya terpasang (kW)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={manualKw}
                                onChange={(e) => { setManualKw(e.target.value); setDirty(true); }}
                                placeholder="cth. 6.0"
                                suppressHydrationWarning
                                className={inputClass}
                            />
                        </div>
                    </div>
                ) : (
                    <ul className="divide-y divide-[#F0F0F0]">
                        {items.map((e) => {
                            const Icon = TYPES[e.type].icon;
                            return (
                                <li key={e.id} className={`px-5 py-4 ${e.active ? "" : "opacity-60"}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7B1113]/10">
                                            <Icon size={17} className="text-[#7B1113]" />
                                        </span>
                                        <input
                                            value={e.name ?? ""}
                                            onChange={(ev) => update(e.id, { name: ev.target.value || undefined })}
                                            placeholder={TYPES[e.type].label}
                                            suppressHydrationWarning
                                            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-poppins text-sm font-semibold text-[#2F2F2F] outline-none hover:border-[#EAEAEA] focus:border-[#7B1113]"
                                            aria-label="Nama peralatan"
                                        />
                                        <button onClick={() => remove(e.id)} title="Hapus" className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100">
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-3 sm:pl-12">
                                        <label className="font-inter text-xs text-[#999]">
                                            Jumlah
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                value={e.count}
                                                onChange={(ev) => update(e.id, { count: Math.max(0, Number(ev.target.value) || 0) })}
                                                suppressHydrationWarning
                                                className={`${inputClass} mt-1 py-2`}
                                            />
                                        </label>
                                        <label className="font-inter text-xs text-[#999]">
                                            Watt / unit
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                value={e.watt}
                                                onChange={(ev) => update(e.id, { watt: Math.max(0, Number(ev.target.value) || 0) })}
                                                suppressHydrationWarning
                                                className={`${inputClass} mt-1 py-2`}
                                            />
                                        </label>
                                        <label className="flex flex-col font-inter text-xs text-[#999]">
                                            Menyala
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={e.active}
                                                onClick={() => update(e.id, { active: !e.active })}
                                                suppressHydrationWarning
                                                className={`mt-1 flex h-[42px] items-center justify-center rounded-2xl border font-inter text-sm font-medium transition ${e.active ? "border-green-200 bg-green-50 text-green-700" : "border-[#EAEAEA] bg-[#FAFAFA] text-[#999]"}`}
                                            >
                                                {e.active ? "Ya" : "Tidak"}
                                            </button>
                                        </label>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="flex flex-wrap gap-2 border-t border-[#F0F0F0] px-5 py-4">
                    {(Object.keys(TYPES) as EquipmentType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => add(type)}
                            suppressHydrationWarning
                            className="flex items-center gap-1.5 rounded-2xl border border-[#EAEAEA] px-3.5 py-2 font-inter text-sm text-[#555] transition hover:border-[#7B1113]/30 hover:text-[#7B1113]"
                        >
                            <Plus size={14} /> {TYPES[type].label}
                        </button>
                    ))}
                </div>
            </SectionCard>

            <div className="flex items-center justify-between gap-3">
                <p className="font-inter text-xs text-[#999]">Matikan &quot;Menyala&quot; untuk peralatan yang memang sedang tidak dipakai (misal pemanas setelah masa brooding).</p>
                <button
                    onClick={handleSave}
                    disabled={!dirty}
                    suppressHydrationWarning
                    className="shrink-0 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                >
                    Simpan
                </button>
            </div>
        </div>
    );
}
