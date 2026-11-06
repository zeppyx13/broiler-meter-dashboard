"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type SidebarItemProps = {
    icon: LucideIcon;
    label: string;
    href: string;
    active?: boolean;
    badge?: number;
};

export default function SidebarItem({ icon: Icon, label, href, active = false, badge }: SidebarItemProps) {
    return (
        <Link
            href={href}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition ${active
                    ? "bg-[#7B1113] text-[#C6A971]"
                    : "text-[#555] hover:bg-[#F8F8F8]"
                }`}
        >
            <Icon size={18} />
            <span className="flex-1 font-inter text-sm font-medium">{label}</span>
            {badge ? <NavBadge count={badge} /> : null}
        </Link>
    );
}

export function NavBadge({ count, className = "" }: { count: number; className?: string }) {
    return (
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B42318] px-1.5 font-inter text-[11px] font-semibold text-white ${className}`}>
            {count > 99 ? "99+" : count}
        </span>
    );
}
