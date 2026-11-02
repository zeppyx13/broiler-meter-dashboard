"use client";

import { useQuery } from "@tanstack/react-query";
import RoomsTable from "./rooms-table";
import { getRoomsDashboard } from "@/lib/dashboard-api";

export default function RoomsSection() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["dashboard-rooms"],
        queryFn: getRoomsDashboard,
    });

    const rooms = data?.data?.data ?? [];

    if (isLoading) {
        return (
            <div className="xl:col-span-2 rounded-3xl border border-[#EAEAEA] bg-white p-6">
                <p className="font-inter text-sm text-[#777]">
                    Memuat data kamar...
                </p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="xl:col-span-2 rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat data kamar.
            </div>
        );
    }

    return <RoomsTable rooms={rooms} />;
}