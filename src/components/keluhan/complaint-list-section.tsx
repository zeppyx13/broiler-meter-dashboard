"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import ComplaintFilterBar from "./complaint-filter-bar";
import ComplaintTable from "./complaint-table";
import { getComplaints, updateComplaintStatus } from "@/lib/complaint-api";
import type { Complaint } from "@/types/complaint";

const LIMIT = 10;

export default function ComplaintListSection() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["complaints-admin", status, page],
        queryFn: () =>
            getComplaints({
                status: status || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    const complaints = data?.complaints ?? [];
    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    async function handleUpdateStatus(
        complaint: Complaint,
        next: "open" | "in_progress" | "closed"
    ) {
        const labelMap: Record<string, string> = {
            open: "membuka kembali",
            in_progress: "memproses",
            closed: "menyelesaikan",
        };

        const result = await Swal.fire({
            title: `${labelMap[next]?.charAt(0).toUpperCase() + labelMap[next]?.slice(1)} keluhan ini?`,
            text: `"${complaint.title}"`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });

        if (!result.isConfirmed) return;

        try {
            await updateComplaintStatus(complaint.id, next);
            queryClient.invalidateQueries({ queryKey: ["complaints-admin"] });
            Swal.fire({
                icon: "success",
                title: "Status diperbarui",
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal memperbarui",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    return (
        <div className="space-y-4">
            <ComplaintFilterBar
                status={status}
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
                    Gagal memuat data keluhan.
                </div>
            )}

            {!isLoading && !isError && (
                <ComplaintTable
                    complaints={complaints}
                    onUpdateStatus={handleUpdateStatus}
                />
            )}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} keluhan
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