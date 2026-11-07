"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import type { KandangData } from "./use-kandang-data";
import { CancelButton, Field, ModalShell, NumberStepper, PrimaryButton, inputClass } from "./form-parts";

const STRAIN_OPTIONS = ["Ross 308", "Cobb 500", "Lohmann (MB 202)", "Hubbard"];

type StartProps = {
    open: boolean;
    onClose: () => void;
    data: KandangData;
    /** true = ubah profil siklus aktif (strain & target panen). */
    editing?: boolean;
    onSaved: () => void;
};

const errorMessage = apiErrorMessage;

function addDays(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }

export function CycleStartModal({ open, onClose, data, editing, onSaved }: StartProps) {
    const room = data.room!;
    const editCycle = editing ? data.serverCycle : null;
    const [startDate, setStartDate] = useState(data.localDate);
    const [population, setPopulation] = useState(0);
    const [strain, setStrain] = useState("");
    const [targetDays, setTargetDays] = useState(35);
    const [loading, setLoading] = useState(false);
    const saving = useRef(false);

    useEffect(() => {
        if (!open) return;
        if (editCycle) {
            setStartDate(editCycle.placement_date.slice(0, 10));
            setPopulation(editCycle.initial_population);
            setStrain(data.cycle?.extra.strain ?? "");
            setTargetDays(data.harvestTargetDays);
        } else {
            setStartDate(data.localDate);
            setPopulation(0);
            setStrain("");
            setTargetDays(35);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editCycle?.id]);

    async function handleSave() {
        if (population <= 0 || saving.current) return;
        saving.current = true;
        setLoading(true);
        try {
            const profile = { strain: strain.trim() || null, harvest_target_days: targetDays };
            let cycleId = editCycle?.id;

            if (!editCycle) {
                // Kode siklus unik per kandang: <kode kandang>-<tanggal chick-in>.
                const created = await writeData<{ id: number }>("post", "/api/flock-cycles", {
                    coop_id: room.id,
                    cycle_code: `${room.number}-${startDate.replaceAll("-", "")}`.slice(0, 60),
                    placement_date: startDate,
                    planned_harvest_date: addDays(startDate, targetDays - 1),
                    initial_population: population,
                    notes: null,
                });
                cycleId = created?.id;
            }

            if (cycleId) {
                try {
                    await writeData("put", `/api/flock-cycles/${cycleId}/profile`, profile);
                } catch (err) {
                    if (editCycle) throw err;
                    await Swal.fire({ icon: "warning", title: "Siklus dimulai", text: `Strain/target panen belum tersimpan: ${errorMessage(err)}`, confirmButtonColor: "#7B1113" });
                }
            }

            onSaved();
            onClose();
            Swal.fire({ icon: "success", title: editCycle ? "Data siklus diperbarui" : "Siklus dimulai", timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: errorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            saving.current = false;
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <ModalShell
            title={editCycle ? "Edit Data Siklus" : "Mulai Siklus Baru"}
            subtitle={`Kandang ${room.number}`}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleSave} loading={loading} disabled={population <= 0}>
                        {editCycle ? "Simpan" : "Mulai Siklus"}
                    </PrimaryButton>
                </>
            }
        >
            <Field label="Tanggal chick-in" required hint={editCycle ? "Tanggal chick-in tidak bisa diubah." : "Hari chick-in dihitung sebagai hari ke-1."}>
                <input
                    type="date"
                    value={startDate}
                    max={data.localDate}
                    disabled={Boolean(editCycle)}
                    onChange={(e) => setStartDate(e.target.value)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>

            <Field label="Populasi awal (ekor)" required hint={editCycle ? "Populasi awal tidak bisa diubah setelah chick-in." : data.coop?.capacity_birds ? `Jumlah DOC yang masuk. Kapasitas kandang ${data.coop.capacity_birds.toLocaleString("id-ID")} ekor.` : "Jumlah DOC yang masuk saat chick-in."}>
                <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={data.coop?.capacity_birds ?? undefined}
                    disabled={Boolean(editCycle)}
                    value={population || ""}
                    onChange={(e) => setPopulation(Number(e.target.value) || 0)}
                    placeholder="cth. 5000"
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Strain">
                    <input
                        list="strain-options"
                        value={strain}
                        onChange={(e) => setStrain(e.target.value)}
                        placeholder="cth. Ross 308"
                        suppressHydrationWarning
                        className={inputClass}
                    />
                    <datalist id="strain-options">
                        {STRAIN_OPTIONS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                </Field>
                <Field label="Target panen (hari)">
                    <NumberStepper value={targetDays} onChange={setTargetDays} min={1} />
                </Field>
            </div>
        </ModalShell>
    );
}

type CloseProps = {
    open: boolean;
    onClose: () => void;
    data: KandangData;
    onSaved: () => void;
};

export function CycleCloseModal({ open, onClose, data, onSaved }: CloseProps) {
    const cycle = data.serverCycle!;
    const roomNumber = data.room?.number ?? "";
    const populationNow = cycle?.current_population;
    const [harvestDate, setHarvestDate] = useState(data.localDate);
    const [harvested, setHarvested] = useState(0);
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const saving = useRef(false);
    const pendingRequest = useRef<{ payload: string; id: string } | null>(null);

    useEffect(() => {
        if (!open) return;
        setHarvestDate(data.localDate);
        setHarvested(populationNow ?? 0);
        setNote("");
    }, [open, populationNow]);

    async function handleClose() {
        if (saving.current) return;
        saving.current = true;
        setLoading(true);
        try {
            const body = {
                harvested_count: harvested,
                actual_harvest_date: harvestDate,
                ...(note.trim() ? { notes: note.trim().slice(0, 255) } : {}),
            };
            const payload = JSON.stringify([cycle.id, body]);
            if (pendingRequest.current?.payload !== payload) pendingRequest.current = { payload, id: crypto.randomUUID() };
            await writeData("post", `/api/flock-cycles/${cycle.id}/harvest`, { ...body, request_id: pendingRequest.current.id });
            onSaved();
            onClose();
            Swal.fire({ icon: "success", title: "Siklus ditutup", text: "Kandang masuk masa istirahat.", timer: 1800, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menutup siklus", text: errorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            saving.current = false;
            setLoading(false);
        }
    }

    if (!open || !cycle) return null;

    return (
        <ModalShell
            title="Tutup Siklus (Panen)"
            subtitle={`Kandang ${roomNumber} · chick-in ${new Date(cycle.placement_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`}
            onClose={onClose}
            footer={
                <>
                    <CancelButton onClick={onClose} />
                    <PrimaryButton onClick={handleClose} loading={loading}>Tutup Siklus</PrimaryButton>
                </>
            }
        >
            <Field label="Tanggal panen" required>
                <input
                    type="date"
                    value={harvestDate}
                    min={cycle.placement_date.slice(0, 10)}
                    max={data.localDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>
            <Field label="Jumlah ayam dipanen (ekor)" hint="Terisi otomatis dari populasi saat ini, maksimal sebanyak populasi itu.">
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={populationNow}
                    value={harvested || ""}
                    onChange={(e) => setHarvested(Number(e.target.value) || 0)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>
            <Field label="Catatan">
                <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opsional — cth. bobot rata-rata panen, kendala siklus"
                    className={`${inputClass} resize-none`}
                />
            </Field>
            <p className="rounded-2xl bg-[#F8F8F8] px-4 py-3 font-inter text-xs text-[#777]">
                Siklus ditutup.
            </p>
        </ModalShell>
    );
}
