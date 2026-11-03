"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getUser } from "@/lib/auth";

type DashboardTopbarProps = {
    onMenuClick: () => void;
};

// Urut dari path paling spesifik; dicocokkan dengan startsWith untuk halaman dinamis.
const PAGE_TITLES: { path: string; label: string; title: string }[] = [
    { path: "/dashboard/kamar/", label: "Kandang", title: "Detail Kandang" },
    { path: "/dashboard/kamar", label: "Kelola", title: "Kandang" },
    { path: "/dashboard/tagihan", label: "Efisiensi", title: "Laporan" },
    { path: "/dashboard/settings", label: "Akun & Tarif", title: "Pengaturan" },
    { path: "/dashboard/iot", label: "Teknis", title: "Alat IoT" },
    { path: "/dashboard/terminal", label: "Teknis", title: "IoT Terminal" },
    { path: "/dashboard", label: "Selamat datang kembali", title: "Beranda" },
];

export default function DashboardTopbar({ onMenuClick }: DashboardTopbarProps) {
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string } | null>(null);

    useEffect(() => {
        setUser(getUser());
    }, []);

    const firstName = user?.name?.split(" ")[0] ?? "Admin";
    const page = PAGE_TITLES.find((p) => pathname === p.path || pathname.startsWith(p.path))
        ?? { label: "Coasther", title: "Dashboard" };

    return (
        <header className="sticky top-0 z-10 border-b border-[#EAEAEA] bg-white/90 backdrop-blur">
            <div className="flex items-center gap-4 px-6 py-4">

                {/* Hamburger — mobile only */}
                <button
                    title="Collapse Sidebar"
                    type="button"
                    onClick={onMenuClick}
                    suppressHydrationWarning
                    className="rounded-xl border border-[#EAEAEA] p-2 transition hover:bg-[#F8F8F8] lg:hidden"
                >
                    <Menu size={20} className="text-[#555]" />
                </button>

                {/* Greeting + Title */}
                <div className="flex-1 text-right">
                    <p className="font-inter text-sm text-[#666]">
                        {pathname === "/dashboard"
                            ? <>Selamat datang kembali, <span className="font-semibold text-[#2F2F2F]">{firstName}</span> 👋</>
                            : page.label
                        }
                    </p>
                    <h2 className="font-poppins text-xl font-bold text-[#2F2F2F] md:text-2xl">
                        {page.title}
                    </h2>
                </div>
            </div>
        </header>
    );
}