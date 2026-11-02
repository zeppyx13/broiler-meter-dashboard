"use client";

import { useEffect, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { Announcement, AnnouncementFormPayload } from "@/types/announcement";

type Props = {
    open: boolean;
    editData: Announcement | null;
    onClose: () => void;
    onSubmit: (payload: AnnouncementFormPayload) => Promise<void>;
};

const EMPTY: AnnouncementFormPayload = {
    title: "",
    body: "",
    is_active: true,
    start_at: null,
    end_at: null,
};

export default function AnnouncementFormModal({ open, editData, onClose, onSubmit }: Props) {
    const [form, setForm] = useState<AnnouncementFormPayload>(EMPTY);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editData) {
            setForm({
                title: editData.title,
                body: editData.body,
                is_active: Boolean(editData.is_active),
                start_at: editData.start_at?.slice(0, 16) ?? null,
                end_at: editData.end_at?.slice(0, 16) ?? null,
            });
        } else {
            setForm(EMPTY);
        }
    }, [editData, open]);

    async function handleSubmit() {
        if (!form.title.trim() || !form.body.trim()) return;
        try {
            setLoading(true);
            await onSubmit({
                ...form,
                start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
                end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
            });
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
                        {editData ? "Edit Pengumuman" : "Buat Pengumuman"}
                    </h3>
                    <button title="close" onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Judul <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="cth. Pembersihan Rutin"
                            suppressHydrationWarning
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Isi Pengumuman <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={form.body}
                            onChange={(e) => setForm({ ...form, body: e.target.value })}
                            placeholder="Tulis isi pengumuman di sini..."
                            rows={4}
                            className="w-full resize-none rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Mulai Tampil
                            </label>
                            <input
                                title="date-time"
                                type="datetime-local"
                                value={form.start_at ?? ""}
                                onChange={(e) => setForm({ ...form, start_at: e.target.value || null })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Berakhir
                            </label>
                            <input
                                title="date-time"
                                type="datetime-local"
                                value={form.end_at ?? ""}
                                onChange={(e) => setForm({ ...form, end_at: e.target.value || null })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            title="aktif"
                            type="button"
                            onClick={() => setForm({ ...form, is_active: !form.is_active })}
                            suppressHydrationWarning
                            className={`relative h-6 w-11 rounded-full transition-colors ${form.is_active ? "bg-[#7B1113]" : "bg-[#D1D1D1]"
                                }`}
                        >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-0.5" : "-translate-x-full"
                                }`} />
                        </button>
                        <span className="font-inter text-sm text-[#555]">
                            {form.is_active ? "Aktif — tampil ke penghuni" : "Nonaktif — tersembunyi"}
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
                        disabled={loading || !form.title.trim() || !form.body.trim()}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <LoaderCircle size={15} className="animate-spin" />}
                        {editData ? "Simpan" : "Buat Pengumuman"}
                    </button>
                </div>
            </div>
        </div>
    );
}