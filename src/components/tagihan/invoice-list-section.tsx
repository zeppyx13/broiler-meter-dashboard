"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import InvoiceFilterBar from "./invoice-filter-bar";
import InvoiceTable from "./invoice-table";
import InvoiceEditModal from "./invoice-edit-modal";
import { getInvoices, updateInvoice } from "@/lib/invoice-api";
import type { Invoice, InvoiceUpdatePayload } from "@/types/invoice";

const LIMIT = 10;

export default function InvoiceListSection() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [month, setMonth] = useState("");
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["invoices", status, month, page],
        queryFn: () =>
            getInvoices({
                status: status || undefined,
                month: month || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    // Filter search di client side (API tidak support search by name)
    const invoices = (data?.invoices ?? []).filter((inv) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            inv.tenant_name.toLowerCase().includes(q) ||
            inv.room_number.toLowerCase().includes(q)
        );
    });

    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleEdit(invoice: Invoice) {
        setEditInvoice(invoice);
        setModalOpen(true);
    }

    const handleSubmit = useCallback(async (payload: InvoiceUpdatePayload) => {
        if (!editInvoice) return;
        try {
            await updateInvoice(editInvoice.id, payload);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            setModalOpen(false);
            Swal.fire({ icon: "success", title: "Tagihan diperbarui", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menyimpan",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }, [editInvoice, queryClient]);

    return (
        <div className="space-y-4">
            <InvoiceFilterBar
                search={search}
                status={status}
                month={month}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                onStatusChange={(v) => { setStatus(v); setPage(1); }}
                onMonthChange={(v) => { setMonth(v); setPage(1); }}
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
                    Gagal memuat data tagihan.
                </div>
            )}

            {!isLoading && !isError && (
                <InvoiceTable invoices={invoices} onEdit={handleEdit} />
            )}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} tagihan
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

            <InvoiceEditModal
                open={modalOpen}
                invoice={editInvoice}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}