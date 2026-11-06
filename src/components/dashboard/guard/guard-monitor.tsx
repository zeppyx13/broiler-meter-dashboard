"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { useAllAlerts } from "@/lib/broiler-queries";
import { serverAlertToLogged } from "@/lib/broiler-adapters";
import { writeData } from "@/lib/broiler-api";
import { getGuardSettings, GUARD_SETTINGS_EVENT } from "@/lib/guard-settings";
import { ALERT_TIER_ORDER } from "@/lib/kandang-insights";
import type { LoggedAlert } from "@/lib/alert-log";

// Guard berjalan di server (8 aturan deterministik). Provider ini hanya membaca episode
// alert semua kandang yang bisa diakses, lalu menyediakannya untuk navigasi, Beranda,
// dan halaman Peringatan. Event Socket.IO di BroilerProvider menyegarkan datanya.

type GuardContextValue = {
    ready: boolean;
    error: boolean;
    active: LoggedAlert[];
    history: LoggedAlert[];
    counts: { kritis: number; waspada: number; info: number; unchecked: number };
    acknowledge: (key: string) => Promise<void>;
    resolve: (key: string, note: string) => Promise<void>;
};

const GuardContext = createContext<GuardContextValue | null>(null);

export function useGuard() {
    const ctx = useContext(GuardContext);
    if (!ctx) throw new Error("useGuard harus dipakai di dalam GuardMonitorProvider");
    return ctx;
}

export function GuardMonitorProvider({ children }: { children: ReactNode }) {
    const b = useBroiler();
    const client = useQueryClient();
    const coopIds = useMemo(() => b.coops.map((c) => c.id), [b.coops]);
    const results = useAllAlerts(coopIds, b.source);

    // Bunyi peringatan kritis mengikuti preferensi di Pengaturan → Guard.
    useEffect(() => {
        const emit = () => window.dispatchEvent(new CustomEvent("coasther:foreground-sound", { detail: { enabled: getGuardSettings().notifySound } }));
        emit();
        window.addEventListener(GUARD_SETTINGS_EVENT, emit);
        return () => window.removeEventListener(GUARD_SETTINGS_EVENT, emit);
    }, [b.coopId]);

    const log = useMemo(() => {
        const codeOf = new Map(b.coops.map((c) => [c.id, c.code]));
        return results.flatMap((r) => (r.data?.alerts ?? []).map((a) => serverAlertToLogged(a, codeOf.get(a.coop_id) ?? String(a.coop_id))));
    }, [results, b.coops]);

    const ready = coopIds.length === 0 ? !b.loading : results.every((r) => !r.isPending);
    const error = results.some((r) => r.isError);

    const findServerId = useCallback((key: string) => log.find((e) => e.key === key)?.serverId, [log]);
    const refresh = useCallback(() => client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "broiler" && q.queryKey.includes("alerts") }), [client]);

    const acknowledge = useCallback(async (key: string) => {
        const id = findServerId(key);
        if (!id) return;
        await writeData("patch", `/api/alerts/${id}/ack`, {});
        await refresh();
    }, [findServerId, refresh]);

    const resolve = useCallback(async (key: string, note: string) => {
        const id = findServerId(key);
        if (!id) return;
        await writeData("patch", `/api/alerts/${id}/resolve`, { note });
        await refresh();
    }, [findServerId, refresh]);

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
            resolve,
        };
    }, [log, ready, error, acknowledge, resolve]);

    return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}
