"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type SidebarItemProps = {
    icon: LucideIcon;
    label: string;
    href: string;
    active?: boolean;
};

export default function SidebarItem({
    icon: Icon,
    label,
    href,
    active = false,
}: SidebarItemProps) {
    return (
        <Link
            href={href}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition ${active
                    ? "bg-[#7B1113] text-[#C6A971]"
                    : "text-[#555] hover:bg-[#F8F8F8]"
                }`}
        >
            <Icon size={18} />
            <span className="font-inter text-sm font-medium">{label}</span>
        </Link>
    );
}