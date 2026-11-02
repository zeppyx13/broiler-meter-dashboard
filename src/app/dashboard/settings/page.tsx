"use client";

import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import TariffSettingsCard from "@/components/settings/tariff-settings-card";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function SettingsPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <div>
                <p className="font-inter text-sm text-[#666]">Pengaturan Sistem</p>
                <h2 className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">
                    Pengaturan Tarif
                </h2>
            </div>

            <TariffSettingsCard />
        </DashboardShell>
    );
}