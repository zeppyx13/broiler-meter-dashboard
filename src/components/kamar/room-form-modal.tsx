"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, ImagePlus, Trash2, ChevronDown } from "lucide-react";
import type { Room, RoomFormPayload } from "@/types/room";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { getRoomExtra, type RoomExtra } from "@/lib/broiler-local-store";
import { CancelButton, Field, ModalShell, PrimaryButton, inputClass } from "./ringkasan/form-parts";
import { apiErrorMessage } from "@/lib/api-error";

type RoomFormModalProps = {
    open: boolean;
    editData?: Room | null;
    onClose: () => void;
    onSubmit: (payload: RoomFormPayload, extra: RoomExtra) => Promise<void>;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
    return response.data.data.url;
}

export default function RoomFormModal(props: RoomFormModalProps) {
    if (!props.open) return null;
    return <RoomForm key={props.editData?.id ?? "new"} {...props} />;
}

function RoomForm({ open, editData, onClose, onSubmit }: RoomFormModalProps) {
    const [number, setNumber] = useState(editData?.number ?? "");
    const [floor, setFloor] = useState<number | null>(editData?.floor ?? null);
    const [description, setDescription] = useState(editData?.description ?? "");
    const [imageUrl, setImageUrl] = useState(editData?.main_image_url ?? "");
    const [extra, setExtra] = useState<RoomExtra>(() => editData ? getRoomExtra(editData.id) : {});
    const [showMore, setShowMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
        const img = editData?.main_image_url;
        return img ? (/^(https?:|data:|blob:)/.test(img) ? img : `${BASE_URL}${img}`) : null;
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => () => {
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            alert("Hanya file JPG, PNG, atau WebP yang diizinkan.");
            return;
        }
        setPreviewUrl(URL.createObjectURL(file));
        try {
            setUploadLoading(true);
            setImageUrl(await uploadRoomImage(file));
        } catch (err) {
            alert("Gagal mengupload foto: " + apiErrorMessage(err));
            setPreviewUrl(null);
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleSubmit() {
        if (!number.trim() || uploadLoading) return;
        setLoading(true);
        try {
            await onSubmit(
                {
                    number: number.trim(),
                    floor,
                    // price_monthly & is_available wajib di skema lama; tidak dipakai di COASTHER.
                    price_monthly: editData?.price_monthly && editData.price_monthly > 0 ? editData.price_monthly : 1,
                    deposit: editData?.deposit ?? 0,
                    is_available: editData ? Boolean(editData.is_available) : true,
                    description: description || null,
                    main_image_url: imageUrl || null,
                },
                extra
            );
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <ModalShell
            title={editData ? "Edit Kandang" : "Tambah Kandang"}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleSubmit} loading={loading || uploadLoading} disabled={!number.trim()}>
                        {uploadLoading ? "Mengupload foto..." : editData ? "Simpan" : "Tambah Kandang"}
                    </PrimaryButton>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label="Nomor kandang" required>
                    <input
                        type="text"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="cth. A01"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
                <Field label="Blok">
                    <input
                        type="number"
                        value={floor ?? ""}
                        onChange={(e) => setFloor(e.target.value ? Number(e.target.value) : null)}
                        placeholder="cth. 1"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field label="Fase listrik panel" hint="Kipas, lampu, dan pemanas diisi di tab Peralatan kandang.">
                <select
                    title="Fase listrik"
                    value={extra.phase_count ?? ""}
                    onChange={(e) => setExtra((prev) => ({ ...prev, phase_count: e.target.value ? Number(e.target.value) : undefined }))}
                    suppressHydrationWarning
                    className={inputClass}
                >
                    <option value="">Pilih</option>
                    <option value="1">1 fase</option>
                    <option value="3">3 fase</option>
                </select>
            </Field>

            <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                suppressHydrationWarning
                className="flex items-center gap-1.5 font-inter text-sm font-medium text-[#7B1113]"
            >
                <ChevronDown size={16} className={`transition ${showMore ? "rotate-180" : ""}`} />
                Info tambahan (deskripsi & foto)
            </button>

            {showMore && (
                <>
                    <Field label="Deskripsi">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="cth. Closed house, 2 lantai, kapasitas 5.000 ekor"
                            rows={2}
                            className={`${inputClass} resize-none`}
                        />
                    </Field>

                    <Field label="Foto kandang">
                        {previewUrl ? (
                            <div className="relative overflow-hidden rounded-2xl border border-[#EAEAEA]">
                                <Image src={previewUrl} alt="Pratinjau foto kandang" width={800} height={450} unoptimized className="h-40 w-full object-cover" />
                                {uploadLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                                        <LoaderCircle size={24} className="animate-spin" />
                                    </div>
                                ) : (
                                    <div className="absolute right-2 top-2 flex gap-2">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} title="Ganti foto" className="rounded-xl bg-white/90 p-2 shadow">
                                            <ImagePlus size={15} className="text-[#555]" />
                                        </button>
                                        <button type="button" onClick={() => { setPreviewUrl(null); setImageUrl(""); }} title="Hapus foto" className="rounded-xl bg-white/90 p-2 shadow">
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                suppressHydrationWarning
                                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#EAEAEA] bg-[#FAFAFA] transition hover:border-[#7B1113]/40"
                            >
                                <ImagePlus size={26} className="text-[#CCC]" />
                                <span className="font-inter text-xs text-[#999]">JPG, PNG, WebP · maks 10MB</span>
                            </button>
                        )}
                        <input
                            title="Pilih foto"
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </Field>
                </>
            )}
        </ModalShell>
    );
}
