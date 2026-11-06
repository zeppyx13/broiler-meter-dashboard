"use client";

import { useEffect, useState } from "react";
import type { Coop, Farm } from "@/lib/broiler-api";
import { CancelButton, Field, ModalShell, PrimaryButton, inputClass } from "./ringkasan/form-parts";

export type CoopFormPayload = {
    farm_id: number;
    code: string;
    name: string;
    capacity_birds: number | null;
    description: string | null;
};

type RoomFormModalProps = {
    open: boolean;
    editData?: Coop | null;
    /** Lahan yang boleh dipilih (akun owner/manager lahan). */
    farms: Farm[];
    defaultFarmId?: number | null;
    onClose: () => void;
    onSubmit: (payload: CoopFormPayload) => Promise<void>;
};

export const MAX_KANDANG_PER_LAHAN = 4;

export default function RoomFormModal({ open, editData, farms, defaultFarmId, onClose, onSubmit }: RoomFormModalProps) {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [farmId, setFarmId] = useState<number | null>(null);
    const [capacity, setCapacity] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCode(editData?.code ?? "");
        setName(editData?.name ?? "");
        setFarmId(editData?.farm_id ?? defaultFarmId ?? farms[0]?.id ?? null);
        setCapacity(editData?.capacity_birds ? String(editData.capacity_birds) : "");
        setDescription(editData?.description ?? "");
    }, [open, editData, defaultFarmId, farms]);

    const valid = code.trim() && name.trim() && farmId != null;

    async function handleSubmit() {
        if (!valid || farmId == null) return;
        setLoading(true);
        try {
            await onSubmit({
                farm_id: farmId,
                code: code.trim(),
                name: name.trim(),
                capacity_birds: capacity ? Number(capacity) : null,
                description: description.trim() || null,
            });
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
                    <PrimaryButton onClick={handleSubmit} loading={loading} disabled={!valid}>
                        {editData ? "Simpan" : "Tambah Kandang"}
                    </PrimaryButton>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label="Kode kandang" required>
                    <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="cth. A01" suppressHydrationWarning className={inputClass} />
                </Field>
                <Field label="Nama kandang" required>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Kandang Timur" suppressHydrationWarning className={inputClass} />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Lahan" required>
                    {editData ? (
                        <p className={`${inputClass} text-[#555]`}>{farms.find((f) => f.id === farmId)?.name ?? `Lahan ${farmId}`}</p>
                    ) : (
                        <select title="Lahan" value={farmId ?? ""} onChange={(e) => setFarmId(Number(e.target.value))} suppressHydrationWarning className={inputClass}>
                            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    )}
                </Field>
                <Field label="Kapasitas (ekor)">
                    <input type="number" min={1} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="cth. 500" suppressHydrationWarning className={inputClass} />
                </Field>
            </div>
            <Field label="Deskripsi">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="cth. Kandang panggung 6 × 10 m, open house" rows={2} className={`${inputClass} resize-none`} />
            </Field>
            {!editData && (
                <p className="font-inter text-xs text-[#999]">Satu lahan menampung maksimal {MAX_KANDANG_PER_LAHAN} kandang. Peralatan dan alat IoT diatur setelah kandang dibuat.</p>
            )}
        </ModalShell>
    );
}
