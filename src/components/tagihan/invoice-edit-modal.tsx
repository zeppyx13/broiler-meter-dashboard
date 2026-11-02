"use client";

import { X } from "lucide-react";
import type { Invoice } from "@/types/invoice";

type Props = {
    open: boolean;
    invoice: Invoice | null;
    onClose: () => void;
};

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

export default function InvoiceDetailModal({ open, invoice, onClose }: Props) {
    if (!open || !invoice) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Detail Laporan Biaya Energi</h3>
                    <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]" title="Tutup">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                <div className="mt-4 rounded-2xl bg-[#F8F8F8] p-4">
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                        Kandang {invoice.room_number}{invoice.room_floor ? ` · Blok ${invoice.room_floor}` : ""}
                    </p>
                    <p className="font-inter text-xs text-[#777]">{invoice.month}</p>
                </div>

                <div className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between font-inter text-sm">
                        <span className="text-[#666]">Pemakaian Air</span>
                        <span className="font-medium text-[#2F2F2F]">{invoice.water_used} m³ · {formatRupiah(invoice.water_cost)}</span>
                    </div>
                    <div className="flex items-center justify-between font-inter text-sm">
                        <span className="text-[#666]">Pemakaian Listrik</span>
                        <span className="font-medium text-[#2F2F2F]">{invoice.elec_used} kWh · {formatRupiah(invoice.elec_cost)}</span>
                    </div>
                    {invoice.fine_amount > 0 && (
                        <div className="flex items-center justify-between font-inter text-sm">
                            <span className="text-[#666]">Biaya Tambahan</span>
                            <span className="font-medium text-[#2F2F2F]">{formatRupiah(invoice.fine_amount)}</span>
                        </div>
                    )}
                    {invoice.discount_amount > 0 && (
                        <div className="flex items-center justify-between font-inter text-sm">
                            <span className="text-[#666]">Penyesuaian</span>
                            <span className="font-medium text-[#2F2F2F]">-{formatRupiah(invoice.discount_amount)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-2.5 font-inter text-sm">
                        <span className="font-semibold text-[#2F2F2F]">Total Biaya Energi</span>
                        <span className="font-poppins font-bold text-[#7B1113]">{formatRupiah(invoice.total_amount)}</span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    Tutup
                </button>
            </div>
        </div>
    );
}
