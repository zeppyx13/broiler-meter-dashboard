"use client";

import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { recordDate, recordToLegacy, type ServerDailyRecord } from "@/lib/broiler-adapters";
import type { KandangData } from "./use-kandang-data";
import { CancelButton, Field, ModalShell, NumberStepper, PrimaryButton, inputClass } from "./form-parts";

type Props = {
    open: boolean;
    onClose: () => void;
    data: KandangData;
    initialDate?: string;
    onSaved: () => void;
};

type FormValues = {
    date: string;
    isExisting: boolean;
    revision: number;
    dead: number;
    culled: number;
    weight: string;
    feed: string;
    note: string;
};

/** Isi form dari catatan yang sudah ada di tanggal itu (mode edit), atau kosong. */
function loadForm(records: ServerDailyRecord[], date: string): FormValues {
    const server = records.find((r) => recordDate(r) === date);
    const existing = server ? recordToLegacy(server) : undefined;
    return {
        date,
        isExisting: Boolean(existing),
        revision: server?.revision ?? 0,
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
    if (!props.data.dailyRecordsReady) return <ModalShell title="Catat Harian" subtitle="Memuat catatan server dan revisi terakhir." onClose={props.onClose} footer={<CancelButton onClick={props.onClose} />}><p className="font-inter text-sm text-[#777]">{props.data.dailyRecordsError ? `Catatan belum dapat dimuat: ${apiErrorMessage(props.data.dailyRecordsError)}. Muat ulang sebelum menyimpan.` : "Memuat catatan harian…"}</p></ModalShell>;
    return <DailyRecordForm key={`${props.data.serverCycle?.id}-${props.initialDate}`} {...props} />;
}

function DailyRecordForm({ onClose, data, initialDate, onSaved }: Props) {
    const cycle = data.serverCycle;
    const startDate = cycle?.placement_date ?? data.localDate;
    const [form, setForm] = useState(() => loadForm(data.allServerRecords, initialDate ?? data.localDate));
    const [loading, setLoading] = useState(false);
    // UUID stabil per isian agar retry tidak membuat koreksi ganda.
    const pendingRequest = useRef<{ payload: string; id: string } | null>(null);
    const saving = useRef(false);
    const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

    async function handleSave() {
        if (!cycle || saving.current || !data.canOperate || !data.dailyRecordsReady || (form.isExisting && !data.canDailyCorrect)) return;
        saving.current = true;
        setLoading(true);
        try {
            const body = {
                dead: form.dead,
                culled: form.culled,
                avg_weight_g: form.weight ? Number(form.weight) : null,
                feed_kg: form.feed ? Number(form.feed) : null,
                note: form.note.trim() || null,
                expected_revision: form.revision,
            };
            const payload = JSON.stringify([cycle.id, form.date, body]);
            if (pendingRequest.current?.payload !== payload) pendingRequest.current = { payload, id: crypto.randomUUID() };
            await writeData("put", `/api/flock-cycles/${cycle.id}/daily-records/${form.date}`, { ...body, request_id: pendingRequest.current.id });
            onSaved();
            onClose();
            Swal.fire({ icon: "success", title: "Catatan tersimpan", timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            saving.current = false;
            setLoading(false);
        }
    }

    return (
        <ModalShell
            title={form.isExisting ? "Ubah Catatan Harian" : "Catat Harian"}
            subtitle="Deplesi dipakai untuk menghitung populasi dan konsumsi per ekor."
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleSave} loading={loading} disabled={!data.canOperate || (form.isExisting && !data.canDailyCorrect)}>Simpan</PrimaryButton>
                </>
            }
        >
            {form.isExisting && !data.canDailyCorrect && <p className="font-inter text-sm text-[#777]">Tanggal ini sudah memiliki catatan. Koreksi memerlukan izin tambahan dari Owner.</p>}
            <Field label="Tanggal" required>
                <input
                    type="date"
                    value={form.date}
                    min={startDate.slice(0, 10)}
                    max={data.localDate}
                    onChange={(e) => {
                        setForm(loadForm(data.allServerRecords, e.target.value));
                    }}
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
                    placeholder="Opsional cth: ayam lesu di sisi barat, nipple bocor"
                    className={`${inputClass} resize-none`}
                />
            </Field>
        </ModalShell>
    );
}
