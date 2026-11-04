"use client";

import { LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import type { SidebarMenuItem } from "@/types/dashboard";
import { NAV_ICONS, isNavActive } from "./nav-icons";
import { NavBadge } from "./sidebar-item";
import { useGuard } from "../guard/guard-monitor";
import { clearAuth, getUser } from "@/lib/auth";
import Image from "next/image";

type MobileDrawerProps = {
    menus: SidebarMenuItem[];
    open: boolean;
    onClose: () => void;
};

export default function MobileDrawer({ menus, open, onClose }: MobileDrawerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { counts } = useGuard();

    const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

    useEffect(() => {
        setUser(getUser());
    }, []);
    useEffect(() => {
        onClose();
    }, [pathname]);
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    async function handleLogout() {
        onClose();
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
        router.push("/");
        router.refresh();
    }

    return (
        <>
            <div
                onClick={onClose}
                className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 lg:hidden ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
            />
            {/* Lembar "Lainnya": hanya menu yang tidak ada di navigasi bawah, plus akun. */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Menu lainnya"
                className={`fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-[#EAEAEA] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 lg:hidden ${open ? "translate-y-0" : "translate-y-full"
                    }`}
            >
                <div className="flex items-center justify-between px-6 pb-2 pt-4">
                    <div className="flex items-center gap-2.5">
                        <Image src="/coasther.png" alt="" width={28} height={28} className="rounded-lg object-contain" />
                        <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Lainnya</p>
                    </div>
                    <button title="Tutup" onClick={onClose} className="rounded-xl p-2 transition hover:bg-[#F0F0F0]">
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="overflow-y-auto px-4 py-2">
                    {[
                        { title: null, items: menus.filter((m) => !m.group && !m.mobile) },
                        { title: "Teknis", items: menus.filter((m) => m.group === "teknis" && !m.mobile) },
                    ].filter((s) => s.items.length > 0).map((section) => (
                        <div key={section.title ?? "utama"} className={section.title ? "mt-4" : ""}>
                            {section.title && (
                                <p className="mb-1.5 px-4 font-inter text-[11px] font-semibold uppercase tracking-[0.18em] text-[#AAA]">
                                    {section.title}
                                </p>
                            )}
                            <div className="space-y-1">
                                {section.items.map((menu) => {
                                    const Icon = NAV_ICONS[menu.iconName];
                                    const isActive = isNavActive(menu.href, pathname);
                                    return (
                                        <Link
                                            key={menu.label}
                                            href={menu.href}
                                            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition ${isActive
                                                ? "bg-[#7B1113] text-[#C6A971]"
                                                : "text-[#555] hover:bg-[#F8F8F8]"
                                                }`}
                                        >
                                            <Icon size={18} />
                                            <span className="flex-1 font-inter text-sm font-medium">{menu.label}</span>
                                            {menu.alertBadge && counts.unchecked > 0 && <NavBadge count={counts.unchecked} />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
                <div className="px-4 pb-4 pt-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8F8F8] p-4">
                        <div className="min-w-0">
                            <p className="font-inter text-xs text-[#666]">Login sebagai</p>
                            <p className="mt-0.5 truncate font-poppins text-sm font-semibold text-[#2F2F2F]">{user?.name ?? "Admin"}</p>
                            <p className="truncate font-inter text-xs text-[#7B1113]">{user?.email ?? "-"}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex shrink-0 items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 font-inter text-sm font-medium text-red-600 transition hover:bg-red-100"
                        >
                            <LogOut size={16} />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}