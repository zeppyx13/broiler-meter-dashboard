"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { getToken, clearAuth } from "@/lib/auth";
import { allPages, readData, writeData, type User, type Farm, type Coop, type Cycle, type Source } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";

type Capabilities = { read?: boolean; operate?: boolean; manage?: boolean; relay_operate?: boolean; [key: string]: unknown };
type ContextValue = { user?: User; farms: Farm[]; coops: Coop[]; farmId?: number; coopId?: number; coop?: Coop; source: Source; selectFarm: (id: number) => void; selectCoop: (id: number) => void; setSource: (source: Source) => void; refresh: () => Promise<void>; capabilities: Capabilities; canOperate: boolean; canManage: boolean; canRelay: boolean; loading: boolean; error: string | null };
const Context = createContext<ContextValue | null>(null);
const EMPTY_COOPS: Coop[] = [];
const EMPTY_CAPABILITIES: Capabilities = {};
const subscribeHydration = () => () => {};

export function BroilerProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const client = useQueryClient();
    const [token, setToken] = useState(() => getToken());
    const [selection, setSelection] = useState<{ farmId?: number; coopId?: number }>({});
    const [source, setSource] = useState<Source>("real");
    const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
    const enabled = hydrated && pathname.startsWith("/dashboard") && Boolean(token);
    useEffect(() => {
        const session = () => { client.clear(); setSelection({}); setSource("real"); setToken(getToken()); };
        const unauthorized = () => { clearAuth(); session(); router.replace("/"); };
        window.addEventListener("coasther:session", session);
        window.addEventListener("coasther:unauthorized", unauthorized);
        return () => { window.removeEventListener("coasther:session", session); window.removeEventListener("coasther:unauthorized", unauthorized); };
    }, [client, router]);
    const me = useQuery({ queryKey: ["broiler-session"], queryFn: () => readData<{ user: User }>("/api/auth/me"), enabled, retry: false, staleTime: 30000 });
    const user = me.data?.user;
    const farms = useQuery({ queryKey: ["broiler-farms", user?.id], queryFn: () => allPages<Farm>("/api/farms", "farms"), enabled: Boolean(user), retry: false });
    const coops = useQuery({ queryKey: ["broiler-coops", user?.id], queryFn: () => allPages<Coop>("/api/coops", "coops"), enabled: Boolean(user), retry: false });
    const bootstrap = useQuery({ queryKey: ["broiler-context", user?.id], queryFn: () => readData<{ state: string; coop: Coop | null; active_cycle: Cycle | null }>("/api/dashboard/context"), enabled: Boolean(user), retry: false });
    const allCoops = coops.data ?? EMPTY_COOPS;
    const defaultCoop = allCoops.find(c => c.id === user?.default_coop_id) ?? bootstrap.data?.coop ?? undefined;
    const farmId = selection.farmId ?? defaultCoop?.farm_id ?? farms.data?.[0]?.id;
    const visibleCoops = allCoops.filter(c => c.farm_id === farmId);
    const coop = visibleCoops.find(c => c.id === selection.coopId) ?? visibleCoops.find(c => c.id === defaultCoop?.id) ?? visibleCoops[0];
    const coopId = coop?.id;
    const capabilityQuery = useQuery({ queryKey: ["broiler-capabilities", user?.id, coopId], queryFn: () => readData<{ capabilities: Capabilities }>(`/api/coops/${coopId}/capabilities`), enabled: Boolean(user && coopId), retry: false });
    const capabilities = capabilityQuery.data?.capabilities ?? EMPTY_CAPABILITIES;
    const role = coop?.member_role ?? farms.data?.find(f => f.id === farmId)?.member_role;
    const canManage = user?.role === "admin" || role === "owner" || role === "manager";
    const canOperate = canManage || capabilities.operate === true;
    const canRelay = capabilities.relay_operate === true || capabilities["relay:operate"] === true;
    const selectFarm = useCallback((id: number) => setSelection({ farmId: id }), []);
    const selectCoop = useCallback((id: number) => {
        const selected = allCoops.find(c => c.id === id);
        if (!selected) return;
        setSelection({ farmId: selected.farm_id, coopId: id });
        void writeData("put", "/api/users/me", { default_coop_id: id }).then(() => client.invalidateQueries({ queryKey: ["broiler-session"] })).catch(() => {});
    }, [allCoops, client]);
    const refresh = useCallback(async () => { await client.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("broiler") }); }, [client]);
    useEffect(() => {
        if (!token || !user || !coopId) return;
        const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL, { auth: { token }, autoConnect: false });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let soundEnabled = false;
        const soundPreference = (event: Event) => { soundEnabled = (event as CustomEvent<{ enabled: boolean }>).detail.enabled; };
        window.addEventListener("coasther:foreground-sound", soundPreference);
        const subscribe = () => socket.emit("coop:subscribe", { coop_id: coopId }, (ack: { success: boolean }) => { if (ack.success) void refresh(); });
        const update = () => { if (timer) return; timer = setTimeout(() => { timer = undefined; void client.invalidateQueries({ predicate: q => { const name = String(q.queryKey[0]); return (name === "broiler" && q.queryKey.includes(coopId)) || ["broiler-overview", "broiler-nav-alerts", "broiler-nav-unread"].includes(name); } }); }, 750); };
        const notify = () => { update(); if (soundEnabled && document.visibilityState === "visible") { void import("@/lib/alert-notify").then(module => module.playAlertSound()); } };
        const revoked = () => { client.removeQueries({ predicate: q => q.queryKey.includes(coopId) }); setSelection({}); void refresh(); };
        socket.on("connect", subscribe);
        const events = ["telemetry_update", "meter_update", "device_status", "alert_created", "alert_updated", "notification_created", "notification_updated", "relay_state_update", "relay_command_update"];
        events.forEach(event => socket.on(event, event === "alert_created" || event === "notification_created" ? notify : update));
        socket.on("coop:revoked", revoked);
        socket.connect();
        return () => { if (timer) clearTimeout(timer); window.removeEventListener("coasther:foreground-sound", soundPreference); socket.emit("coop:unsubscribe", { coop_id: coopId }); socket.off("connect", subscribe); events.forEach(event => socket.off(event, event === "alert_created" || event === "notification_created" ? notify : update)); socket.off("coop:revoked", revoked); socket.disconnect(); };
    }, [token, user, coopId, client, refresh]);
    const error = me.error ?? farms.error ?? coops.error ?? bootstrap.error;
    const value = useMemo(() => ({ user, farms: farms.data ?? [], coops: allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, setSource, refresh, capabilities, canOperate, canManage, canRelay, loading: enabled && (me.isPending || Boolean(user) && (farms.isPending || coops.isPending || bootstrap.isPending)), error: error ? apiErrorMessage(error) : null }), [user, farms.data, allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, refresh, capabilities, canOperate, canManage, canRelay, enabled, me.isPending, farms.isPending, coops.isPending, bootstrap.isPending, error]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBroiler() { const value = useContext(Context); if (!value) throw new Error("BroilerProvider diperlukan"); return value; }
