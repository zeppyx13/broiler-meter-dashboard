"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import Swal from "sweetalert2";
import { getFacilities, createFacility, updateFacility, deleteFacility } from "@/lib/facility-api";
import type { Facility } from "@/types/facility";

export default function FacilitySection() {
    const queryClient = useQueryClient();

    // State untuk tambah baru
    const [addName, setAddName] = useState("");
    const [addLoading, setAddLoading] = useState(false);

    // State untuk inline edit
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["facilities"],
        queryFn: getFacilities,
        staleTime: 60 * 1000,
    });

    const facilities = data?.facilities ?? [];

    async function handleAdd() {
        if (!addName.trim()) return;
        try {
            setAddLoading(true);
            await createFacility(addName.trim());
            queryClient.invalidateQueries({ queryKey: ["facilities"] });
            setAddName("");
            Swal.fire({ icon: "success", title: "Fasilitas ditambahkan", timer: 1200, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menambahkan",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        } finally {
            setAddLoading(false);
        }
    }

    function startEdit(f: Facility) {
        setEditId(f.id);
        setEditName(f.name);
    }

    function cancelEdit() {
        setEditId(null);
        setEditName("");
    }

    async function handleUpdate(id: number) {
        if (!editName.trim()) return;
        try {
            await updateFacility(id, editName.trim());
            queryClient.invalidateQueries({ queryKey: ["facilities"] });
            cancelEdit();
            Swal.fire({ icon: "success", title: "Diperbarui", timer: 1200, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal memperbarui",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    async function handleDelete(f: Facility) {
        const result = await Swal.fire({
            title: `Hapus "${f.name}"?`,
            text: "Fasilitas ini akan dihapus dari semua kamar.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;
        try {
            await deleteFacility(f.id);
            queryClient.invalidateQueries({ queryKey: ["facilities"] });
            Swal.fire({ icon: "success", title: "Dihapus", timer: 1200, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menghapus",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    return (
        <div className="space-y-6">
            {/* Form tambah */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <h3 className="font-poppins text-sm font-semibold text-[#2F2F2F]">Tambah Fasilitas Baru</h3>
                <div className="mt-3 flex gap-3">
                    <input
                        type="text"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        suppressHydrationWarning
                        placeholder="cth. WiFi, AC, Lemari, Parkir Motor..."
                        className="flex-1 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={addLoading || !addName.trim()}
                        suppressHydrationWarning
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        <Plus size={16} />
                        Tambah
                    </button>
                </div>
            </div>

            {/* List fasilitas */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                        Daftar Fasilitas
                    </h3>
                    <span className="rounded-full bg-[#F8F8F8] px-3 py-1 font-inter text-xs text-[#777]">
                        {facilities.length} fasilitas
                    </span>
                </div>

                {isLoading && (
                    <div className="flex flex-wrap gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-9 w-24 animate-pulse rounded-2xl bg-[#F0F0F0]" />
                        ))}
                    </div>
                )}

                {isError && (
                    <p className="text-sm text-red-500">Gagal memuat data fasilitas.</p>
                )}

                {!isLoading && !isError && facilities.length === 0 && (
                    <p className="font-inter text-sm text-[#999]">Belum ada fasilitas. Tambahkan di atas.</p>
                )}

                {!isLoading && !isError && (
                    <div className="flex flex-wrap gap-3">
                        {facilities.map((f) => (
                            <div
                                key={f.id}
                                className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2"
                            >
                                {editId === f.id ? (
                                    // Mode edit inline
                                    <>
                                        <input
                                            title="name"
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleUpdate(f.id);
                                                if (e.key === "Escape") cancelEdit();
                                            }}
                                            suppressHydrationWarning
                                            autoFocus
                                            className="w-28 bg-transparent font-inter text-sm outline-none"
                                        />
                                        <button
                                            title="save"
                                            onClick={() => handleUpdate(f.id)}
                                            suppressHydrationWarning
                                            className="text-green-600 hover:text-green-700"
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button
                                            title="cancel"
                                            onClick={cancelEdit}
                                            suppressHydrationWarning
                                            className="text-[#999] hover:text-[#555]"
                                        >
                                            <X size={14} />
                                        </button>
                                    </>
                                ) : (
                                    // Mode normal
                                    <>
                                        <span className="font-inter text-sm text-[#2F2F2F]">{f.name}</span>
                                        <button
                                            title="edit"
                                            onClick={() => startEdit(f)}
                                            suppressHydrationWarning
                                            className="text-[#AAA] transition hover:text-[#555]"
                                        >
                                            <Pencil size={13} />
                                        </button>
                                        <button
                                            title="delete"
                                            onClick={() => handleDelete(f)}
                                            suppressHydrationWarning
                                            className="text-[#AAA] transition hover:text-red-500"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}