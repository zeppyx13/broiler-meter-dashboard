"use client";

import { Eye } from "lucide-react";
import type { Invoice } from "@/types/invoice";

type Props = {
    invoices: Invoice[];
    onEdit: (invoice: Invoice) => void;
};

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

export default function InvoiceTable({ invoices, onEdit }: Props) {
    if (invoices.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada laporan biaya energi ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kandang</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Bulan</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Air</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Listrik</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Total Biaya</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Detail</th>
                    </tr>
                </thead>
                <tbody>
                    {invoices.map((inv, i) => {
                        const isLast = i === invoices.length - 1;
                        return (
                            <tr
                                key={inv.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {inv.room_number}
                                    {inv.room_floor ? ` · Blok ${inv.room_floor}` : ""}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{inv.month}</td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {inv.water_used} m³ · {formatRupiah(inv.water_cost)}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {inv.elec_used} kWh · {formatRupiah(inv.elec_cost)}
                                </td>
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {formatRupiah(inv.total_amount)}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        title="Lihat Detail"
                                        onClick={() => onEdit(inv)}
                                        className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                    >
                                        <Eye size={15} className="text-[#555]" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}