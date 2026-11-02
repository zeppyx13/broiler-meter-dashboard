"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/dashboard-api";
import SectionCard from "../section-card";
import SummaryItem from "./summary-item";

function formatRupiah(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

export default function SummarySection() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["dashboard-summary"],
        queryFn: getDashboardSummary,
        refetchInterval: 5 * 60 * 1000,
        staleTime: 4 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="h-72 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat ringkasan pendapatan.
            </div>
        );
    }

    const items = [
        {
            label: "Kamar terisi",
            value: `${data.occupiedRooms}/${data.totalRooms}`,
        },
        {
            label: "Tagihan lunas",
            value: String(data.paidInvoices),
        },
        {
            label: "Belum bayar",
            value: String(data.unpaidInvoices),
        },
        {
            label: "Pemakaian tertinggi",
            value: data.highestUsageRoom ? `Kamar ${data.highestUsageRoom}` : "-",
        },
    ];

    return (
        <SectionCard>
            <p className="font-inter text-sm text-[#666]">Ringkasan Bulan Ini</p>
            <h3 className="mt-1 font-poppins text-xl font-semibold text-[#2F2F2F]">
                Estimasi Pendapatan
            </h3>

            <div className="mt-6 rounded-3xl bg-[#7B1113] p-5 text-white">
                <p className="font-inter text-sm text-white/80">Total pemasukan</p>
                <h4 className="mt-2 font-poppins text-3xl font-bold text-[#C6A971]">
                    {formatRupiah(data.totalIncome)}
                </h4>
                <p className="mt-2 font-inter text-xs text-white/80">
                    Termasuk sewa kamar, air, dan listrik.
                </p>
            </div>

            <div className="mt-5 space-y-3">
                {items.map((item) => (
                    <SummaryItem
                        key={item.label}
                        label={item.label}
                        value={item.value}
                    />
                ))}
            </div>
        </SectionCard>
    );
}