"use client";

import { useParams } from "next/navigation";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { CoopDetail } from "@/components/broiler/dashboard";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function KandangDetailPage() {
    const params = useParams();
    const id = Number(params?.id);

    return (
        <DashboardShell menus={sidebarMenus}>
            <CoopDetail key={id} id={id} />
        </DashboardShell>
    );
}
