"use client";

type Props = {
    status: string;
    onStatusChange: (v: string) => void;
    onTambah: () => void;
};

const STATUS_OPTIONS = [
    { label: "Semua", value: "" },
    { label: "Aktif", value: "active" },
    { label: "Berakhir", value: "ended" },
];

export default function LeaseFilterBar({ status, onStatusChange, onTambah }: Props) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                {STATUS_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onStatusChange(opt.value)}
                        suppressHydrationWarning
                        className={`px-4 py-2.5 font-inter text-sm transition-colors ${status === opt.value
                                ? "bg-[#7B1113] text-white"
                                : "text-[#666] hover:bg-[#F8F8F8]"
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <button
                onClick={onTambah}
                suppressHydrationWarning
                className="rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
            >
                + Tambah Kontrak
            </button>
        </div>
    );
}