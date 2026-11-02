"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import LeaseFilterBar from "./lease-filter-bar";
import LeaseTable from "./lease-table";
import LeaseFormModal from "./lease-form-modal";
import { getLeases, createLease, updateLease, deleteLease } from "@/lib/lease-api";
import type { Lease, LeaseFormPayload, LeaseUpdatePayload } from "@/types/lease";

const LIMIT = 10;

export default function LeaseListSection() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<Lease | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["leases", status, page],
        queryFn: () =>
            getLeases({ status: status || undefined, page, limit: LIMIT }),
        staleTime: 30 * 1000,
    });

    const leases = data?.leases ?? [];
    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleTambah() { setEditData(null); setModalOpen(true); }
    function handleEdit(lease: Lease) { setEditData(lease); setModalOpen(true); }

    async function handleDelete(lease: Lease) {
        const result = await Swal.fire({
            title: `Hapus kontrak ini?`,
            text: `${lease.tenant_name} — Kamar ${lease.room_number}. Kamar akan otomatis tersedia kembali.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;

        try {
            await deleteLease(lease.id);
            queryClient.invalidateQueries({ queryKey: ["leases"] });
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            Swal.fire({ icon: "success", title: "Kontrak dihapus", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menghapus",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    const handleSubmit = useCallback(async (payload: LeaseFormPayload | LeaseUpdatePayload) => {
        try {
            if (editData) {
                await updateLease(editData.id, payload as LeaseUpdatePayload);
            } else {
                await createLease(payload as LeaseFormPayload);
            }
            queryClient.invalidateQueries({ queryKey: ["leases"] });
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            setModalOpen(false);
            Swal.fire({ icon: "success", title: editData ? "Kontrak diperbarui" : "Kontrak dibuat", timer: 1500, showConfirmButton: false });
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
            <LeaseFilterBar
                status={status}
                onStatusChange={(v) => { setStatus(v); setPage(1); }}
                onTambah={handleTambah}
            />

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data kontrak.
                </div>
            )}

            {!isLoading && !isError && (
                <LeaseTable leases={leases} onEdit={handleEdit} onDelete={handleDelete} />
            )}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} kontrak
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            suppressHydrationWarning
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            suppressHydrationWarning
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            <LeaseFormModal
                open={modalOpen}
                editData={editData}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}