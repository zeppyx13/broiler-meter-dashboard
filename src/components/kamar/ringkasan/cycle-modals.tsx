"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { createLease, getLeases, updateLease } from "@/lib/lease-api";
import { getUser } from "@/lib/auth";
import { ensureCycleBaseline, getCycleExtra, localDateKey, setCycleExtra } from "@/lib/broiler-local-store";
import type { LiveStatus } from "@/lib/live-status-api";
import type { Lease } from "@/types/lease";
import { CancelButton, Field, ModalShell, NumberStepper, PrimaryButton, inputClass } from "./form-parts";

const STRAIN_OPTIONS = ["Ross 308", "Cobb 500", "Lohmann (MB 202)", "Hubbard"];

type StartProps = {
    open: boolean;
    onClose: () => void;
    room: { id: number; number: string; price_monthly: number };
    live?: LiveStatus;
    editCycle?: Lease | null;
    onSaved: () => void;
};

function errorMessage(err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message || e?.message || "Terjadi kesalahan.";
}

export function CycleStartModal(props: StartProps) {
    if (!props.open) return null;
    return <CycleStartForm key={props.editCycle?.id ?? `new-${props.room.id}`} {...props} />;
}

function CycleStartForm({ open, onClose, room, live, editCycle, onSaved }: StartProps) {
    const [startDate, setStartDate] = useState(() => editCycle?.start_date.slice(0, 10) ?? localDateKey());
    const [population, setPopulation] = useState(() => editCycle ? getCycleExtra(editCycle.id).population_start ?? 0 : 0);
    const [strain, setStrain] = useState(() => editCycle ? getCycleExtra(editCycle.id).strain ?? "" : "");
    const [targetDays, setTargetDays] = useState(() => editCycle ? getCycleExtra(editCycle.id).harvest_target_days ?? 35 : 35);
    const [loading, setLoading] = useState(false);

    async function handleSave() {
        if (population <= 0) return;
        setLoading(true);
        try {
            const extra = { population_start: population, strain: strain.trim() || undefined, harvest_target_days: targetDays };

            if (editCycle) {
                setCycleExtra(editCycle.id, extra);
            } else {
                const res = await createLease({
                    user_id: Number(getUser()?.id ?? 0),
                    room_id: room.id,
                    start_date: startDate,
                    end_date: null,
                    // Kolom wajib dari skema lama; tidak dipakai di COASTHER.
                    monthly_rent_snapshot: room.price_monthly > 0 ? room.price_monthly : 1,
                    note: null,
                });

                let leaseId: number | undefined = res?.data?.lease?.id ?? res?.data?.id;
                if (!leaseId) {
                    const { leases } = await getLeases({ status: "active", limit: 100 });
                    leaseId = leases.filter((l) => l.room_id === room.id).sort((a, b) => b.id - a.id)[0]?.id;
                }

                if (leaseId) {
                    setCycleExtra(leaseId, extra);
                    if (live?.water_total_liter != null && live?.energy_kwh_total != null) {
                        ensureCycleBaseline(leaseId, live.water_total_liter, live.energy_kwh_total);
                    }
                } else {
                    await Swal.fire({
                        icon: "warning",
                        title: "Siklus dibuat",
                        text: "Populasi belum tersimpan. Buka Edit Siklus untuk mengisinya.",
                        confirmButtonColor: "#7B1113",
                    });
                }
            }

            onSaved();
            onClose();
            Swal.fire({ icon: "success", title: editCycle ? "Data siklus diperbarui" : "Siklus dimulai", timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: errorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
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
            <Field label="Tanggal chick-in" required hint={editCycle ? "Tanggal chick-in tidak bisa diubah." : undefined}>
                <input
                    type="date"
                    value={startDate}
                    max={localDateKey()}
                    disabled={Boolean(editCycle)}
                    onChange={(e) => setStartDate(e.target.value)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>

            <Field label="Populasi awal (ekor)" required hint="Jumlah DOC yang masuk saat chick-in.">
                <input
                    type="number"
                    inputMode="numeric"
                    min={1}
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
    cycle: Lease;
    roomNumber: string;
    populationNow?: number;
    live?: LiveStatus;
    onSaved: () => void;
};

export function CycleCloseModal(props: CloseProps) {
    if (!props.open) return null;
    return <CycleCloseForm key={props.cycle.id} {...props} />;
}

function CycleCloseForm({ open, onClose, cycle, roomNumber, populationNow, live, onSaved }: CloseProps) {
    const [harvestDate, setHarvestDate] = useState(localDateKey);
    const [harvested, setHarvested] = useState(populationNow ?? 0);
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleClose() {
        setLoading(true);
        try {
            await updateLease(cycle.id, { status: "ended", end_date: harvestDate, note: note.trim() || cycle.note });
            setCycleExtra(cycle.id, {
                closed_at: harvestDate === localDateKey() ? new Date().toISOString() : `${harvestDate}T23:59:59`,
                harvested_count: harvested || undefined,
                end_water_liter: live?.water_total_liter,
                end_energy_kwh: live?.energy_kwh_total,
            });
            onSaved();
            onClose();
            Swal.fire({ icon: "success", title: "Siklus ditutup", text: "Kandang masuk masa istirahat.", timer: 1800, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menutup siklus", text: errorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <ModalShell
            title="Tutup Siklus (Panen)"
            subtitle={`Kandang ${roomNumber} · chick-in ${new Date(cycle.start_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`}
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
                    min={cycle.start_date.slice(0, 10)}
                    max={localDateKey()}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    suppressHydrationWarning
                    className={inputClass}
                />
            </Field>
            <Field label="Jumlah ayam dipanen (ekor)" hint="Terisi otomatis dari populasi saat ini, ubah bila berbeda.">
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
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
                Angka meter air & listrik saat ini disimpan sebagai akhir siklus untuk laporan.
            </p>
        </ModalShell>
    );
}
