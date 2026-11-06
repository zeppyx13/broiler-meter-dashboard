"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { readData, type ServerAlert } from "@/lib/broiler-api";
import type { LoggedAlert } from "@/lib/alert-log";
import type { KandangSnapshot } from "@/lib/kandang-snapshot";
type GuardValue = { ready: boolean; error: boolean; snapshots: KandangSnapshot[]; active: LoggedAlert[]; history: LoggedAlert[]; counts: { kritis: number; waspada: number; info: number; unchecked: number }; acknowledge: (key: string) => void; clearHistory: () => void };
const Context = createContext<GuardValue | null>(null);
export function useGuard() { const c = useContext(Context); if (!c) throw new Error("Guard provider required"); return c; }
export function GuardMonitorProvider({ children }: { children: ReactNode }) {
 const b = useBroiler();
 const alerts = useQuery({ queryKey: ["broiler-nav-alerts", b.user?.id, b.coopId, b.source], queryFn: () => readData<{ alerts: ServerAlert[] }>("/api/alerts", { coop_id: b.coopId, source: b.source, status: "active", limit: 100 }), enabled: Boolean(b.user && b.coopId), retry: false, refetchInterval: 20000 });
 const unread = useQuery({ queryKey: ["broiler-nav-unread", b.user?.id, b.coopId], queryFn: () => readData<{ unread_count: number }>("/api/notifications/unread-count", { coop_id: b.coopId }), enabled: Boolean(b.user), retry: false, refetchInterval: 20000 });
 const list = alerts.data?.alerts ?? [];
 const value: GuardValue = { ready: !alerts.isPending, error: alerts.isError, snapshots: [], active: [], history: [], counts: { kritis: list.filter(a => a.severity === "critical").length, waspada: list.filter(a => a.severity === "warning").length, info: list.filter(a => a.severity === "info").length, unchecked: unread.data?.unread_count ?? 0 }, acknowledge: () => {}, clearHistory: () => {} };
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
