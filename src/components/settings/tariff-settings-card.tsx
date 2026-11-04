"use client";

import { useEffect, useState } from "react";
import { Droplets, Zap, Save, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { getTariff, updateTariff, type Tariff } from "@/lib/tariff-api";
import { apiErrorMessage } from "@/lib/api-error";

type FieldConfig = {
    key: keyof Omit<Tariff, "id" | "updated_at">;
    label: string;
    description: string;
    prefix: string;
    suffix: string;
    icon: React.ReactNode;
    step: string;
};

// Kuota gratis & denda adalah konsep tagihan kost: tetap dikirim ke backend apa adanya, tapi tidak ditampilkan.
const fields: FieldConfig[] = [
    {
        key: "electricity_rate",
        label: "Tarif Listrik",
        description: "Harga per kWh sesuai golongan PLN kandang Anda.",
        prefix: "Rp",
        suffix: "/ kWh",
        icon: <Zap size={18} className="text-yellow-500" />,
        step: "1",
    },
    {
        key: "water_rate",
        label: "Tarif Air",
        description: "Harga per m³. Isi 0 jika memakai sumur sendiri.",
        prefix: "Rp",
        suffix: "/ m³",
        icon: <Droplets size={18} className="text-blue-500" />,
        step: "1",
    },
];

export default function TariffSettingsCard() {
    const [tariff, setTariff] = useState<Tariff | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            setLoading(true);
            setError("");
            const data = await getTariff();
            setTariff(data);
            // Isi form dengan nilai dari DB
            setForm({
                water_rate: String(data.water_rate),
                water_free_quota: String(data.water_free_quota),
                electricity_rate: String(data.electricity_rate),
                electricity_free_quota: String(data.electricity_free_quota),
                late_fee_flat: String(data.late_fee_flat),
            });
        } catch (e) {
            setError(apiErrorMessage(e, "Gagal memuat tarif"));
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        const confirm = await Swal.fire({
            title: "Simpan perubahan tarif?",
            text: "Estimasi biaya energi di Ringkasan kandang dan Laporan akan memakai tarif baru.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });

        if (!confirm.isConfirmed) return;

        try {
            setSaving(true);
            const updated = await updateTariff({
                water_rate: Number(form.water_rate),
                water_free_quota: Number(form.water_free_quota),
                electricity_rate: Number(form.electricity_rate),
                electricity_free_quota: Number(form.electricity_free_quota),
                late_fee_flat: Number(form.late_fee_flat),
            });
            setTariff(updated);
            Swal.fire({
                title: "Tersimpan!",
                text: "Tarif berhasil diperbarui.",
                icon: "success",
                confirmButtonColor: "#7B1113",
            });
        } catch (e) {
            Swal.fire({
                title: "Gagal",
                text: apiErrorMessage(e),
                icon: "error",
                confirmButtonColor: "#7B1113",
            });
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        if (!tariff) return;
        setForm({
            water_rate: String(tariff.water_rate),
            water_free_quota: String(tariff.water_free_quota),
            electricity_rate: String(tariff.electricity_rate),
            electricity_free_quota: String(tariff.electricity_free_quota),
            late_fee_flat: String(tariff.late_fee_flat),
        });
    }

    const isDirty = tariff && fields.some(
        (f) => String(tariff[f.key]) !== form[f.key]
    );

    const lastUpdated = tariff?.updated_at
        ? new Date(tariff.updated_at).toLocaleString("id-ID", {
            day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        })
        : "-";

    if (loading) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-8">
                <div className="flex items-center gap-3 text-[#666]">
                    <RefreshCw size={18} className="animate-spin" />
                    <span className="font-inter text-sm">Memuat pengaturan tarif...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-8">
                <p className="font-inter text-sm text-red-600">{error}</p>
                <button
                    type="button"
                    onClick={load}
                    className="mt-3 font-inter text-sm font-medium text-[#7B1113] underline"
                >
                    Coba lagi
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">
                        Tarif Energi
                    </h3>
                    <p className="mt-1 font-inter text-sm text-[#666]">
                        Dipakai untuk menghitung biaya energi per siklus. Terakhir diperbarui {lastUpdated}.
                    </p>
                </div>

                {isDirty && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-inter text-xs font-medium text-amber-600">
                        Belum disimpan
                    </span>
                )}
            </div>

            {/* Fields */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                    <div key={field.key} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                        <div className="flex items-center gap-2">
                            {field.icon}
                            <span className="font-inter text-sm font-medium text-[#2F2F2F]">
                                {field.label}
                            </span>
                        </div>
                        <p className="mt-1 font-inter text-xs text-[#999]">
                            {field.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 focus-within:border-[#7B1113]">
                            {field.prefix && (
                                <span className="font-inter text-sm text-[#999]">{field.prefix}</span>
                            )}
                            <input
                                title="a"
                                type="number"
                                min="0"
                                step={field.step}
                                value={form[field.key] ?? ""}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                                className="flex-1 bg-transparent font-poppins text-sm font-semibold text-[#2F2F2F] outline-none"
                            />
                            {field.suffix && (
                                <span className="font-inter text-xs text-[#999]">{field.suffix}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={handleReset}
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
        </div>
    );
}