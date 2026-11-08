"use client";
import { useBroiler } from "@/components/broiler/broiler-provider";

import { LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Swal from "sweetalert2";
import SidebarItem from "./sidebar-item";
import { NAV_ICONS, isNavActive } from "./nav-icons";
import { useGuard } from "../guard/guard-monitor";
import type { SidebarMenuItem } from "@/types/dashboard";
import { clearAuth } from "@/lib/auth";
import Image from "next/image";

type DashboardSidebarProps = {
    menus: SidebarMenuItem[];
};

export default function DashboardSidebar({ menus }: DashboardSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { counts } = useGuard();

    const { user } = useBroiler();

    async function handleLogout() {
        const result = await Swal.fire({
            title: "Logout?",
            text: "Anda akan keluar dari dashboard.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, logout",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
            cancelButtonColor: "#7B1113",
        });

        if (!result.isConfirmed) return;

        clearAuth();
        window.dispatchEvent(new Event("coasther:unauthorized"));
        router.push("/");
        router.refresh();
    }

    return (
        <aside className="hidden w-72 flex-col border-r border-[#EAEAEA] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0">
            <div className="border-b border-[#EAEAEA] px-6 py-5">
                <div className="flex items-center gap-3">
                    <Image
                        src="/coasther.png"
                        alt="Coasther Broiler Logo"
                        width={46}
                        height={46}
                        className="rounded-xl object-contain shadow-sm"
                        priority
                    />
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="font-inter text-xs font-bold uppercase tracking-[0.18em] text-[#7B1113]">
                                Coasther
                            </p>
                        </div>
                        <h1 className="mt-0.5 font-poppins text-base font-bold text-[#2F2F2F] leading-tight">
                            Broiler Monitor
                        </h1>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6">
                <div className="space-y-2">
                    {menus.filter((m) => !m.group).map((menu) => (
                        <SidebarItem
                            key={menu.label}
                            icon={NAV_ICONS[menu.iconName]}
                            label={menu.label}
                            href={menu.href}
                            active={isNavActive(menu.href, pathname)}
                            badge={menu.alertBadge ? counts.unchecked : undefined}
                        />
                    ))}
                </div>

                <p className="mt-8 mb-2 px-4 font-inter text-[11px] font-semibold uppercase tracking-[0.18em] text-[#AAA]">
                    Teknis
                </p>
                <div className="space-y-2">
                    {menus.filter((m) => m.group === "teknis").map((menu) => (
                        <SidebarItem
                            key={menu.label}
                            icon={NAV_ICONS[menu.iconName]}
                            label={menu.label}
                            href={menu.href}
                            active={isNavActive(menu.href, pathname)}
                        />
                    ))}
                </div>
            </nav>

            <div className="border-t border-[#EAEAEA] p-4">
                <div className="rounded-2xl bg-[#F8F8F8] p-4">
                    <p className="font-inter text-xs text-[#666]">Login sebagai</p>
                    <p className="mt-1 font-poppins text-sm font-semibold text-[#2F2F2F]">
                        {user?.name ?? "Admin"}
                    </p>
                    <p className="mt-1 font-inter text-xs text-[#7B1113]">
                        {user?.email ?? "-"}
                    </p>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-inter text-sm font-medium text-red-600 transition hover:bg-red-100"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
}