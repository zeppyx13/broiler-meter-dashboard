"use client";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Pencil, Trash2 } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { deleteRoom } from "@/lib/room-api";
import type { KandangData } from "./use-kandang-data";

export default function KandangSettingsTab({ data, onEditRoom }: { data: KandangData; onEditRoom: () => void }) {
    const router = useRouter();
    const { room, roomExtra, expectedPowerKw, activeCycle } = data;
    if (!room) return null;

    async function handleDelete() {
        const result = await Swal.fire({
            title: `Hapus Kandang ${room!.number}?`,
            text: "Kandang yang dihapus tidak bisa dikembalikan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;
        try {
            await deleteRoom(room!.id);
            data.refreshAll();
            router.push("/dashboard/kamar");
        } catch (err: any) {
            Swal.fire({ icon: "error", title: "Gagal menghapus", text: err?.response?.data?.message || "Terjadi kesalahan.", confirmButtonColor: "#7B1113" });
        }
    }

    const rows = [
        ["Nomor kandang", room.number],
        ["Blok", room.floor != null ? `Blok ${room.floor}` : "—"],
        ["Fase listrik panel", roomExtra.phase_count ? `${roomExtra.phase_count} fase` : "—"],
        ["Daya seharusnya", expectedPowerKw ? `${expectedPowerKw.toFixed(2)} kW (dari tab Peralatan)` : "—"],
        ["Deskripsi", room.description || "—"],
    ];

    return (
        <div className="space-y-5">
            <SectionCard>
                <div className="flex items-center justify-between">
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Data kandang</p>
                    <button
                        onClick={onEditRoom}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-2 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                    >
                        <Pencil size={14} /> Edit
                    </button>
                </div>
                <dl className="mt-4 divide-y divide-[#F0F0F0]">
                    {rows.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 py-3 font-inter text-sm">
                            <dt className="text-[#999]">{label}</dt>
                            <dd className="text-right font-medium text-[#2F2F2F]">{value}</dd>
                        </div>
                    ))}
                </dl>
            </SectionCard>

            <SectionCard>
                <p className="font-poppins text-base font-semibold text-[#B42318]">Hapus kandang</p>
                <p className="mt-1 font-inter text-sm text-[#777]">
                    {activeCycle ? "Tutup siklus yang sedang berjalan sebelum menghapus kandang." : "Data kandang ini akan dihapus permanen."}
                </p>
                <button
                    onClick={handleDelete}
                    disabled={Boolean(activeCycle)}
                    suppressHydrationWarning
                    className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 font-inter text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                >
                    <Trash2 size={15} /> Hapus Kandang
                </button>
            </SectionCard>
        </div>
    );
}
