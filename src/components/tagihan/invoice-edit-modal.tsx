"use client";

import { useEffect, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { Invoice, InvoiceUpdatePayload } from "@/types/invoice";

type Props = {
    open: boolean;
    invoice: Invoice | null;
    onClose: () => void;
    onSubmit: (payload: InvoiceUpdatePayload) => Promise<void>;
};

function formatRupiah(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

export default function InvoiceEditModal({ open, invoice, onClose, onSubmit }: Props) {
    const [status, setStatus] = useState<"unpaid" | "paid" | "overdue">("unpaid");
    const [fineAmount, setFineAmount] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (invoice) {
            setStatus(invoice.status);
            setFineAmount(invoice.fine_amount);
            setDiscountPercent(invoice.discount_percent);
        }
    }, [invoice, open]);

    async function handleSubmit() {
        try {
            setLoading(true);
            await onSubmit({ status, fine_amount: fineAmount, discount_percent: discountPercent });
        } finally {
            setLoading(false);
        }
    }

    if (!open || !invoice) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Edit Tagihan</h3>
                    <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]" title="Tutup">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                {/* Info invoice (read-only) */}
                <div className="mt-4 rounded-2xl bg-[#F8F8F8] p-4 space-y-1">
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{invoice.tenant_name}</p>
                    <p className="font-inter text-xs text-[#777]">
                        Kamar {invoice.room_number} · {invoice.month}
                    </p>
                    <p className="font-inter text-xs text-[#777]">
                        Total: <span className="font-semibold text-[#2F2F2F]">{formatRupiah(invoice.total_amount)}</span>
                    </p>
                </div>

                <div className="mt-5 space-y-4">
                    {/* Status */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Status</label>
                        <select
                            title="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            suppressHydrationWarning
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        >
                            <option value="unpaid">Belum Bayar</option>
                            <option value="paid">Lunas</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>

                    {/* Denda */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Denda (Rp)</label>
                        <input
                            type="number"
                            value={fineAmount || ""}
                            onChange={(e) => setFineAmount(Number(e.target.value))}
                            suppressHydrationWarning
                            placeholder="0"
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>

                    {/* Diskon */}
                    <div>
                        <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">Diskon (%)</label>
                        <input
                            type="number"
                            value={discountPercent || ""}
                            onChange={(e) => setDiscountPercent(Number(e.target.value))}
                            suppressHydrationWarning
                            placeholder="0"
                            min={0}
                            max={100}
                            className="w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113]"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <LoaderCircle size={15} className="animate-spin" />}
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}