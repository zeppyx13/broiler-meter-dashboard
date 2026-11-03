"use client";

import { useRef } from "react";
import Swal from "sweetalert2";
import { Download, Upload, HardDrive } from "lucide-react";
import { exportLocalData, importLocalData, localDateKey } from "@/lib/broiler-local-store";

export default function LocalDataCard() {
    const fileRef = useRef<HTMLInputElement>(null);

    function handleExport() {
        const blob = new Blob([exportLocalData()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `coasther-cadangan-${localDateKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (fileRef.current) fileRef.current.value = "";
        if (!file) return;

        const confirm = await Swal.fire({
            title: "Impor cadangan?",
            text: "Data di perangkat ini dengan kunci yang sama akan ditimpa.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, impor",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });
        if (!confirm.isConfirmed) return;

        try {
            const count = importLocalData(await file.text());
            await Swal.fire({ icon: "success", title: "Cadangan diimpor", text: `${count} data dipulihkan.`, confirmButtonColor: "#7B1113" });
            window.location.reload();
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal impor", text: err instanceof Error ? err.message : "File tidak valid.", confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                    <HardDrive size={20} className="text-[#7B1113]" />
                </div>
                <div>
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Data di Perangkat Ini</h3>
                    <p className="mt-1 font-inter text-sm text-[#666]">
                        Populasi, catatan harian, data siklus, dan daya terpasang disimpan di browser ini.
                        Cadangkan secara berkala, lalu impor di perangkat lain bila perlu.
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                <button
                    onClick={handleExport}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90"
                >
                    <Download size={15} /> Cadangkan
                </button>
                <button
                    onClick={() => fileRef.current?.click()}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                >
                    <Upload size={15} /> Impor
                </button>
                <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} className="hidden" title="Pilih file cadangan" />
            </div>
        </div>
    );
}
