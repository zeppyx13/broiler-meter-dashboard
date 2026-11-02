"use client";

import { useEffect, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Lease, LeaseFormPayload, LeaseUpdatePayload } from "@/types/lease";
import { getTenants } from "@/lib/tenant-api";
import { getRooms } from "@/lib/room-api";

type Props = {
    open: boolean;
    editData: Lease | null;
    onClose: () => void;
    onSubmit: (payload: LeaseFormPayload | LeaseUpdatePayload) => Promise<void>;
};

export default function LeaseFormModal({ open, editData, onClose, onSubmit }: Props) {
    const [form, setForm] = useState({
        user_id: 0,
        room_id: 0,
        start_date: "",
        end_date: "",
        monthly_rent_snapshot: 0,
        status: "active",
        note: "",
    });
    const [loading, setLoading] = useState(false);

    // Fetch tenants (role=tenant, limit semua)
    const { data: tenantData } = useQuery({
        queryKey: ["tenants-dropdown"],
        queryFn: () => getTenants({ role: "tenant", limit: 100 }),
        staleTime: 60 * 1000,
        enabled: open,
    });

    // Fetch kamar tersedia saja (is_available=1)
    const { data: roomData } = useQuery({
        queryKey: ["rooms-available-dropdown"],
        queryFn: () => getRooms({ is_available: "1", limit: 100 }),
        staleTime: 60 * 1000,
        enabled: open,
    });

    const tenants = tenantData?.users ?? [];
    const availableRooms = roomData?.rooms ?? [];

    useEffect(() => {
        if (editData) {
            setForm({
                user_id: editData.user_id,
                room_id: editData.room_id,
                start_date: editData.start_date?.slice(0, 10) ?? "",
                end_date: editData.end_date?.slice(0, 10) ?? "",
                monthly_rent_snapshot: editData.monthly_rent_snapshot,
                status: editData.status,
                note: editData.note ?? "",
            });
        } else {
            setForm({ user_id: 0, room_id: 0, start_date: "", end_date: "", monthly_rent_snapshot: 0, status: "active", note: "" });
        }
    }, [editData, open]);

    // Auto-fill harga sewa dari kamar yang dipilih
    function handleRoomChange(roomId: number) {
        const selected = availableRooms.find((r) => r.id === roomId);
        setForm((prev) => ({
            ...prev,
            room_id: roomId,
            monthly_rent_snapshot: selected?.price_monthly ?? prev.monthly_rent_snapshot,
        }));
    }

    async function handleSubmit() {
        try {
            setLoading(true);
            if (editData) {
                await onSubmit({
                    end_date: form.end_date || null,
                    status: form.status as "active" | "ended",
                    monthly_rent_snapshot: Number(form.monthly_rent_snapshot),
                    note: form.note || null,
                } as LeaseUpdatePayload);
            } else {
                if (!form.user_id || !form.room_id || !form.start_date) return;
                await onSubmit({
                    user_id: form.user_id,
                    room_id: form.room_id,
                    start_date: form.start_date,
                    end_date: form.end_date || null,
                    monthly_rent_snapshot: Number(form.monthly_rent_snapshot),
                    note: form.note || null,
                } as LeaseFormPayload);
            }
        } finally {
            setLoading(false);
        }
    }

    const isSubmitDisabled = loading || (
        !editData && (!form.user_id || !form.room_id || !form.start_date || !form.monthly_rent_snapshot)
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#EAEAEA] px-6 pt-6 pb-4">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">
                        {editData ? "Edit Kontrak" : "Tambah Kontrak"}
                    </h3>
                    <button title="Close" onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                {/* Body scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                    {editData ? (
                        /* Mode Edit — tampilkan info read-only */
                        <div className="rounded-2xl bg-[#F8F8F8] px-4 py-3">
                            <p className="font-inter text-xs text-[#777]">Penghuni · Kamar</p>
                            <p className="mt-0.5 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                {editData.tenant_name} · Kamar {editData.room_number}
                            </p>
                        </div>
                    ) : (
                        /* Mode Tambah — dropdown tenant & kamar */
                        <>
                            {/* Pilih Tenant */}
                            <div>
                                <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                    Penghuni <span className="text-red-500">*</span>
                                </label>
                                <select
                                    title="Penghuni"
                                    value={form.user_id || ""}
                                    onChange={(e) => setForm({ ...form, user_id: Number(e.target.value) })}
                                    suppressHydrationWarning
                                    className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                                >
                                    <option value="">-- Pilih Penghuni --</option>
                                    {tenants.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} — {t.email}
                                        </option>
                                    ))}
                                </select>
                                {tenants.length === 0 && (
                                    <p className="mt-1 font-inter text-xs text-[#999]">
                                        Tidak ada tenant tersedia atau sedang memuat...
                                    </p>
                                )}
                            </div>

                            {/* Pilih Kamar */}
                            <div>
                                <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                    Kamar <span className="text-red-500">*</span>
                                </label>
                                <select
                                    title="kamar"
                                    value={form.room_id || ""}
                                    onChange={(e) => handleRoomChange(Number(e.target.value))}
                                    suppressHydrationWarning
                                    className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                                >
                                    <option value="">-- Pilih Kamar Tersedia --</option>
                                    {availableRooms.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            Kamar {r.number}
                                            {r.floor ? ` · Lantai ${r.floor}` : ""} —{" "}
                                            {new Intl.NumberFormat("id-ID", {
                                                style: "currency",
                                                currency: "IDR",
                                                minimumFractionDigits: 0,
                                            }).format(r.price_monthly)}
                                        </option>
                                    ))}
                                </select>
                                {availableRooms.length === 0 && (
                                    <p className="mt-1 font-inter text-xs text-orange-500">
                                        Tidak ada kamar yang tersedia saat ini.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Tanggal Mulai & Berakhir */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Tanggal Mulai <span className="text-red-500">*</span>
                            </label>
                            <input
                                title="date"
                                type="date"
                                value={form.start_date}
                                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                disabled={!!editData}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113] disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Tanggal Berakhir
                            </label>
                            <input
                                title="date"
                                type="date"
                                value={form.end_date}
                                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                    </div>

                    {/* Sewa/Bulan + Status (edit only) */}
                    <div className={`grid gap-3 ${editData ? "grid-cols-2" : "grid-cols-1"}`}>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Sewa / Bulan <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.monthly_rent_snapshot || ""}
                                onChange={(e) => setForm({ ...form, monthly_rent_snapshot: Number(e.target.value) })}
                                suppressHydrationWarning
                                placeholder="Auto-fill saat pilih kamar"
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                            {!editData && form.room_id > 0 && (
                                <p className="mt-1 font-inter text-xs text-green-600">
                                    ✓ Auto-fill dari harga kamar
                                </p>
                            )}
                        </div>
                        {editData && (
                            <div>
                                <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Status</label>
                                <select
                                    title="Status"
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    suppressHydrationWarning
                                    className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                                >
                                    <option value="active">Aktif</option>
                                    <option value="ended">Berakhir</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Catatan */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Catatan</label>
                        <textarea
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            placeholder="Opsional..."
                            rows={2}
                            className="w-full resize-none rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-[#EAEAEA] px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitDisabled}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <LoaderCircle size={15} className="animate-spin" />}
                        {editData ? "Simpan Perubahan" : "Buat Kontrak"}
                    </button>
                </div>
            </div>
        </div>
    );
}