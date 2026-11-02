"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Wifi, WifiOff } from "lucide-react";
import Swal from "sweetalert2";
import MeterFormModal from "./meter-form-modal";
import { getMeters, createMeter, updateMeter, deleteMeter } from "@/lib/meter-api";
import type { Meter, MeterFormPayload, MeterUpdatePayload } from "@/types/meter";

const TYPE_OPTIONS = [
    { label: "Semua", value: undefined },
    { label: "💧 Air", value: "water" as const },
    { label: "⚡ Listrik", value: "electricity" as const },
];

const STATUS_OPTIONS = [
    { label: "Semua", value: undefined },
    { label: "Aktif", value: 1 },
    { label: "Nonaktif", value: 0 },
];

export default function MeterListSection() {
    const queryClient = useQueryClient();
    const [typeFilter, setTypeFilter] = useState<"water" | "electricity" | undefined>(undefined);
    const [activeFilter, setActiveFilter] = useState<number | undefined>(undefined);
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<Meter | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["meters", typeFilter, activeFilter],
        queryFn: () => getMeters({
            type: typeFilter,
            is_active: activeFilter,
        }),
        staleTime: 30 * 1000,
    });

    const meters = data?.meters ?? [];

    function handleTambah() { setEditData(null); setModalOpen(true); }
    function handleEdit(m: Meter) { setEditData(m); setModalOpen(true); }

    async function handleDelete(m: Meter) {
        const result = await Swal.fire({
            title: "Hapus alat IoT ini?",
            html: `<b>${m.device_uid}</b><br/><span style="font-size:13px;color:#777">Kamar ${m.room_number} · ${m.type === "water" ? "Air" : "Listrik"}</span>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteMeter(m.id);
            queryClient.invalidateQueries({ queryKey: ["meters"] });
            Swal.fire({ icon: "success", title: "Alat dihapus", timer: 1200, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menghapus",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    const handleSubmit = useCallback(async (payload: MeterFormPayload | MeterUpdatePayload) => {
        try {
            if (editData) {
                await updateMeter(editData.id, payload as MeterUpdatePayload);
            } else {
                await createMeter(payload as MeterFormPayload);
            }
            queryClient.invalidateQueries({ queryKey: ["meters"] });
            setModalOpen(false);
            Swal.fire({ icon: "success", title: editData ? "Diperbarui" : "Alat didaftarkan", timer: 1200, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menyimpan",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }, [editData, queryClient]);

    return (
        <div className="space-y-4">
            {/* Filter + Tambah */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {TYPE_OPTIONS.map((opt) => (
                            <button
                                key={String(opt.value)}
                                onClick={() => setTypeFilter(opt.value)}
                                suppressHydrationWarning
                                className={`px-4 py-2.5 font-inter text-sm transition-colors ${typeFilter === opt.value
                                    ? "bg-[#7B1113] text-white"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {STATUS_OPTIONS.map((opt) => (
                            <button
                                key={String(opt.value)}
                                onClick={() => setActiveFilter(opt.value)}
                                suppressHydrationWarning
                                className={`px-4 py-2.5 font-inter text-sm transition-colors ${activeFilter === opt.value
                                    ? "bg-[#7B1113] text-white"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleTambah}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                >
                    <Plus size={16} />
                    Daftarkan Alat
                </button>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data alat IoT.
                </div>
            )}

            {!isLoading && !isError && meters.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                    <p className="font-inter text-sm text-[#999]">Tidak ada alat IoT terdaftar.</p>
                </div>
            )}

            {/* Tabel meter */}
            {!isLoading && !isError && meters.length > 0 && (
                <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-[#EAEAEA]">
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kamar</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Tipe</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Device UID</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Unit</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Dipasang</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                                <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {meters.map((m, i) => {
                                const isLast = i === meters.length - 1;
                                const active = Boolean(m.is_active);
                                return (
                                    <tr
                                        key={m.id}
                                        className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                                                Kamar {m.room_number}
                                            </p>
                                            {m.room_floor ? (
                                                <p className="font-inter text-xs text-[#999]">Lantai {m.room_floor}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${m.type === "water"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                {m.type === "water" ? "💧 Air" : "⚡ Listrik"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-[#555]">
                                            {m.device_uid}
                                        </td>
                                        <td className="px-6 py-4 font-inter text-sm text-[#666] uppercase">
                                            {m.unit}
                                        </td>
                                        <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                            {m.installed_at
                                                ? new Date(m.installed_at).toLocaleDateString("id-ID", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                {active
                                                    ? <Wifi size={14} className="text-green-600" />
                                                    : <WifiOff size={14} className="text-gray-400" />
                                                }
                                                <span className={`font-inter text-xs ${active ? "text-green-700" : "text-gray-500"
                                                    }`}>
                                                    {active ? "Aktif" : "Nonaktif"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    title="edit"
                                                    onClick={() => handleEdit(m)}
                                                    suppressHydrationWarning
                                                    className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                                >
                                                    <Pencil size={15} className="text-[#555]" />
                                                </button>
                                                <button
                                                    title="delete"
                                                    onClick={() => handleDelete(m)}
                                                    suppressHydrationWarning
                                                    className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100"
                                                >
                                                    <Trash2 size={15} className="text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Summary */}
            {!isLoading && meters.length > 0 && (
                <p className="font-inter text-sm text-[#777]">
                    Total {meters.length} alat terdaftar ·{" "}
                    {meters.filter((m) => Boolean(m.is_active)).length} aktif
                </p>
            )}

            <MeterFormModal
                open={modalOpen}
                editData={editData}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}