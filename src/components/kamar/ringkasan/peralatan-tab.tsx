"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Fan, Lightbulb, Flame, Droplets, Plug, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { type Equipment, type EquipmentType } from "@/lib/broiler-local-store";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { equipmentToServer } from "@/lib/broiler-adapters";
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
    const { room, roomExtra, live, insights, refreshAll, canManage } = data;
    // Tab dipasang ulang setiap dibuka, jadi cukup diisi dari data server saat pertama render.
    const [items, setItems] = useState<Equipment[]>(() => roomExtra.equipment ?? []);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const baseline = useRef(new Map((roomExtra.equipment ?? []).map((e) => [e.id, e])));
    const savingNow = useRef(false);
    useEffect(() => {
        if (dirty || savingNow.current) return;
        setItems(roomExtra.equipment ?? []);
        baseline.current = new Map((roomExtra.equipment ?? []).map((e) => [e.id, e]));
    // A server refresh updates the baseline; typing must not reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomExtra.equipment]);

    if (!room) return null;

    const clock = new Intl.DateTimeFormat("en-GB", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    const expectedKw = items.length ? items.filter((e) => e.schedule ? (e.schedule.start <= e.schedule.end ? clock >= e.schedule.start && clock < e.schedule.end : clock >= e.schedule.start || clock < e.schedule.end) : e.active).reduce((sum, e) => sum + e.count * e.watt, 0) / 1000 : undefined;
    async function editSchedule(e: Equipment) {
        if (!canManage || saving) return;
        const result = await Swal.fire({ title: "Jadwal menyala", text: `${e.name ?? TYPES[e.type].label} · zona ${data.timezone}`, input: "text", inputValue: e.schedule ? `${e.schedule.start}-${e.schedule.end}` : "", inputPlaceholder: "06:00-18:00", inputValidator: (value) => /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? undefined : "Gunakan HH:mm-HH:mm (24 jam).", showCancelButton: true, showDenyButton: true, confirmButtonText: "Simpan jadwal", denyButtonText: "Tanpa jadwal", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
        if (result.isDenied) update(e.id, { schedule: null });
        if (result.isConfirmed) { const [start, end] = String(result.value).trim().split("-"); update(e.id, { schedule: { start, end } }); }
    }

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

    async function handleSave() {
        if (!canManage || savingNow.current) return;
        savingNow.current = true;
        const base = `/api/coops/${room!.id}/equipment`;
        const original = baseline.current;
        const keep = items.filter((e) => e.count > 0);
        const removed = [...original.keys()].filter((id) => !keep.some((e) => e.id === id));
        setSaving(true);
        try {
            for (const e of keep) {
                const before = original.get(e.id);
                if (!before) {
                    const created = await writeData<{ equipment: { id: number } }>("post", base, equipmentToServer(e));
                    const saved = { ...e, id: String(created.equipment.id) };
                    original.set(saved.id, saved);
                    setItems((prev) => prev.map((item) => item.id === e.id ? saved : item));
                }
                else if (JSON.stringify(equipmentToServer(before)) !== JSON.stringify(equipmentToServer(e))) {
                    await writeData("patch", `${base}/${e.id}`, equipmentToServer(e));
                    original.set(e.id, e);
                }
            }
            for (const id of removed) {
                await writeData("delete", `${base}/${id}`);
                original.delete(id);
            }
            setDirty(false);
            Swal.fire({ icon: "success", title: "Peralatan tersimpan", timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            savingNow.current = false;
            setSaving(false);
            refreshAll();
        }
    }

    return (
        <div className="space-y-5">
            <SectionCard>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <p className="font-inter text-xs text-[#999]">Daya seharusnya</p>
                        <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{expectedKw != null ? `${expectedKw.toFixed(2)} kW` : "—"}</p>
                        <p className="mt-1 font-inter text-xs text-[#999]">Klik ikon alat untuk atur jadwal.</p>
                    </div>
                    <div>
                        <p className="font-inter text-xs text-[#999]">Daya terukur sekarang</p>
                        <p className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">{live && insights.actualPowerKw != null ? `${insights.actualPowerKw.toFixed(2)} kW` : "—"}</p>
                        <p className="mt-1 font-inter text-xs text-[#999]">Total daya panel.</p>
                    </div>
                </div>
            </SectionCard>

            <SectionCard className="overflow-hidden p-0!">
                {items.length === 0 ? (
                    <div className="px-6 py-8">
                        <p className="font-inter text-sm text-[#777]">
                            Belum ada peralatan. Tambahkan kipas, lampu, dan pemanas.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-[#F0F0F0]">
                        {items.map((e) => {
                            const Icon = TYPES[e.type].icon;
                            return (
                                <li key={e.id} className={`px-5 py-4 ${e.active ? "" : "opacity-60"}`}>
                                    <div className="flex items-center gap-3">
                                        <button type="button" disabled={!canManage} onClick={() => editSchedule(e)} title="Atur jadwal" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7B1113]/10">
                                            <Icon size={17} className="text-[#7B1113]" />
                                        </button>
                                        <input
                                            value={e.name ?? ""}
                                            onChange={(ev) => update(e.id, { name: ev.target.value || undefined })}
                                            disabled={!canManage}
                                            placeholder={TYPES[e.type].label}
                                            suppressHydrationWarning
                                            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-poppins text-sm font-semibold text-[#2F2F2F] outline-none hover:border-[#EAEAEA] focus:border-[#7B1113]"
                                            aria-label="Nama peralatan"
                                        />
                                        {canManage && <button onClick={() => remove(e.id)} title="Hapus" className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100">
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>}
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
                                                disabled={!canManage}
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
                                                disabled={!canManage}
                                                suppressHydrationWarning
                                                className={`${inputClass} mt-1 py-2`}
                                            />
                                        </label>
                                        <label className="flex flex-col font-inter text-xs text-[#999]">
                                            Aktif
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={e.active}
                                                onClick={() => e.schedule ? void editSchedule(e) : update(e.id, { active: !e.active })}
                                                disabled={!canManage}
                                                suppressHydrationWarning
                                                className={`mt-1 flex h-[42px] items-center justify-center rounded-2xl border font-inter text-sm font-medium transition ${e.active ? "border-green-200 bg-green-50 text-green-700" : "border-[#EAEAEA] bg-[#FAFAFA] text-[#999]"}`}
                                            >
                                                {e.schedule ? `${e.schedule.start}–${e.schedule.end}` : e.active ? "Ya" : "Tidak"}
                                            </button>
                                        </label>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {canManage && <div className="flex flex-wrap gap-2 border-t border-[#F0F0F0] px-5 py-4">
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
                </div>}
            </SectionCard>

            {canManage && <div className="flex items-center justify-between gap-3">
                <p className="font-inter text-xs text-[#999]">Matikan peralatan yang tidak dipakai, misalnya pemanas setelah brooding.</p>
                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    suppressHydrationWarning
                    className="shrink-0 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                >
                    {saving ? "Menyimpan..." : "Simpan"}
                </button>
            </div>}
        </div>
    );
}
