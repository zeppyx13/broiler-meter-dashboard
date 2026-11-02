"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComplaintsList from "./complaints-list";
import { getComplaints } from "@/lib/dashboard-api";
import { updateComplaintStatus } from "@/lib/complaint-api";

export default function ComplaintsSection() {
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ["dashboard-complaints"],
        queryFn: () => getComplaints(1, 2, "open"),
        refetchInterval: 60 * 1000,
    });

    const complaints = data?.data?.complaints ?? [];

    async function handleUpdateStatus(id: number, status: "open" | "in_progress" | "closed") {
        try {
            await updateComplaintStatus(id, status);
            queryClient.invalidateQueries({ queryKey: ["dashboard-complaints"] });
        } catch (err) {
            console.error("Gagal update status complaint:", err);
        }
    }

    if (isLoading) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <p className="font-inter text-sm text-[#777]">Memuat complaints...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat complaints.
            </div>
        );
    }

    return <ComplaintsList items={complaints} onUpdateStatus={handleUpdateStatus} />;
}