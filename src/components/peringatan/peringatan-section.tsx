"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { ShieldCheck, ChevronRight, Check, BellOff, Bot } from "lucide-react";
import { askCopilot } from "@/lib/copilot-context";
import KejadianTimeline from "./kejadian-timeline";
import { useGuard } from "@/components/dashboard/guard/guard-monitor";
import { getGuardSettings } from "@/lib/guard-settings";
import { notificationSupported } from "@/lib/alert-notify";
import type { AlertTier } from "@/lib/kandang-insights";
import type { LoggedAlert } from "@/lib/alert-log";

export const ALERT_TIER_STYLE: Record<AlertTier, { box: string; badge: string; label: string }> = {
    kritis: { box: "border-l-[#B42318] bg-[#FDEAEA]", badge: "bg-[#B42318] text-white", label: "Kritis" },
    waspada: { box: "border-l-[#B76E00] bg-[#FFF4E5]", badge: "bg-[#B76E00] text-white", label: "Waspada" },
    info: { box: "border-l-[#2F5BBA] bg-[#EAF2FF]", badge: "bg-[#2F5BBA] text-white", label: "Info" },
};

function clock(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function duration(fromIso: string, toIso?: string) {
    const minutes = Math.max(0, Math.round(((toIso ? new Date(toIso) : new Date()).getTime() - new Date(fromIso).getTime()) / 60_000));
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours} jam ${minutes % 60} menit` : `${Math.floor(hours / 24)} hari`;
}

export default function PeringatanSection() {
    const { ready, error, active, history, counts, acknowledge, clearHistory } = useGuard();
    const [tab, setTab] = useState<"aktif" | "riwayat">("aktif");
    const [notifyOff, setNotifyOff] = useState(false);
    // Jendela linimasa: 7 hari terakhir sejak halaman dibuka.
    const [sinceMs] = useState(() => Date.now() - 7 * 86_400_000);

    useEffect(() => {
        const s = getGuardSettings();
        setNotifyOff(!s.notifyBrowser || !notificationSupported() || Notification.permission !== "granted");
    }, []);

    async function handleClearHistory() {
        const result = await Swal.fire({
            title: "Hapus riwayat peringatan?",
            text: "Peringatan yang masih aktif tidak ikut terhapus.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (result.isConfirmed) clearHistory();
    }

    return (
        <div className="space-y-5">
            {notifyOff && (
                <div className="flex flex-col gap-3 rounded-3xl border border-[#EAEAEA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 font-inter text-sm text-[#555]">
                        <BellOff size={16} className="mt-0.5 shrink-0 text-[#999]" />
                        Notifikasi browser belum aktif. Peringatan hanya terlihat saat halaman ini dibuka.
                    </p>
                    <Link href="/dashboard/settings" className="shrink-0 font-inter text-sm font-semibold text-[#7B1113] hover:underline">
                        Aktifkan di Pengaturan
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3">
                {(["kritis", "waspada", "info"] as const).map((tier) => (
                    <div key={tier} className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
                        <p className="font-inter text-xs text-[#999]">{ALERT_TIER_STYLE[tier].label}</p>
                        <p className={`mt-1 font-poppins text-2xl font-bold ${counts[tier] > 0 && tier !== "info" ? (tier === "kritis" ? "text-[#B42318]" : "text-[#B76E00]") : "text-[#2F2F2F]"}`}>
                            {counts[tier]}
                        </p>
                    </div>
                ))}
            </div>

            <div className="flex w-full rounded-2xl border border-[#EAEAEA] bg-white p-1 sm:w-fit">
                {(["aktif", "riwayat"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        suppressHydrationWarning
                        className={`flex-1 rounded-xl px-5 py-2.5 font-inter text-sm font-medium transition sm:flex-none ${tab === t ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                    >
                        {t === "aktif" ? `Aktif (${active.length})` : "Linimasa"}
                    </button>
                ))}
            </div>

            {error && tab === "aktif" && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-inter text-sm text-red-700">
                    Data kandang atau alat belum bisa dimuat, jadi Guard berhenti sementara. Muat ulang halaman; bila tetap gagal, coba keluar lalu masuk lagi.
                    {active.length > 0 && " Peringatan di bawah adalah kondisi terakhir yang tercatat."}
                </div>
            )}

            {!ready && !error && tab === "aktif" && (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {(ready || (error && active.length > 0)) && tab === "aktif" && (active.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-3xl border border-[#EAEAEA] bg-white px-6 py-14 text-center">
                    <ShieldCheck size={28} className="text-green-600" />
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Semua kandang aman</p>
                    <p className="font-inter text-sm text-[#999]">Guard memantau setiap kandang yang punya siklus berjalan.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {active.map((a) => <ActiveAlertCard key={a.key} alert={a} onAcknowledge={() => acknowledge(a.key)} />)}
                </div>
            ))}

            {tab === "riwayat" && (
                <>
                    <KejadianTimeline active={active} history={history} sinceMs={sinceMs} />
                    {history.length > 0 && (
                        <button onClick={handleClearHistory} suppressHydrationWarning className="font-inter text-sm text-[#999] hover:text-[#B42318]">
                            Hapus riwayat
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function ActiveAlertCard({ alert, onAcknowledge }: { alert: LoggedAlert; onAcknowledge: () => void }) {
    const style = ALERT_TIER_STYLE[alert.tier];
    return (
        <div className={`rounded-2xl border-l-4 p-4 ${style.box} ${alert.acknowledgedAt ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 font-inter text-xs text-[#555]">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>{style.label}</span>
                <span className="font-semibold text-[#2F2F2F]">Kandang {alert.roomNumber}</span>
                <span>· sejak {clock(alert.firstSeen)} ({duration(alert.firstSeen)})</span>
            </div>
            <p className="mt-2 font-poppins text-base font-semibold text-[#2F2F2F]">{alert.title}</p>
            <p className="mt-0.5 font-inter text-sm text-[#555]">{alert.detail}</p>
            <p className="mt-2 flex items-start gap-1 font-inter text-sm font-medium text-[#2F2F2F]">
                <ChevronRight size={16} className="mt-0.5 shrink-0" /> {alert.action}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {alert.acknowledgedAt ? (
                    <span className="flex items-center gap-1 font-inter text-xs text-[#777]">
                        <Check size={14} /> Dicek {clock(alert.acknowledgedAt)}
                    </span>
                ) : (
                    <button
                        onClick={onAcknowledge}
                        suppressHydrationWarning
                        className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 font-inter text-sm font-medium text-[#2F2F2F] shadow-sm transition hover:bg-[#F8F8F8]"
                    >
                        <Check size={15} /> Sudah dicek
                    </button>
                )}
                <button
                    onClick={() => askCopilot(`Kandang ${alert.roomNumber} sedang ada peringatan "${alert.title}" (${alert.detail}). Apa kemungkinan penyebabnya dan langkah apa yang harus saya lakukan sekarang?`)}
                    suppressHydrationWarning
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-inter text-sm font-medium text-[#7B1113] transition hover:bg-white/60"
                >
                    <Bot size={15} /> Tanya Copilot
                </button>
                <Link
                    href={`/dashboard/kamar/${alert.roomId}`}
                    className="flex items-center gap-1 rounded-xl px-3 py-2 font-inter text-sm font-medium text-[#7B1113] transition hover:bg-white/60"
                >
                    Buka kandang <ChevronRight size={15} />
                </Link>
            </div>
        </div>
    );
}
