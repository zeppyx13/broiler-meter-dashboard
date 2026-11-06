"use client";

type Props = {
    status: string;
    onStatusChange: (v: string) => void;
};

const STATUS_OPTIONS = [
    { label: "Semua", value: "" },
    { label: "Berjalan", value: "active" },
    { label: "Selesai", value: "ended" },
];

export default function LeaseFilterBar({ status, onStatusChange }: Props) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-fit overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                {STATUS_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onStatusChange(opt.value)}
                        suppressHydrationWarning
                        className={`px-4 py-2.5 font-inter text-sm transition-colors ${status === opt.value ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            <p className="font-inter text-xs text-[#999]">Siklus dimulai, dicatat, dan dipanen dari halaman tiap kandang.</p>
        </div>
    );
}
