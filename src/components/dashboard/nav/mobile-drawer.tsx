"use client";

import {
    LogOut, Home, BedDouble, Users,
    FileText, CreditCard, Settings, X,
    MessageSquare, FileCheck, Megaphone, Sparkles, Cpu, Star, Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import type { SidebarIconName, SidebarMenuItem } from "@/types/dashboard";
import { clearAuth, getUser } from "@/lib/auth";
import Image from "next/image";
const iconMap: Record<SidebarIconName, LucideIcon> = {
    home: Home,
    bedDouble: BedDouble,
    users: Users,
    fileText: FileText,
    creditCard: CreditCard,
    settings: Settings,
    messageSquare: MessageSquare,
    fileCheck: FileCheck,
    megaphone: Megaphone,
    sparkles: Sparkles,
    cpu: Cpu,
    star: Star,
    terminal: Terminal,
};

type MobileDrawerProps = {
    menus: SidebarMenuItem[];
    open: boolean;
    onClose: () => void;
};

export default function MobileDrawer({ menus, open, onClose }: MobileDrawerProps) {
    const router = useRouter();
    const pathname = usePathname();

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
                className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
            />
            <aside
                className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[#EAEAEA] bg-white shadow-xl transition-transform duration-300 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="flex items-center justify-between border-b border-[#EAEAEA] px-6 py-5">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/coasther.png"
                            alt="Coasther Logo"
                            width={40}
                            height={40}
                            className="rounded-xl object-contain"
                        />
                        <div>
                            <p className="font-inter text-xs font-medium uppercase tracking-[0.2em] text-[#7B1113]">
                                Coasther
                            </p>
                            <h1 className="mt-0.5 font-poppins text-xl font-bold text-[#2F2F2F]">
                                Admin Panel
                            </h1>
                        </div>
                    </div>
                    <button
                        title="close"
                        onClick={onClose}
                        className="rounded-xl p-2 transition hover:bg-[#F0F0F0]"
                    >
                        <X size={18} className="text-[#666]" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="space-y-2">
                        {menus.map((menu) => {
                            const Icon = iconMap[menu.iconName];
                            const isActive =
                                menu.href === "/dashboard"
                                    ? pathname === "/dashboard"
                                    : pathname === menu.href || pathname.startsWith(menu.href + "/");

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
                                    <span className="font-inter text-sm font-medium">
                                        {menu.label}
                                    </span>
                                </Link>
                            );
                        })}
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
        </>
    );
}