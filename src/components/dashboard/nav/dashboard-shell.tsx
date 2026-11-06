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
import ContextBar from "./context-bar";
import { useBroiler } from "@/components/broiler/broiler-provider";

type DashboardShellProps = {
    menus: SidebarMenuItem[];
    children: ReactNode;
};

export default function DashboardShell({ menus, children }: DashboardShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { loading, error } = useBroiler();

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
                        <div className="space-y-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
                            <ContextBar />
                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-inter text-sm text-red-700">
                                    {error}. Periksa koneksi ke server, lalu muat ulang halaman.
                                </div>
                            )}
                            {loading ? (
                                <div className="space-y-4">
                                    <div className="h-32 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
                                    <div className="h-64 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
                                </div>
                            ) : children}
                        </div>
                    </section>
                </div>
                <MobileBottomNav menus={menus} moreOpen={drawerOpen} onMoreClick={() => setDrawerOpen((v) => !v)} />
                <AdminChat />
            </main>
        </GuardMonitorProvider>
    );
}
