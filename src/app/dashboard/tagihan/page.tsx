import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import InvoiceListSection from "@/components/tagihan/invoice-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function TagihanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <InvoiceListSection />
        </DashboardShell>
    );
}