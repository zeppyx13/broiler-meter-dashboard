"use client";

import type { Payment } from "@/types/payment";

type Props = {
    payments: Payment[];
};

const STATUS_STYLE: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    expired: "bg-gray-100 text-gray-600",
    cancelled: "bg-orange-100 text-orange-700",
};

const STATUS_LABEL: Record<string, string> = {
    pending: "Pending",
    paid: "Lunas",
    failed: "Gagal",
    expired: "Expired",
    cancelled: "Dibatalkan",
};

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

export default function PaymentTable({ payments }: Props) {
    if (payments.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada data pembayaran.</p>
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
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Metode</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Jumlah</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Status</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Waktu Bayar</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map((p, i) => {
                        const isLast = i === payments.length - 1;
                        return (
                            <tr
                                key={p.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{p.tenant_name}</p>
                                    <p className="font-inter text-xs text-[#999]">{p.tenant_email}</p>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {p.room_number}
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {p.invoice_month}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="rounded-xl bg-[#F8F8F8] px-3 py-1 font-inter text-xs font-medium text-[#555] capitalize">
                                        {p.provider}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-poppins text-sm font-semibold text-[#2F2F2F]">
                                    {formatRupiah(p.amount)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                                        {STATUS_LABEL[p.status] ?? p.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {p.paid_at
                                        ? new Date(p.paid_at).toLocaleDateString("id-ID", {
                                            day: "2-digit", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                        })
                                        : "-"
                                    }
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}