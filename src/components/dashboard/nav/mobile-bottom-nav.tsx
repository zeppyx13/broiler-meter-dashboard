"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarMenuItem } from "@/types/dashboard";
import { NAV_ICONS, isNavActive } from "./nav-icons";

export default function MobileBottomNav({ menus }: { menus: SidebarMenuItem[] }) {
    const pathname = usePathname();
    const items = menus.filter((m) => m.mobile);

    return (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EAEAEA] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
                {items.map((menu) => {
                    const Icon = NAV_ICONS[menu.iconName];
                    const active = isNavActive(menu.href, pathname);
                    return (
                        <Link
                            key={menu.href}
                            href={menu.href}
                            className={`flex flex-col items-center gap-1 py-2.5 font-inter text-[11px] font-medium transition ${active ? "text-[#7B1113]" : "text-[#888]"}`}
                        >
                            <span className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-[#7B1113]/10" : ""}`}>
                                <Icon size={20} />
                            </span>
                            {menu.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
