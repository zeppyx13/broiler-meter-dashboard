"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import Link from "next/link";
import Swal from "sweetalert2";
import { ShieldCheck, ChevronRight, Check, BellOff, Bot } from "lucide-react";
import { askCopilot } from "@/lib/copilot-context";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { apiErrorMessage } from "@/lib/api-error";
import KejadianTimeline, { type InboxEntry } from "./kejadian-timeline";
import { readData, writeData } from "@/lib/broiler-api";
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
    const { ready, error, active, history, counts, acknowledge, resolve } = useGuard();
    const b = useBroiler();
    const [tab, setTab] = useState<"aktif" | "riwayat">("aktif");
    const [notifyOff, setNotifyOff] = useState(false);
    // Jendela linimasa: 7 hari terakhir sejak halaman dibuka.
    const [sinceMs] = useState(() => Date.now() - 7 * 86_400_000);
    const [actionError, setActionError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const inbox = useInfiniteQuery({
        queryKey: ["broiler", b.user?.id, "inbox", "timeline"],
        initialPageParam: 1,
        queryFn: ({ pageParam, signal }) => readData<{ notifications: InboxEntry[]; unread_count: number; meta: { has_more: boolean } }>("/api/notifications", { channel: "in_app", page: pageParam, limit: 25 }, { signal }),
        getNextPageParam: (last, pages) => last.meta.has_more ? pages.length + 1 : undefined,
        enabled: Boolean(b.user && tab === "riwayat"), retry: false, refetchInterval: 20000,
    });
    const capabilities = useQueries({ queries: b.coops.map((coop) => ({ queryKey: ["broiler-capabilities", b.user?.id, coop.id], queryFn: ({ signal }: { signal: AbortSignal }) => readData<{ capabilities: { manage?: boolean; operate?: boolean } }>(`/api/coops/${coop.id}/capabilities`, undefined, { signal }), enabled: Boolean(b.user), retry: false, refetchInterval: 60000 })) });
    const permission = (coopId: number) => capabilities[b.coops.findIndex((coop) => coop.id === coopId)]?.data?.capabilities;

    useEffect(() => {
        const s = getGuardSettings();
        setNotifyOff(!s.notifyBrowser || !notificationSupported() || Notification.permission !== "granted");
    }, []);

    async function run(task: () => Promise<void>) {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            setActionError(null);
            await task();
        } catch (err) {
            setActionError(apiErrorMessage(err));
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        } finally { inFlight.current = false; }
    }

    async function handleResolve(a: LoggedAlert) {
        const result = await Swal.fire({
            title: "Selesaikan peringatan?",
            input: "textarea",
            inputLabel: "Alasan (minimal 8 karakter, tersimpan sebagai audit)",
            inputValidator: (v) => (!v || v.trim().length < 8 ? "Tulis alasan minimal 8 karakter." : undefined),
            showCancelButton: true,
            confirmButtonText: "Selesaikan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });
        if (result.isConfirmed && typeof result.value === "string") await run(() => resolve(a.key, result.value.trim()));
    }

    return (
        <div className="space-y-5">
            {notifyOff && (
                <div className="flex flex-col gap-3 rounded-3xl border border-[#EAEAEA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 font-inter text-sm text-[#555]">
                        <BellOff size={16} className="mt-0.5 shrink-0 text-[#999]" />
                        Notifikasi browser belum aktif.
                    </p>
                    <Link href="/dashboard/settings" className="shrink-0 font-inter text-sm font-semibold text-[#7B1113] hover:underline">
                        Aktifkan
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3">
                {(["kritis", "waspada", "info"] as const).map((tier) => (
                    <div key={tier} className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
                        <p className="font-inter text-xs text-[#999]">{ALERT_TIER_STYLE[tier].label}</p>
                        <p className={`mt-1 font-poppins text-2xl font-bold ${counts[tier] > 0 && tier !== "info" ? (tier === "kritis" ? "text-[#B42318]" : "text-[#B76E00]") : "text-[#2F2F2F]"}`}>
                            {ready && !error ? counts[tier] : "—"}
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
                    Daftar peringatan dari server belum bisa dimuat. Guard tetap berjalan di server; muat ulang halaman, bila tetap gagal coba keluar lalu masuk lagi.
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

            {((ready && !error) || active.length > 0) && tab === "aktif" && (active.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-3xl border border-[#EAEAEA] bg-white px-6 py-14 text-center">
                    <ShieldCheck size={28} className="text-green-600" />
                    <p className="font-poppins text-base font-semibold text-[#2F2F2F]">Tidak ada peringatan tercatat</p>
                    <p className="font-inter text-sm text-[#999]">Semua kandang terpantau normal.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {active.map((a) => (
                        <ActiveAlertCard
                            key={a.key}
                            alert={a}
                            onAcknowledge={permission(a.roomId)?.operate === true ? () => run(() => acknowledge(a.key)) : undefined}
                            onResolve={permission(a.roomId)?.manage === true ? () => handleResolve(a) : undefined}
                        />
                    ))}
                </div>
            ))}

            {tab === "riwayat" && (
                <>
                    <KejadianTimeline key={`${b.user?.id}:${b.source}`} active={active} history={history} sinceMs={sinceMs} notifications={[...new Map((inbox.data?.pages.flatMap((page) => page.notifications) ?? []).map((entry) => [entry.id, entry])).values()]} unread={inbox.data?.pages[0]?.unread_count} onRead={(id) => { void run(async () => { await writeData("patch", `/api/notifications/${id}/read`, {}); await b.refresh(); }); }} onReadAll={() => { void run(async () => { await writeData("patch", "/api/notifications/read-all", {}); await b.refresh(); }); }} moreInbox={inbox.hasNextPage} loadingInbox={inbox.isFetching} inboxError={actionError ?? (inbox.error ? apiErrorMessage(inbox.error) : null)} loadMoreInbox={() => { void inbox.fetchNextPage(); }} />
                </>
            )}
        </div>
    );
}

function ActiveAlertCard({ alert, onAcknowledge, onResolve }: { alert: LoggedAlert; onAcknowledge?: () => void; onResolve?: () => void }) {
    const b = useBroiler();
    const canInsights = alert.roomId === b.coopId ? b.canInsights : b.coops.find(coop => coop.id === alert.roomId)?.capabilities?.["insights:use"] === true;
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
                ) : onAcknowledge && (
                    <button
                        onClick={onAcknowledge}
                        suppressHydrationWarning
                        className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 font-inter text-sm font-medium text-[#2F2F2F] shadow-sm transition hover:bg-[#F8F8F8]"
                    >
                        <Check size={15} /> Sudah dicek
                    </button>
                )}
                {onResolve && (
                    <button
                        onClick={onResolve}
                        suppressHydrationWarning
                        className="rounded-xl px-3 py-2 font-inter text-sm font-medium text-[#555] transition hover:bg-white/60"
                    >
                        Selesaikan
                    </button>
                )}
                {canInsights && <button
                    onClick={() => askCopilot(`Kandang ${alert.roomNumber} sedang ada peringatan "${alert.title}" (${alert.detail}). Apa kemungkinan penyebabnya dan langkah apa yang harus saya lakukan sekarang?`, alert.roomId)}
                    suppressHydrationWarning
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-inter text-sm font-medium text-[#7B1113] transition hover:bg-white/60"
                >
                    <Bot size={15} /> Tanya Copilot
                </button>}
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
