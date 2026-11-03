"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import DashboardSidebar from "./dashboard-sidebar";
import MobileDrawer from "./mobile-drawer";
import DashboardTopbar from "./dashboard-topbar";
import MobileBottomNav from "./mobile-bottom-nav";
import type { SidebarMenuItem } from "@/types/dashboard";
import AdminChat from "../ai-chat/admin-chat";
import { GuardMonitorProvider } from "../guard/guard-monitor";

type DashboardShellProps = {
    menus: SidebarMenuItem[];
    children: ReactNode;
};

export default function DashboardShell({ menus, children }: DashboardShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);

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
                        <DashboardTopbar onMenuClick={() => setDrawerOpen(true)} />
                        <div className="space-y-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">{children}</div>
                    </section>
                </div>
                <MobileBottomNav menus={menus} />
                <AdminChat />
            </main>
        </GuardMonitorProvider>
    );
}
