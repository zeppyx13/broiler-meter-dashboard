"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import DashboardSidebar from "./dashboard-sidebar";
import MobileDrawer from "./mobile-drawer";
import DashboardTopbar from "./dashboard-topbar";
import MobileBottomNav from "./mobile-bottom-nav";
import type { SidebarMenuItem } from "@/types/dashboard";
import { BroilerChat } from "@/components/broiler/chat";
import { SelectionBar } from "@/components/broiler/dashboard";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { Failure, Notice } from "@/components/broiler/ui";
import { GuardMonitorProvider } from "../guard/guard-monitor";

type DashboardShellProps = {
    menus: SidebarMenuItem[];
    children: ReactNode;
};

export default function DashboardShell({ menus, children }: DashboardShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const context = useBroiler();

    return (
        <GuardMonitorProvider>
            <main className="min-h-screen bg-[#F8F8F8] text-[#2F2F2F]">
                <div className="flex min-h-screen">
                    <DashboardSidebar menus={menus} />

                    <MobileDrawer
                        menus={menus}
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                    />

                    <section className="flex-1 min-w-0">
                        <DashboardTopbar />
                        <div className="space-y-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6"><SelectionBar /><Failure error={context.error} />{context.loading ? <Notice>Memuat sesi dan konteks server…</Notice> : children}</div>
                    </section>
                </div>
                <MobileBottomNav menus={menus} moreOpen={drawerOpen} onMoreClick={() => setDrawerOpen((v) => !v)} />
                <BroilerChat />
            </main>
        </GuardMonitorProvider>
    );
}
