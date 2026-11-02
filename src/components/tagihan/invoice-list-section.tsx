"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InvoiceFilterBar from "./invoice-filter-bar";
import InvoiceTable from "./invoice-table";
import InvoiceDetailModal from "./invoice-edit-modal";
import { getInvoices } from "@/lib/invoice-api";
import type { Invoice } from "@/types/invoice";

const LIMIT = 10;

export default function InvoiceListSection() {
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState("");
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["invoices", month, page],
        queryFn: () =>
            getInvoices({
                month: month || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    // Filter search di client side (API tidak support search by nomor kandang)
    const invoices = (data?.invoices ?? []).filter((inv) => {
        if (!search) return true;
        return inv.room_number.toLowerCase().includes(search.toLowerCase());
    });

    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleViewDetail(invoice: Invoice) {
        setSelectedInvoice(invoice);
        setModalOpen(true);
    }

    return (
        <div className="space-y-4">
            <InvoiceFilterBar
                search={search}
                month={month}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
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
                    Gagal memuat data laporan biaya energi.
                </div>
            )}

            {!isLoading && !isError && (
                <InvoiceTable invoices={invoices} onEdit={handleViewDetail} />
            )}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} laporan
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

            <InvoiceDetailModal
                open={modalOpen}
                invoice={selectedInvoice}
                onClose={() => setModalOpen(false)}
            />
        </div>
    );
}
