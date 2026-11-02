"use client";

import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, ImagePlus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Room, RoomFormPayload } from "@/types/room";
import { getFacilities } from "@/lib/facility-api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomById } from "@/lib/room-api";

type RoomFormModalProps = {
    open: boolean;
    editData?: Room | null;
    onClose: () => void;
    onSubmit: (payload: RoomFormPayload) => Promise<void>;
};

const EMPTY_FORM: RoomFormPayload = {
    number: "",
    floor: null,
    price_monthly: 0,
    deposit: 0,
    is_available: true,
    description: "",
    main_image_url: "",
    facility_ids: [],
};

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Upload foto ke backend, return URL path
async function uploadRoomImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);

    const token = getToken();
    const response = await api.post("/api/upload/room-image", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    return response.data.data.url; // e.g. "/public/assets/Room/Room_123.jpg"
}

export default function RoomFormModal({
    open,
    editData,
    onClose,
    onSubmit,
}: RoomFormModalProps) {
    const [form, setForm] = useState<RoomFormPayload>(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: facilityData } = useQuery({
        queryKey: ["facilities"],
        queryFn: getFacilities,
        staleTime: 5 * 60 * 1000,
    });
    const allFacilities = facilityData?.facilities ?? [];

    useEffect(() => {
        if (!open) return;

        if (editData) {
            getRoomById(editData.id).then((detail) => {
                const ids = (detail.room.facilities ?? [])
                    .map((f: { id: number }) => Number(f.id))
                    .filter((id) => id > 0);
                setForm((prev) => ({ ...prev, facility_ids: ids }));
            }).catch(() => { });
            setForm({
                number: editData.number,
                floor: editData.floor,
                price_monthly: editData.price_monthly,
                deposit: editData.deposit,
                is_available: Boolean(editData.is_available),
                description: editData.description ?? "",
                main_image_url: editData.main_image_url ?? "",
                facility_ids: [], // sementara kosong, diisi setelah fetch
            });

            // Preview foto lama
            if (editData.main_image_url) {
                const url = editData.main_image_url.startsWith("http")
                    ? editData.main_image_url
                    : `${BASE_URL}${editData.main_image_url}`;
                setPreviewUrl(url);
            } else {
                setPreviewUrl(null);
            }

            // Fetch fasilitas yang sudah dimiliki kamar ini
            getRoomById(editData.id).then((detail) => {
                const ids = (detail.room.facilities ?? []).map((f: { id: number }) => f.id);
                setForm((prev) => ({ ...prev, facility_ids: ids }));
            }).catch(() => {
                console.warn("Gagal fetch detail kamar, fasilitas tidak terisi");
            });

        } else {
            setForm(EMPTY_FORM);
            setPreviewUrl(null);
        }
    }, [editData, open]);

    function toggleFacility(id: number) {
        const current = form.facility_ids ?? [];
        const exists = current.includes(id);
        setForm({
            ...form,
            facility_ids: exists
                ? current.filter((f) => f !== id)
                : [...current, id],
        });
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validasi tipe file di frontend
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) {
            alert("Hanya file JPG, PNG, atau WebP yang diizinkan.");
            return;
        }

        // Preview lokal sebelum upload
        const localUrl = URL.createObjectURL(file);
        setPreviewUrl(localUrl);

        // Upload ke backend
        try {
            setUploadLoading(true);
            const uploadedUrl = await uploadRoomImage(file);
            setForm((prev) => ({ ...prev, main_image_url: uploadedUrl }));
        } catch (err: any) {
            alert("Gagal mengupload foto: " + (err?.response?.data?.message || err.message));
            setPreviewUrl(editData?.main_image_url
                ? `${BASE_URL}${editData.main_image_url}`
                : null
            );
        } finally {
            setUploadLoading(false);
            // Reset input supaya file yang sama bisa dipilih lagi
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function handleRemoveImage() {
        setPreviewUrl(null);
        setForm((prev) => ({ ...prev, main_image_url: "" }));
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleSubmit() {
        if (!form.number.trim() || !form.price_monthly) return;
        if (uploadLoading) return; // tunggu upload selesai dulu
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
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#EAEAEA] px-6 pb-4 pt-6">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">
                        {editData ? "Edit Kamar" : "Tambah Kamar"}
                    </h3>
                    <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]" title="Tutup">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                {/* Body scrollable */}
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">

                    {/* Nomor Kamar */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Nomor Kamar <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.number}
                            onChange={(e) => setForm({ ...form, number: e.target.value })}
                            suppressHydrationWarning
                            placeholder="cth. A01"
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    {/* Lantai + Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Lantai</label>
                            <input
                                type="number"
                                value={form.floor ?? ""}
                                onChange={(e) => setForm({ ...form, floor: e.target.value ? Number(e.target.value) : null })}
                                suppressHydrationWarning
                                placeholder="cth. 1"
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Status</label>
                            <select
                                title="Pilih status ketersediaan kamar"
                                value={form.is_available ? "1" : "0"}
                                onChange={(e) => setForm({ ...form, is_available: e.target.value === "1" })}
                                suppressHydrationWarning
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            >
                                <option value="1">Tersedia</option>
                                <option value="0">Tidak Tersedia</option>
                            </select>
                        </div>
                    </div>

                    {/* Harga + Deposit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                                Harga / Bulan <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.price_monthly || ""}
                                onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })}
                                suppressHydrationWarning
                                placeholder="1500000"
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Deposit</label>
                            <input
                                type="number"
                                value={form.deposit || ""}
                                onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })}
                                suppressHydrationWarning
                                placeholder="500000"
                                className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                            />
                        </div>
                    </div>

                    {/* Deskripsi */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Deskripsi</label>
                        <textarea
                            value={form.description ?? ""}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Deskripsi kamar..."
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    {/* Upload Foto */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Foto Kamar
                        </label>

                        {previewUrl ? (
                            /* Preview foto yang sudah dipilih/ada */
                            <div className="relative overflow-hidden rounded-2xl border border-[#EAEAEA]">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="h-44 w-full object-cover"
                                />
                                {/* Overlay saat upload */}
                                {uploadLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <div className="flex flex-col items-center gap-2 text-white">
                                            <LoaderCircle size={24} className="animate-spin" />
                                            <span className="font-inter text-xs">Mengupload & mengompres...</span>
                                        </div>
                                    </div>
                                )}
                                {/* Tombol aksi di atas foto */}
                                {!uploadLoading && (
                                    <div className="absolute right-2 top-2 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            suppressHydrationWarning
                                            className="rounded-xl bg-white/90 p-2 shadow transition hover:bg-white"
                                            title="Ganti foto"
                                        >
                                            <ImagePlus size={15} className="text-[#555]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            suppressHydrationWarning
                                            className="rounded-xl bg-white/90 p-2 shadow transition hover:bg-white"
                                            title="Hapus foto"
                                        >
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Area upload kosong */
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                suppressHydrationWarning
                                className="flex h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#EAEAEA] bg-[#FAFAFA] transition hover:border-[#7B1113]/40 hover:bg-[#F5F5F5]"
                            >
                                <ImagePlus size={32} className="text-[#CCC]" />
                                <div className="text-center">
                                    <p className="font-inter text-sm font-medium text-[#555]">
                                        Klik untuk pilih foto
                                    </p>
                                    <p className="font-inter text-xs text-[#999]">
                                        JPG, PNG, WebP · Max 10MB · Auto kompres
                                    </p>
                                </div>
                            </button>
                        )}

                        {/* Hidden file input */}
                        <input
                            title="input images"
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Fasilitas */}
                    <div>
                        <label className="mb-2 block font-inter text-sm font-medium text-[#2F2F2F]">
                            Fasilitas
                            {(form.facility_ids?.length ?? 0) > 0 && (
                                <span className="ml-2 rounded-full bg-[#7B1113] px-2 py-0.5 font-inter text-xs text-white">
                                    {form.facility_ids?.length} dipilih
                                </span>
                            )}
                        </label>

                        {allFacilities.length === 0 ? (
                            <p className="font-inter text-xs text-[#999]">
                                Belum ada fasilitas. Tambahkan di halaman Fasilitas dulu.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {allFacilities.map((f) => {
                                    const selected = (form.facility_ids ?? []).includes(f.id);
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => toggleFacility(f.id)}
                                            suppressHydrationWarning
                                            className={`rounded-2xl border px-3 py-1.5 font-inter text-sm transition-all ${selected
                                                ? "border-[#7B1113] bg-[#7B1113] text-white"
                                                : "border-[#EAEAEA] bg-[#FAFAFA] text-[#555] hover:border-[#7B1113]/40"
                                                }`}
                                        >
                                            {selected ? "✓ " : ""}{f.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                        disabled={loading || uploadLoading || !form.number.trim() || !form.price_monthly}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {(loading || uploadLoading) && (
                            <LoaderCircle size={15} className="animate-spin" />
                        )}
                        {uploadLoading ? "Mengupload foto..." : loading ? "Menyimpan..." : editData ? "Simpan Perubahan" : "Tambah Kamar"}
                    </button>
                </div>
            </div>
        </div>
    );
}