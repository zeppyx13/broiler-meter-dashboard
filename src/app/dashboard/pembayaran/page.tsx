import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import PaymentListSection from "@/components/pembayaran/payment-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function PembayaranPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <div>
                <p className="font-inter text-sm text-[#666]">Energi</p>
                <h2 className="mt-1 font-poppins text-2xl font-bold text-[#2F2F2F]">
                    Laporan Biaya Energi
                </h2>
            </div>

            <PaymentListSection />
        </DashboardShell>
    );
}