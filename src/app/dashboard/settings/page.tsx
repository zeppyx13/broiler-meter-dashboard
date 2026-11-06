"use client";

import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import TariffSettingsCard from "@/components/settings/tariff-settings-card";
import PeternakProfileCard from "@/components/settings/peternak-profile-card";
import LahanTeamCard from "@/components/settings/lahan-team-card";
import GuardSettingsCard from "@/components/settings/guard-settings-card";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function SettingsPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <PeternakProfileCard />
            <GuardSettingsCard />
            <LahanTeamCard />
            <TariffSettingsCard />
        </DashboardShell>
    );
}
