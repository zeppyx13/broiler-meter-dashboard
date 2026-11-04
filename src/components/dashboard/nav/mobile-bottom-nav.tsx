"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import type { SidebarMenuItem } from "@/types/dashboard";
import { NAV_ICONS, isNavActive } from "./nav-icons";
import { NavBadge } from "./sidebar-item";
import { useGuard } from "../guard/guard-monitor";

type Props = {
    menus: SidebarMenuItem[];
    /** Buka lembar "Lainnya" (menu yang tidak muat di navigasi bawah). */
    onMoreClick: () => void;
    moreOpen: boolean;
};

export default function MobileBottomNav({ menus, onMoreClick, moreOpen }: Props) {
    const pathname = usePathname();
    const { counts } = useGuard();
    const items = menus.filter((m) => m.mobile);
    const moreActive = moreOpen || menus.some((m) => !m.mobile && isNavActive(m.href, pathname));

    const itemCls = (active: boolean) => `flex flex-col items-center gap-1 py-2.5 font-inter text-[11px] font-medium transition ${active ? "text-[#7B1113]" : "text-[#888]"}`;
    const iconCls = (active: boolean) => `relative flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-[#7B1113]/10" : ""}`;

    return (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EAEAEA] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
                {items.map((menu) => {
                    const Icon = NAV_ICONS[menu.iconName];
                    const active = isNavActive(menu.href, pathname) && !moreOpen;
                    return (
                        <Link key={menu.href} href={menu.href} className={itemCls(active)}>
                            <span className={iconCls(active)}>
                                <Icon size={20} />
                                {menu.alertBadge && counts.unchecked > 0 && (
                                    <NavBadge count={counts.unchecked} className="absolute -right-0.5 -top-1" />
                                )}
                            </span>
                            {menu.label}
                        </Link>
                    );
                })}
                <button type="button" onClick={onMoreClick} aria-expanded={moreOpen} suppressHydrationWarning className={itemCls(moreActive)}>
                    <span className={iconCls(moreActive)}>
                        <LayoutGrid size={20} />
                    </span>
                    Lainnya
                </button>
            </div>
        </nav>
    );
}
