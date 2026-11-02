import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import PaymentListSection from "@/components/pembayaran/payment-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function PembayaranPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <div>
                <p className="font-inter text-sm text-[#666]">Keuangan</p>
                <h2 className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">
                    Data Pembayaran
                </h2>
            </div>

            <PaymentListSection />
        </DashboardShell>
    );
}