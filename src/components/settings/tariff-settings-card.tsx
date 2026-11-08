"use client";

import { useRef, useState } from "react";
import { Droplets, Zap, Save, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { writeData, type Farm } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { apiErrorMessage } from "@/lib/api-error";

type TariffKey = "electricity_rate_idr_per_kwh" | "water_rate_idr_per_m3";

type FieldConfig = {
    key: TariffKey;
    label: string;
    description: string;
    prefix: string;
    suffix: string;
    icon: React.ReactNode;
};

const fields: FieldConfig[] = [
    {
        key: "electricity_rate_idr_per_kwh",
        label: "Tarif Listrik",
        description: "Harga per kWh sesuai golongan PLN lahan ini.",
        prefix: "Rp",
        suffix: "/ kWh",
        icon: <Zap size={18} className="text-yellow-500" />,
    },
    {
        key: "water_rate_idr_per_m3",
        label: "Tarif Air",
        description: "Harga per m³. Isi 0 jika memakai sumur sendiri.",
        prefix: "Rp",
        suffix: "/ m³",
        icon: <Droplets size={18} className="text-blue-500" />,
    },
];

const formFrom = (farm?: Farm) => ({
    electricity_rate_idr_per_kwh: farm?.electricity_rate_idr_per_kwh == null ? "" : String(farm.electricity_rate_idr_per_kwh),
    water_rate_idr_per_m3: farm?.water_rate_idr_per_m3 == null ? "" : String(farm.water_rate_idr_per_m3),
});

/** Tarif disimpan per lahan (farm) di server; hanya pemilik/admin lahan yang bisa mengubah. */
export default function TariffSettingsCard() {
    const b = useBroiler();
    const [farmId, setFarmId] = useState<number | undefined>(b.farmId);
    const farm = b.farms.find((f) => f.id === farmId) ?? b.farms[0];
    const [form, setForm] = useState<Record<TariffKey, string>>(() => formFrom(farm));
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const canEdit = farm?.capabilities?.["farm:manage"] === true;

    // Isi ulang form saat lahan dipilih ulang atau tarifnya berubah di server.
    const signature = `${farm?.id}:${farm?.electricity_rate_idr_per_kwh}:${farm?.water_rate_idr_per_m3}`;
    const [seen, setSeen] = useState(signature);
    if (seen !== signature) {
        setSeen(signature);
        setForm(formFrom(farm));
    }

    async function handleSave() {
        if (!farm || !canEdit || inFlight.current) return;
        if (fields.some(({ key }) => form[key].trim() === "" || !Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
            await Swal.fire({ icon: "error", title: "Tarif belum sah", text: "Isi kedua tarif dengan angka minimal 0. Nilai kosong bukan tarif gratis.", confirmButtonColor: "#7B1113" });
            return;
        }
        const confirm = await Swal.fire({
            title: `Simpan tarif ${farm.name}?`,
            text: "Biaya energi di Ringkasan kandang dan Laporan untuk lahan ini akan memakai tarif baru.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });
        if (!confirm.isConfirmed) return;
        if (inFlight.current) return;
        inFlight.current = true;

        try {
            setSaving(true);
            await writeData("patch", `/api/farms/${farm.id}`, {
                electricity_rate_idr_per_kwh: Math.round(Number(form.electricity_rate_idr_per_kwh) * 100) / 100,
                water_rate_idr_per_m3: Math.round(Number(form.water_rate_idr_per_m3) * 100) / 100,
            });
            await b.refresh();
            Swal.fire({ title: "Tersimpan!", text: "Tarif berhasil diperbarui.", icon: "success", confirmButtonColor: "#7B1113" });
        } catch (e) {
            Swal.fire({ title: "Gagal", text: apiErrorMessage(e), icon: "error", confirmButtonColor: "#7B1113" });
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    if (b.loading) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-8">
                <div className="flex items-center gap-3 text-[#666]">
                    <RefreshCw size={18} className="animate-spin" />
                    <span className="font-inter text-sm">Memuat pengaturan tarif...</span>
                </div>
            </div>
        );
    }

    if (!farm) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-8">
                <p className="font-inter text-sm text-[#777]">Belum ada lahan. Tarif energi diatur per lahan.</p>
            </div>
        );
    }

    const isDirty = fields.some((f) => formFrom(farm)[f.key] !== form[f.key]);

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Tarif Energi</h3>
                    <p className="mt-1 font-inter text-sm text-[#666]">Untuk menghitung biaya listrik.</p>
                </div>
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 font-inter text-xs font-medium text-amber-600">Belum disimpan</span>
                    )}
                    {b.farms.length > 1 && (
                        <select
                            title="Lahan"
                            value={farm.id}
                            onChange={(e) => setFarmId(Number(e.target.value))}
                            className="rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 font-inter text-sm text-[#2F2F2F] outline-none focus:border-[#7B1113]"
                        >
                            {b.farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                    <div key={field.key} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                        <div className="flex items-center gap-2">
                            {field.icon}
                            <span className="font-inter text-sm font-medium text-[#2F2F2F]">{field.label}</span>
                        </div>
                        <p className="mt-1 font-inter text-xs text-[#999]">{field.description}</p>
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 focus-within:border-[#7B1113]">
                            <span className="font-inter text-sm text-[#999]">{field.prefix}</span>
                            <input
                                title={field.label}
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={!canEdit}
                                value={form[field.key]}
                                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                className="flex-1 bg-transparent font-poppins text-sm font-semibold text-[#2F2F2F] outline-none disabled:text-[#999]"
                            />
                            <span className="font-inter text-xs text-[#999]">{field.suffix}</span>
                        </div>
                    </div>
                ))}
            </div>

            {canEdit ? (
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setForm(formFrom(farm))}
                        disabled={!isDirty || saving}
                        className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                    >
                        <RefreshCw size={15} />
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-6 py-2.5 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90 disabled:opacity-40"
                    >
                        <Save size={15} />
                        {saving ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                </div>
            ) : (
                <p className="mt-4 font-inter text-xs text-[#999]">Hanya pemilik atau admin lahan yang bisa mengubah tarif.</p>
            )}
        </div>
    );
}
