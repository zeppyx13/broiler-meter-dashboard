"use client";

import type { ReactNode } from "react";
import { X, Minus, Plus, LoaderCircle } from "lucide-react";

export const inputClass =
    "w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3 font-inter text-sm outline-none transition focus:border-[#7B1113] disabled:opacity-50";

export function ModalShell({
    title,
    subtitle,
    onClose,
    children,
    footer,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
                <div className="flex items-start justify-between border-b border-[#EAEAEA] px-6 pb-4 pt-6">
                    <div>
                        <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">{title}</h3>
                        {subtitle && <p className="mt-0.5 font-inter text-xs text-[#999]">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]" title="Tutup">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                <div className="flex justify-end gap-3 border-t border-[#EAEAEA] px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block font-inter text-sm font-medium text-[#2F2F2F]">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 font-inter text-xs text-[#999]">{hint}</p>}
        </div>
    );
}

/** Input angka dengan tombol besar — nyaman dipakai di kandang. */
export function NumberStepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                suppressHydrationWarning
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#EAEAEA] bg-white text-[#555] transition hover:bg-[#F8F8F8] active:scale-95"
                aria-label="Kurangi"
            >
                <Minus size={18} />
            </button>
            <input
                type="number"
                inputMode="numeric"
                min={min}
                value={value}
                onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
                suppressHydrationWarning
                className="h-12 w-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] text-center font-poppins text-lg font-semibold outline-none focus:border-[#7B1113]"
            />
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                suppressHydrationWarning
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#EAEAEA] bg-white text-[#555] transition hover:bg-[#F8F8F8] active:scale-95"
                aria-label="Tambah"
            >
                <Plus size={18} />
            </button>
        </div>
    );
}

export function CancelButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="rounded-2xl border border-[#EAEAEA] px-5 py-2.5 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
        >
            Batal
        </button>
    );
}

export function PrimaryButton({
    onClick, disabled, loading, children, tone = "brand",
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    children: ReactNode;
    tone?: "brand" | "danger";
}) {
    const color = tone === "danger" ? "bg-[#B42318] text-white" : "bg-[#7B1113] text-[#C6A971]";
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            suppressHydrationWarning
            className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 font-poppins text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 ${color}`}
        >
            {loading && <LoaderCircle size={15} className="animate-spin" />}
            {children}
        </button>
    );
}
