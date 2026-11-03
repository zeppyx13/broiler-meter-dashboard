"use client";

import { useParams } from "next/navigation";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import KandangDetail from "@/components/kamar/ringkasan/kandang-detail";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function KandangDetailPage() {
    const params = useParams();
    const id = Number(params?.id);

    return (
        <DashboardShell menus={sidebarMenus}>
            <KandangDetail roomId={id} />
        </DashboardShell>
    );
}
