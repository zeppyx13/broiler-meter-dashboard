"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRooms } from "@/lib/room-api";
import { getLeases } from "@/lib/lease-api";
import { getAllLiveStatus } from "@/lib/live-status-api";
import { DEFAULT_GUARD_SETTINGS, GUARD_SETTINGS_EVENT, getGuardSettings } from "@/lib/guard-settings";
import { scanAllKandang } from "@/lib/guard-scan";
import { acknowledgeAlert, clearAlertHistory, getAlertLog, reconcileAlerts, type LoggedAlert } from "@/lib/alert-log";
import { ALERT_TIER_ORDER } from "@/lib/kandang-insights";
import { playAlertSound, showAlertNotification } from "@/lib/alert-notify";

// Waktu ikut menentukan peringatan (perangkat offline, pengingat sore), jadi pindai ulang berkala.
const RESCAN_INTERVAL_MS = 30 * 1000;

type GuardContextValue = {
    ready: boolean;
    /** Data kandang/siklus/alat gagal dimuat — Guard berhenti sampai data kembali. */
    error: boolean;
    active: LoggedAlert[];
    history: LoggedAlert[];
    counts: { kritis: number; waspada: number; info: number; unchecked: number };
    acknowledge: (key: string) => void;
    clearHistory: () => void;
};

const GuardContext = createContext<GuardContextValue | null>(null);

export function useGuard() {
    const ctx = useContext(GuardContext);
    if (!ctx) throw new Error("useGuard harus dipakai di dalam GuardMonitorProvider");
    return ctx;
}

export function GuardMonitorProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState(DEFAULT_GUARD_SETTINGS);
    const [log, setLog] = useState<LoggedAlert[]>([]);
    const [tick, setTick] = useState(0);
    // Pindaian pertama setelah halaman dibuka hanya mencatat (tanpa notifikasi),
    // agar peringatan yang sudah ada tidak berbunyi ulang di setiap pindah halaman.
    const firstScanDone = useRef(false);

    useEffect(() => {
        setSettings(getGuardSettings());
        setLog(getAlertLog());
        const onChange = () => setSettings(getGuardSettings());
        window.addEventListener(GUARD_SETTINGS_EVENT, onChange);
        const timer = setInterval(() => setTick((t) => t + 1), RESCAN_INTERVAL_MS);
        return () => {
            window.removeEventListener(GUARD_SETTINGS_EVENT, onChange);
            clearInterval(timer);
        };
    }, []);

    const { data: roomData, isError: roomError } = useQuery({ queryKey: ["rooms-overview"], queryFn: () => getRooms({ limit: 100 }), staleTime: 60_000 });
    const { data: leaseData, isError: leaseError } = useQuery({ queryKey: ["leases-active-all"], queryFn: () => getLeases({ status: "active", limit: 100 }), staleTime: 30_000 });
    const { data: liveList, isError: liveError } = useQuery({
        queryKey: ["iot-live-status-all"],
        queryFn: getAllLiveStatus,
        refetchInterval: 10_000,
        staleTime: 5_000,
    });

    // Gagal mengambil data alat ≠ semua perangkat offline: jangan pindai tanpa data yang valid.
    const error = roomError || leaseError || liveError;
    const ready = Boolean(roomData && leaseData && liveList && !error);

    useEffect(() => {
        if (!ready) return;
        const current = scanAllKandang(roomData!.rooms, leaseData!.leases, liveList!, settings);
        const { log: next, raised } = reconcileAlerts(current);
        setLog(next);

        if (!firstScanDone.current) {
            firstScanDone.current = true;
            return;
        }
        const important = raised.filter((a) => a.tier !== "info");
        if (settings.notifyBrowser) important.forEach(showAlertNotification);
        if (settings.notifySound && important.some((a) => a.tier === "kritis")) playAlertSound();
    }, [ready, roomData, leaseData, liveList, settings, tick]);

    const acknowledge = useCallback((key: string) => setLog(acknowledgeAlert(key)), []);
    const clearHistory = useCallback(() => setLog(clearAlertHistory()), []);

    const value = useMemo<GuardContextValue>(() => {
        const active = log
            .filter((e) => !e.resolvedAt)
            .sort((a, b) => ALERT_TIER_ORDER[a.tier] - ALERT_TIER_ORDER[b.tier] || b.firstSeen.localeCompare(a.firstSeen));
        const history = log.filter((e) => e.resolvedAt).sort((a, b) => b.resolvedAt!.localeCompare(a.resolvedAt!));
        return {
            ready,
            error,
            active,
            history,
            counts: {
                kritis: active.filter((a) => a.tier === "kritis").length,
                waspada: active.filter((a) => a.tier === "waspada").length,
                info: active.filter((a) => a.tier === "info").length,
                unchecked: active.filter((a) => a.tier !== "info" && !a.acknowledgedAt).length,
            },
            acknowledge,
            clearHistory,
        };
    }, [log, ready, error, acknowledge, clearHistory]);

    return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}
