"use client";

import { useQuery } from "@tanstack/react-query";
import { getRooms } from "@/lib/room-api";
import { getMeters } from "@/lib/meter-api";
import { useEffect, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { Meter, MeterFormPayload, MeterUpdatePayload } from "@/types/meter";

type Props = {
    open: boolean;
    editData: Meter | null;
    onClose: () => void;
    onSubmit: (payload: MeterFormPayload | MeterUpdatePayload) => Promise<void>;
};

export default function MeterFormModal({ open, editData, onClose, onSubmit }: Props) {
    const [form, setForm] = useState({
        room_id: "",
        type: "water" as "water" | "electricity",
        device_uid: "",
        unit: "m3" as "m3" | "kwh",
        is_active: true,
        installed_at: "",
    });
    const [loading, setLoading] = useState(false);

    // Fetch semua kamar
    const { data: roomData } = useQuery({
        queryKey: ["rooms-all-dropdown"],
        queryFn: () => getRooms({ limit: 100 }),
        staleTime: 60 * 1000,
        enabled: open && !editData,
    });

    const { data: meterData } = useQuery({
        queryKey: ["meters"],
        queryFn: () => getMeters(),
        staleTime: 30 * 1000,
        enabled: open && !editData,
    });

    const allRooms = roomData?.rooms ?? [];
    const existingMeters = meterData?.meters ?? [];

    const availableRooms = allRooms.filter((room) => {
        const hasThisType = existingMeters.some(
            (m) => m.room_id === room.id && m.type === form.type
        );
        return !hasThisType;
    });

    useEffect(() => {
        if (editData) {
            setForm({
                room_id: String(editData.room_id),
                type: editData.type,
                device_uid: editData.device_uid,
                unit: editData.unit,
                is_active: Boolean(editData.is_active),
                installed_at: editData.installed_at?.slice(0, 16) ?? "",
            });
        } else {
            setForm({
                room_id: "",
                type: "water",
                device_uid: "",
                unit: "m3",
                is_active: true,
                installed_at: "",
            });
        }
    }, [editData, open]);

    // Reset room_id saat tipe berubah karena daftar kamar tersedia berubah
    function handleTypeChange(type: "water" | "electricity") {
        setForm((prev) => ({
            ...prev,
            type,
            unit: type === "water" ? "m3" : "kwh",
            room_id: "", // reset pilihan kamar
        }));
    }

    async function handleSubmit() {
        if (!form.device_uid.trim()) return;
        try {
            setLoading(true);
            if (editData) {
                await onSubmit({
                    device_uid: form.device_uid,
                    unit: form.unit,
                    is_active: form.is_active,
                    installed_at: form.installed_at
                        ? new Date(form.installed_at).toISOString()
                        : null,
                } as MeterUpdatePayload);
            } else {
                await onSubmit({
                    room_id: Number(form.room_id),
                    type: form.type,
                    device_uid: form.device_uid,
                    unit: form.unit,
                    is_active: form.is_active,
                    installed_at: form.installed_at
                        ? new Date(form.installed_at).toISOString()
                        : null,
                } as MeterFormPayload);
            }
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">
                        {editData ? "Edit Alat IoT" : "Daftarkan Alat IoT"}
                    </h3>
                    <button title="close" onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    {/* Info kamar saat edit */}
                    {editData && (
                        <div className="rounded-2xl bg-[#F8F8F8] px-4 py-3">
                            <p className="font-inter text-xs text-[#777]">Dipasang di</p>
                            <p className="mt-0.5 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                Kamar {editData.room_number}
                                {editData.room_floor ? ` · Lantai ${editData.room_floor}` : ""}
                            </p>
                        </div>
                    )}

                    {/* Tipe sensor — tampil duluan agar filter kamar akurat */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Tipe Sensor <span className="text-red-500">*</span>
                        </label>
                        <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA]">
                            {(["water", "electricity"] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    disabled={!!editData}
                                    onClick={() => handleTypeChange(t)}
                                    suppressHydrationWarning
                                    className={`flex-1 py-3 font-inter text-sm transition-colors disabled:opacity-60 ${form.type === t
                                        ? "bg-[#7B1113] text-white"
                                        : "bg-[#FAFAFA] text-[#666] hover:bg-[#F0F0F0]"
                                        }`}
                                >
                                    {t === "water" ? "💧 Air" : "⚡ Listrik"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dropdown Kamar — hanya saat tambah baru */}
                    {!editData && (
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Kamar <span className="text-red-500">*</span>
                            </label>
                            <select
                                title="kamar"
                                value={form.room_id}
                                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            >
                                <option value="">-- Pilih Kamar --</option>
                                {availableRooms.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        Kamar {r.number}{r.floor ? ` · Lantai ${r.floor}` : ""}
                                    </option>
                                ))}
                            </select>
                            {availableRooms.length === 0 && allRooms.length > 0 && (
                                <p className="mt-1 font-inter text-xs text-orange-500">
                                    Semua kamar sudah memiliki sensor {form.type === "water" ? "air" : "listrik"}.
                                </p>
                            )}
                            {allRooms.length === 0 && (
                                <p className="mt-1 font-inter text-xs text-[#999]">Memuat kamar...</p>
                            )}
                        </div>
                    )}

                    {/* Device UID */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Device UID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.device_uid}
                            onChange={(e) => setForm({ ...form, device_uid: e.target.value })}
                            suppressHydrationWarning
                            placeholder="cth. esp32_room3_water"
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm font-mono outline-none transition focus:border-[#7B1113]"
                        />
                        <p className="mt-1 font-inter text-xs text-[#999]">
                            Harus unik. Sesuai dengan konfigurasi di firmware ESP32.
                        </p>
                    </div>

                    {/* Unit + Tanggal Pasang */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Unit</label>
                            <select
                                title="unit"
                                value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value as "m3" | "kwh" })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            >
                                <option value="m3">m³ (Air)</option>
                                <option value="kwh">kWh (Listrik)</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Tanggal Pasang
                            </label>
                            <input
                                title="tanggal pasang"
                                type="datetime-local"
                                value={form.installed_at}
                                onChange={(e) => setForm({ ...form, installed_at: e.target.value })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                    </div>

                    {/* Toggle aktif — fix posisi thumb */}
                    <div className="flex items-center gap-3">
                        <button
                            title="toggle aktif"
                            type="button"
                            onClick={() => setForm({ ...form, is_active: !form.is_active })}
                            suppressHydrationWarning
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.is_active ? "bg-[#7B1113]" : "bg-[#D1D1D1]"
                                }`}
                        >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-0.5" : "-translate-x-full"
                                }`} />
                        </button>
                        <span className="font-inter text-sm text-[#555]">
                            {form.is_active ? "Aktif — menerima data dari ESP32" : "Nonaktif"}
                        </span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !form.device_uid.trim() || (!editData && !form.room_id)}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <LoaderCircle size={15} className="animate-spin" />}
                        {editData ? "Simpan" : "Daftarkan"}
                    </button>
                </div>
            </div>
        </div>
    );
}