"use client";

import { ShieldAlert, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import SectionCard from "../section-card";

type Severity = "info" | "waspada" | "kritis";

type GuardAlert = {
    id: number;
    coop: string;
    message: string;
    severity: Severity;
    detectedAt: string;
};

const MOCK_ALERTS: GuardAlert[] = [
    {
        id: 1,
        coop: "Kandang A01",
        message: "Konsumsi air turun 40% dari pola normal umur 21 hari.",
        severity: "kritis",
        detectedAt: "5 menit lalu",
    },
    {
        id: 2,
        coop: "Kandang B02",
        message: "Kipas sirkulasi mati terdeteksi sejak pukul 02:14.",
        severity: "kritis",
        detectedAt: "18 menit lalu",
    },
    {
        id: 3,
        coop: "Kandang A03",
        message: "Konsumsi listrik naik 15% di luar jadwal pemanas biasa.",
        severity: "waspada",
        detectedAt: "42 menit lalu",
    },
    {
        id: 4,
        coop: "Kandang C01",
        message: "Pola minum sedikit lebih rendah dari rata-rata, masih dalam batas wajar.",
        severity: "info",
        detectedAt: "1 jam lalu",
    },
];

const SEVERITY_STYLE: Record<Severity, { label: string; badge: string; icon: typeof Info }> = {
    info: {
        label: "Info",
        badge: "bg-blue-50 text-blue-600",
        icon: Info,
    },
    waspada: {
        label: "Waspada",
        badge: "bg-amber-50 text-amber-600",
        icon: AlertTriangle,
    },
    kritis: {
        label: "Kritis",
        badge: "bg-red-50 text-red-600",
        icon: AlertOctagon,
    },
};

export default function GuardSection() {
    return (
        <SectionCard>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7B1113]/10">
                        <ShieldAlert size={18} className="text-[#7B1113]" />
                    </div>
                    <div>
                        <p className="font-inter text-sm text-[#666]">Deteksi Anomali</p>
                        <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Guard</h3>
                    </div>
                </div>
                <span className="rounded-full bg-[#F8F8F8] px-3 py-1 font-inter text-xs text-[#777]">
                    {MOCK_ALERTS.length} alert
                </span>
            </div>

            <p className="mt-3 rounded-2xl bg-[#FFF8EC] px-4 py-2 font-inter text-xs text-[#9A6B14]">
                Data contoh — menunggu integrasi backend AI
            </p>

            <div className="mt-4 space-y-3">
                {MOCK_ALERTS.map((alert) => {
                    const style = SEVERITY_STYLE[alert.severity];
                    const Icon = style.icon;
                    return (
                        <div
                            key={alert.id}
                            className="flex items-start gap-3 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4"
                        >
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.badge}`}>
                                <Icon size={15} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                                        {alert.coop}
                                    </p>
                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-inter text-xs font-medium ${style.badge}`}>
                                        {style.label}
                                    </span>
                                </div>
                                <p className="mt-1 font-inter text-xs text-[#666]">{alert.message}</p>
                                <p className="mt-1 font-inter text-[11px] text-[#999]">{alert.detectedAt}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}
