"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PaymentFilterBar from "./payment-filter-bar";
import PaymentTable from "./payment-table";
import { getPayments } from "@/lib/payment-api";

const LIMIT = 10;

export default function PaymentListSection() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["payments", status, page],
        queryFn: () =>
            getPayments({
                status: status || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    // Search filter client-side
    const payments = (data?.payments ?? []).filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            p.tenant_name.toLowerCase().includes(q) ||
            p.room_number.toLowerCase().includes(q)
        );
    });

    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    return (
        <div className="space-y-4">
            <PaymentFilterBar
                search={search}
                status={status}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                onStatusChange={(v) => { setStatus(v); setPage(1); }}
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
                    Gagal memuat data pembayaran.
                </div>
            )}

            {!isLoading && !isError && <PaymentTable payments={payments} />}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} transaksi
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
        </div>
    );
}