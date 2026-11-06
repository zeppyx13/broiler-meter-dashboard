"use client";

import { useEffect, useState } from "react";
import type { Lease, LeaseUpdatePayload } from "@/types/lease";
import { getCycleExtra, setCycleExtra, type CycleExtra } from "@/lib/broiler-local-store";
import { CancelButton, Field, ModalShell, PrimaryButton, inputClass } from "@/components/kamar/ringkasan/form-parts";

type Props = {
    open: boolean;
    editData: Lease | null;
    onClose: () => void;
    onSubmit: (payload: LeaseUpdatePayload) => Promise<void>;
};

export default function LeaseFormModal({ open, editData, onClose, onSubmit }: Props) {
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState<"active" | "ended">("active");
    const [note, setNote] = useState("");
    const [extra, setExtra] = useState<CycleExtra>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !editData) return;
        setEndDate(editData.end_date?.slice(0, 10) ?? "");
        setStatus(editData.status);
        setNote(editData.note ?? "");
        setExtra(getCycleExtra(editData.id));
    }, [editData, open]);

    async function handleSubmit() {
        if (!editData) return;
        setLoading(true);
        try {
            await onSubmit({ end_date: endDate || null, status, note: note || null });
            setCycleExtra(editData.id, extra);
        } finally {
            setLoading(false);
        }
    }

    if (!open || !editData) return null;

    return (
        <ModalShell
            title="Edit Siklus Produksi"
            subtitle={`Kandang ${editData.room_number} · chick-in ${new Date(editData.start_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleSubmit} loading={loading}>Simpan</PrimaryButton>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal panen">
                    <input
                        type="date"
                        value={endDate}
                        min={editData.start_date.slice(0, 10)}
                        onChange={(e) => setEndDate(e.target.value)}
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
                <Field label="Status">
                    <select
                        title="Status siklus"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "active" | "ended")}
                        suppressHydrationWarning
                        className={inputClass}
                    >
                        <option value="active">Berjalan</option>
                        <option value="ended">Selesai</option>
                    </select>
                </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <Field label="Populasi awal">
                    <input
                        type="number"
                        inputMode="numeric"
                        value={extra.population_start ?? ""}
                        onChange={(e) => setExtra((p) => ({ ...p, population_start: e.target.value ? Number(e.target.value) : undefined }))}
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
                <Field label="Strain">
                    <input
                        value={extra.strain ?? ""}
                        onChange={(e) => setExtra((p) => ({ ...p, strain: e.target.value || undefined }))}
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
                <Field label="Target (hari)">
                    <input
                        type="number"
                        inputMode="numeric"
                        value={extra.harvest_target_days ?? ""}
                        onChange={(e) => setExtra((p) => ({ ...p, harvest_target_days: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="35"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field label="Catatan">
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opsional"
                    rows={2}
                    className={`${inputClass} resize-none`}
                />
            </Field>
        </ModalShell>
    );
}
