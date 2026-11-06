"use client";

import { useState } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import RoomOverviewSection from "@/components/kamar/room-overview-section";
import LeaseListSection from "@/components/kontrak/lease-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

type TabType = "kandang" | "riwayat";

const TABS: { key: TabType; label: string }[] = [
    { key: "kandang", label: "Kandang" },
    { key: "riwayat", label: "Riwayat Siklus" },
];

export default function KamarPage() {
    const [tab, setTab] = useState<TabType>("kandang");

    return (
        <DashboardShell menus={sidebarMenus}>
            <div className="flex w-full rounded-2xl border border-[#EAEAEA] bg-white p-1 sm:w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        suppressHydrationWarning
                        className={`flex-1 rounded-xl px-5 py-2.5 font-inter text-sm font-medium transition sm:flex-none ${tab === t.key ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "kandang" ? <RoomOverviewSection /> : <LeaseListSection />}
        </DashboardShell>
    );
}
