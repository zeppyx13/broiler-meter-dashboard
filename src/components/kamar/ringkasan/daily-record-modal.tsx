"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { getDailyRecords, localDateKey, upsertDailyRecord } from "@/lib/broiler-local-store";
import { CancelButton, Field, ModalShell, NumberStepper, PrimaryButton, inputClass } from "./form-parts";

type Props = {
    open: boolean;
    onClose: () => void;
    leaseId: number;
    startDate: string;
    initialDate?: string;
    onSaved: () => void;
};

type FormValues = {
    date: string;
    isExisting: boolean;
    dead: number;
    culled: number;
    weight: string;
    feed: string;
    note: string;
};

/** Isi form dari catatan yang sudah ada di tanggal itu (mode edit), atau kosong. */
function loadForm(leaseId: number, date: string): FormValues {
    const existing = getDailyRecords(leaseId).find((r) => r.date === date);
    return {
        date,
        isExisting: Boolean(existing),
        dead: existing?.dead ?? 0,
        culled: existing?.culled ?? 0,
        weight: existing?.avg_weight_g != null ? String(existing.avg_weight_g) : "",
        feed: existing?.feed_kg != null ? String(existing.feed_kg) : "",
        note: existing?.note ?? "",
    };
}

export default function DailyRecordModal(props: Props) {
    // Form dilepas saat modal ditutup, jadi setiap dibuka mulai dari data terbaru.
    if (!props.open) return null;
    return <DailyRecordForm {...props} />;
}

function DailyRecordForm({ onClose, leaseId, startDate, initialDate, onSaved }: Props) {
    const [form, setForm] = useState(() => loadForm(leaseId, initialDate ?? localDateKey()));
    const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

    function handleSave() {
        upsertDailyRecord(leaseId, {
            date: form.date,
            dead: form.dead,
            culled: form.culled,
            avg_weight_g: form.weight ? Number(form.weight) : undefined,
            feed_kg: form.feed ? Number(form.feed) : undefined,
            note: form.note.trim() || undefined,
        });
        onSaved();
        onClose();
        Swal.fire({ icon: "success", title: "Catatan tersimpan", timer: 1200, showConfirmButton: false });
    }

    return (
        <ModalShell
            title={form.isExisting ? "Ubah Catatan Harian" : "Catat Harian"}
            subtitle="Deplesi dipakai untuk menghitung populasi dan konsumsi per ekor."
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleSave}>Simpan</PrimaryButton>
                </>
            }
        >
            <Field label="Tanggal" required>
                <input
                    type="date"
                    value={form.date}
                    min={startDate.slice(0, 10)}
                    max={localDateKey()}
                    onChange={(e) => setForm(loadForm(leaseId, e.target.value))}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ayam mati (ekor)">
                    <NumberStepper value={form.dead} onChange={(v) => set("dead", v)} />
                </Field>
                <Field label="Afkir / culling (ekor)">
                    <NumberStepper value={form.culled} onChange={(v) => set("culled", v)} />
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Bobot rata-rata (gram)" hint="Opsional, dari timbang sampel.">
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={form.weight}
                        onChange={(e) => set("weight", e.target.value)}
                        placeholder="cth. 850"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
                <Field label="Pakan terpakai (kg)" hint="Opsional.">
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={form.feed}
                        onChange={(e) => set("feed", e.target.value)}
                        placeholder="cth. 450"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field label="Catatan">
                <textarea
                    rows={2}
                    value={form.note}
                    onChange={(e) => set("note", e.target.value)}
                    placeholder="Opsional — cth. ayam lesu di sisi barat, nipple bocor"
                    className={`${inputClass} resize-none`}
                />
            </Field>
        </ModalShell>
    );
}
