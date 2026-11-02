"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import TenantFilterBar from "./tenant-filter-bar";
import TenantTable from "./tenant-table";
import TenantFormModal from "./tenant-form-modal";
import { getTenants, updateTenant, deleteTenant } from "@/lib/tenant-api";
import type { Tenant, TenantFormPayload } from "@/types/tenant";

const LIMIT = 10;

export default function TenantListSection() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [role, setRole] = useState<"" | "tenant" | "admin" | "manager">("");
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<Tenant | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["tenants", search, role, page],
        queryFn: () =>
            getTenants({
                search: search || undefined,
                role: role || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    const tenants = data?.users ?? [];
    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleSearchChange(v: string) { setSearch(v); setPage(1); }
    function handleRoleChange(v: "" | "tenant" | "admin" | "manager") { setRole(v); setPage(1); }

    function handleEdit(tenant: Tenant) {
        setEditData(tenant);
        setModalOpen(true);
    }

    async function handleDelete(tenant: Tenant) {
        const result = await Swal.fire({
            title: `Hapus ${tenant.name}?`,
            text: "Semua data terkait penghuni ini (invoice, lease, complaint) akan ikut terhapus.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });

        if (!result.isConfirmed) return;

        try {
            await deleteTenant(tenant.id);
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            Swal.fire({ icon: "success", title: "Penghuni dihapus", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menghapus",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    const handleSubmit = useCallback(async (payload: TenantFormPayload) => {
        try {
            if (editData) await updateTenant(editData.id, payload);
            queryClient.invalidateQueries({ queryKey: ["tenants"] });
            setModalOpen(false);
            Swal.fire({ icon: "success", title: "Data diperbarui", timer: 1500, showConfirmButton: false });
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
            <TenantFilterBar
                search={search}
                role={role}
                onSearchChange={handleSearchChange}
                onRoleChange={handleRoleChange}
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
                    Gagal memuat data penghuni.
                </div>
            )}

            {!isLoading && !isError && (
                <TenantTable tenants={tenants} onEdit={handleEdit} onDelete={handleDelete} />
            )}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} penghuni
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            <TenantFormModal
                open={modalOpen}
                editData={editData}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}