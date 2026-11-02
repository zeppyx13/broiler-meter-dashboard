import type { ReactNode } from "react";

type SectionCardProps = {
    children: ReactNode;
    className?: string;
};

export default function SectionCard({
    children,
    className = "",
}: SectionCardProps) {
    return (
        <div
            className={`rounded-3xl border border-[#EAEAEA] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}
        >
            {children}
        </div>
    );
}