"use client";

import { useState } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import RatingSummaryTab from "@/components/rating/rating-summary-tab";
import RatingAllTab from "@/components/rating/rating-all-tab";
import { sidebarMenus } from "@/lib/dashboard-data";

const TABS = [
    { key: "summary", label: "📊 Ringkasan" },
    { key: "all", label: "💬 Semua Ulasan" },
];

export default function RatingPage() {
    const [tab, setTab] = useState<"summary" | "all">("summary");

    return (
        <DashboardShell menus={sidebarMenus}>
            <div>
                <p className="font-inter text-sm text-[#666]">Manajemen</p>
                <h2 className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">
                    Rating & Ulasan
                </h2>
            </div>

            <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key as "summary" | "all")}
                        suppressHydrationWarning
                        className={`px-5 py-2.5 font-inter text-sm transition-colors ${tab === t.key
                                ? "bg-[#7B1113] text-white"
                                : "text-[#666] hover:bg-[#F8F8F8]"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "summary" && <RatingSummaryTab />}
            {tab === "all" && <RatingAllTab />}
        </DashboardShell>
    );
}