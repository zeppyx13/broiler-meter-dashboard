"use client";

import { useEffect, useState } from "react";
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

export default function DailyRecordModal({ open, onClose, leaseId, startDate, initialDate, onSaved }: Props) {
    const [date, setDate] = useState(localDateKey());
    const [dead, setDead] = useState(0);
    const [culled, setCulled] = useState(0);
    const [weight, setWeight] = useState("");
    const [feed, setFeed] = useState("");
    const [note, setNote] = useState("");
    const [isExisting, setIsExisting] = useState(false);

    useEffect(() => {
        if (open) setDate(initialDate ?? localDateKey());
    }, [open, initialDate]);

    // Ganti tanggal → muat catatan yang sudah ada di tanggal itu (mode edit).
    useEffect(() => {
        if (!open) return;
        const existing = getDailyRecords(leaseId).find((r) => r.date === date);
        setIsExisting(Boolean(existing));
        setDead(existing?.dead ?? 0);
        setCulled(existing?.culled ?? 0);
        setWeight(existing?.avg_weight_g != null ? String(existing.avg_weight_g) : "");
        setFeed(existing?.feed_kg != null ? String(existing.feed_kg) : "");
        setNote(existing?.note ?? "");
    }, [open, date, leaseId]);

    function handleSave() {
        upsertDailyRecord(leaseId, {
            date,
            dead,
            culled,
            avg_weight_g: weight ? Number(weight) : undefined,
            feed_kg: feed ? Number(feed) : undefined,
            note: note.trim() || undefined,
        });
        onSaved();
        onClose();
        Swal.fire({ icon: "success", title: "Catatan tersimpan", timer: 1200, showConfirmButton: false });
    }

    if (!open) return null;

    return (
        <ModalShell
            title={isExisting ? "Ubah Catatan Harian" : "Catat Harian"}
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
                    value={date}
                    min={startDate.slice(0, 10)}
                    max={localDateKey()}
                    onChange={(e) => setDate(e.target.value)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ayam mati (ekor)">
                    <NumberStepper value={dead} onChange={setDead} />
                </Field>
                <Field label="Afkir / culling (ekor)">
                    <NumberStepper value={culled} onChange={setCulled} />
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Bobot rata-rata (gram)" hint="Opsional, dari timbang sampel.">
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
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
                        value={feed}
                        onChange={(e) => setFeed(e.target.value)}
                        placeholder="cth. 450"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                </Field>
            </div>

            <Field label="Catatan">
                <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opsional — cth. ayam lesu di sisi barat, nipple bocor"
                    className={`${inputClass} resize-none`}
                />
            </Field>
        </ModalShell>
    );
}
