"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import LeaseFilterBar from "./lease-filter-bar";
import LeaseTable, { type CycleRow } from "./lease-table";
import { readData, type Cycle } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";

const LIMIT = 10;

/** Riwayat siklus semua kandang yang bisa diakses, dari `/api/flock-cycles` per kandang. */
export default function LeaseListSection() {
    const b = useBroiler();
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const queries = useQueries({
        queries: b.coops.map((c) => ({
            queryKey: ["broiler", b.user?.id, c.id, "cycles", 50],
            queryFn: () => readData<{ cycles: Cycle[] }>("/api/flock-cycles", { coop_id: c.id, limit: 50 }),
            staleTime: 30_000,
        })),
    });
    const isLoading = b.loading || queries.some((q) => q.isPending);
    const isError = queries.length > 0 && queries.every((q) => q.isError);
    const updatedKey = queries.map((q) => q.dataUpdatedAt).join(",");

    const rows = useMemo<CycleRow[]>(() => {
        const all = queries.flatMap((q, i) => {
            const coop = b.coops[i];
            return (q.data?.cycles ?? [])
                .filter((c) => c.status === "active" || c.status === "completed")
                .map((cycle) => ({ cycle, coopCode: coop?.code ?? String(cycle.coop_id), farmName: b.farms.find((f) => f.id === coop?.farm_id)?.name }));
        });
        return all
            .filter((r) => !status || (status === "active" ? r.cycle.status === "active" : r.cycle.status !== "active"))
            .sort((a, c) => c.cycle.placement_date.localeCompare(a.cycle.placement_date));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updatedKey, b.coops, b.farms, status]);

    const totalPages = Math.max(1, Math.ceil(rows.length / LIMIT));
    const current = Math.min(page, totalPages);
    const pageRows = rows.slice((current - 1) * LIMIT, current * LIMIT);

    return (
        <div className="space-y-4">
            <LeaseFilterBar status={status} onStatusChange={(v) => { setStatus(v); setPage(1); }} />

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">Gagal memuat data siklus produksi.</div>
            )}

            {!isLoading && !isError && <LeaseTable rows={pageRows} />}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">Halaman {current} dari {totalPages} · {rows.length} siklus</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(Math.max(1, current - 1))}
                            disabled={current === 1}
                            suppressHydrationWarning
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage(Math.min(totalPages, current + 1))}
                            disabled={current === totalPages}
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
