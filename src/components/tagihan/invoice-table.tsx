"use client";

import { Pencil } from "lucide-react";
import type { Invoice } from "@/types/invoice";

type Props = {
    invoices: Invoice[];
    onEdit: (invoice: Invoice) => void;
};

const STATUS_STYLE: Record<string, string> = {
    unpaid: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
    unpaid: "Belum Bayar",
    paid: "Lunas",
    overdue: "Overdue",
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
                <p className="font-inter text-sm text-[#999]">Tidak ada tagihan ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Penghuni</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kamar</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Bulan</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Jatuh Tempo</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Total</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
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
                                <td className="px-6 py-4">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{inv.tenant_name}</p>
                                    <p className="font-inter text-xs text-[#999]">{inv.tenant_email}</p>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {inv.room_number}
                                    {inv.room_floor ? ` · Lt ${inv.room_floor}` : ""}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{inv.month}</td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {new Date(inv.due_date).toLocaleDateString("id-ID", {
                                        day: "2-digit", month: "short", year: "numeric"
                                    })}
                                </td>
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {formatRupiah(inv.total_amount)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${STATUS_STYLE[inv.status] ?? "bg-gray-100 text-gray-700"}`}>
                                        {STATUS_LABEL[inv.status] ?? inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        title="Edit"
                                        onClick={() => onEdit(inv)}
                                        className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                    >
                                        <Pencil size={15} className="text-[#555]" />
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