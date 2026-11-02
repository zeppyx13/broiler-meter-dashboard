"use client";

const STATUS_OPTIONS = [
    { label: "Semua", value: "" },
    { label: "Open", value: "open" },
    { label: "Diproses", value: "in_progress" },
    { label: "Selesai", value: "closed" },
];

type Props = {
    status: string;
    onStatusChange: (v: string) => void;
};

export default function ComplaintFilterBar({ status, onStatusChange }: Props) {
    return (
        <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white w-fit">
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
    );
}