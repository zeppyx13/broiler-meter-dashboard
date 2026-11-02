"use client";

import { useState } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import MeterListSection from "@/components/iot/meter-list-section";
import IotMonitorSection from "@/components/iot/iot-monitor-section";
import { sidebarMenus } from "@/lib/dashboard-data";
import { Cpu, Monitor } from "lucide-react";

const TABS = [
    { key: "monitor", label: "Live Monitor", icon: Monitor },
    { key: "devices", label: "Kelola Alat", icon: Cpu },
];

export default function IotPage() {
    const [tab, setTab] = useState<"monitor" | "devices">("monitor");

    return (
        <DashboardShell menus={sidebarMenus}>
            {/* Tab switcher */}
            <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white w-fit">
                {TABS.map((t) => {
                    const Icon = t.icon;

                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key as "monitor" | "devices")}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors
                ${tab === t.key
                                    ? "bg-[#7B1113] text-white"
                                    : "text-[#666] hover:bg-[#F8F8F8]"
                                }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {tab === "monitor" && <IotMonitorSection />}
            {tab === "devices" && <MeterListSection />}
        </DashboardShell>
    );
}