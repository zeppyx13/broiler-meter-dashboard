"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import DashboardSidebar from "./dashboard-sidebar";
import MobileDrawer from "./mobile-drawer";
import DashboardTopbar from "./dashboard-topbar";
import type { SidebarMenuItem } from "@/types/dashboard";
import AdminChat from "../ai-chat/admin-chat";

type DashboardShellProps = {
    menus: SidebarMenuItem[];
    children: ReactNode;
};

export default function DashboardShell({ menus, children }: DashboardShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
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
                    <div className="space-y-6 p-6">{children}</div>
                </section>
            </div>
            <AdminChat />
        </main>
    );
}