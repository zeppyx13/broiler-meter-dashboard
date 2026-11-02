"use client";

import { useEffect, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { Tenant, TenantFormPayload } from "@/types/tenant";

type Props = {
    open: boolean;
    editData: Tenant | null;
    onClose: () => void;
    onSubmit: (payload: TenantFormPayload) => Promise<void>;
};

export default function TenantFormModal({ open, editData, onClose, onSubmit }: Props) {
    const [form, setForm] = useState<TenantFormPayload>({ name: "", phone: "", role: "tenant" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editData) {
            setForm({ name: editData.name, phone: editData.phone ?? "", role: editData.role });
        }
    }, [editData, open]);

    async function handleSubmit() {
        try {
            setLoading(true);
            await onSubmit(form);
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Edit Penghuni</h3>
                    <button onClick={onClose} className="rounded-xl p-2 
                    transition hover:bg-[#F0F0F0]" title="Close modal">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Nama</label>
                        <input
                            title="name"
                            type="text"
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">No. HP</label>
                        <input
                            type="text"
                            value={form.phone ?? ""}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="08xx..."
                            title="phone"
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Role</label>
                        <select
                            title="role"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        >
                            <option value="tenant">Tenant</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                </div>

                {/* Info kamar (read-only) */}
                {editData?.room_number && (
                    <div className="mt-4 rounded-2xl bg-[#F8F8F8] px-4 py-3">
                        <p className="font-inter text-xs text-[#777]">Kamar aktif</p>
                        <p className="mt-0.5 font-poppins text-sm font-semibold text-[#2F2F2F]">
                            Kamar {editData.room_number}
                            {editData.room_floor ? ` · Lantai ${editData.room_floor}` : ""}
                        </p>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <LoaderCircle size={15} className="animate-spin" />}
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}