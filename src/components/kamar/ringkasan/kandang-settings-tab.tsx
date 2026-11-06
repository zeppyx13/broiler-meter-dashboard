"use client";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Pencil, Trash2 } from "lucide-react";
import SectionCard from "@/components/dashboard/section-card";
import { writeData } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import type { KandangData } from "./use-kandang-data";
import { apiErrorMessage } from "@/lib/api-error";

export default function KandangSettingsTab({ data, onEditRoom }: { data: KandangData; onEditRoom?: () => void }) {
    const router = useRouter();
    const b = useBroiler();
    const { room, coop, expectedPowerKw, activeCycle, canManage } = data;
    if (!room) return null;

    async function handleDelete() {
        const result = await Swal.fire({
            title: `Nonaktifkan Kandang ${room!.number}?`,
            text: "Kandang disembunyikan dari daftar. Riwayat siklus, sensor, dan peringatan tetap tersimpan di server.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, nonaktifkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;
        try {
            await writeData("delete", `/api/coops/${room!.id}`);
            await b.refresh();
            data.refreshAll();
            router.push("/dashboard/kamar");
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menonaktifkan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    const rows = [
        ["Kode kandang", room.number],
        ["Nama", coop?.name || "—"],
        ["Lahan", b.farms.find((f) => f.id === room.floor)?.name ?? "—"],
        ["Kapasitas", coop?.capacity_birds ? `${coop.capacity_birds.toLocaleString("id-ID")} ekor` : "—"],
        ["Daya seharusnya", expectedPowerKw ? `${expectedPowerKw.toFixed(2)} kW (dari tab Peralatan)` : "—"],
        ["Deskripsi", room.description || "—"],
    ];

    return (
        <div className="space-y-5">
            <SectionCard>
                <div className="flex items-center justify-between">
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Data kandang</p>
                    {onEditRoom && <button
                        onClick={onEditRoom}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-2 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                    >
                        <Pencil size={14} /> Edit
                    </button>}
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

            {canManage && <SectionCard>
                <p className="font-poppins text-base font-semibold text-[#B42318]">Nonaktifkan kandang</p>
                <p className="mt-1 font-inter text-sm text-[#777]">
                    {activeCycle ? "Tutup siklus yang sedang berjalan sebelum menonaktifkan kandang." : "Kandang tidak tampil lagi, tetapi riwayatnya tetap tersimpan sebagai audit."}
                </p>
                <button
                    onClick={handleDelete}
                    disabled={Boolean(activeCycle)}
                    suppressHydrationWarning
                    className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 font-inter text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                >
                    <Trash2 size={15} /> Nonaktifkan Kandang
                </button>
            </SectionCard>}
        </div>
    );
}
