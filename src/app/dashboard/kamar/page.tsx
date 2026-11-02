"use client";

import { useState } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import RoomListSection from "@/components/kamar/room-list-section";
import RoomOverviewSection from "@/components/kamar/room-overview-section";
import { sidebarMenus } from "@/lib/dashboard-data";
import { HomeIcon, ListChecks } from "lucide-react";

type TabType = "overview" | "list";

const TABS: {
    key: TabType;
    label: string;
    icon: any;
}[] = [
        { key: "overview", label: "Overview", icon: HomeIcon },
        { key: "list", label: "Kelola Kamar", icon: ListChecks },
    ];

export default function KamarPage() {
    const [tab, setTab] = useState<TabType>("overview");

    return (
        <DashboardShell menus={sidebarMenus}>
            <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white w-fit">
                {TABS.map((t, index) => {
                    const Icon = t.icon;

                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all
                            ${tab === t.key
                                    ? "bg-[#7B1113] text-white shadow-sm"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-5">
                {tab === "overview" && <RoomOverviewSection />}
                {tab === "list" && <RoomListSection />}
            </div>
        </DashboardShell>
    );
}