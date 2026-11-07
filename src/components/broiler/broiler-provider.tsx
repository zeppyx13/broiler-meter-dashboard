"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";
import { getToken, clearAuth } from "@/lib/auth";
import { allPages, readData, writeData, type User, type Farm, type Coop, type Cycle, type Source } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";

type Capabilities = { read?: boolean; operate?: boolean; manage?: boolean; relay_operate?: boolean;[key: string]: unknown };
type ContextValue = { user?: User; farms: Farm[]; coops: Coop[]; farmId?: number; coopId?: number; coop?: Coop; source: Source; selectFarm: (id: number) => void; selectCoop: (id: number) => void; setSource: (source: Source) => void; refresh: () => Promise<void>; capabilities: Capabilities; canOperate: boolean; canManage: boolean; canRelay: boolean; loading: boolean; error: string | null; socketStatus: "idle" | "connecting" | "live" | "rest"; socketError: string | null };
const Context = createContext<ContextValue | null>(null);
const EMPTY_COOPS: Coop[] = [];
const EMPTY_CAPABILITIES: Capabilities = {};
const subscribeHydration = () => () => { };

export function BroilerProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const client = useQueryClient();
    const [token, setToken] = useState(() => getToken());
    const [sessionVersion, setSessionVersion] = useState(0);
    const [selection, setSelection] = useState<{ farmId?: number; coopId?: number }>({});
    const [source, setSource] = useState<Source>("real");
    const [socket, setSocket] = useState<Socket | null>(null);
    const [socketStatus, setSocketStatus] = useState<ContextValue["socketStatus"]>("idle");
    const [socketError, setSocketError] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<unknown>(null);
    const socketRef = useRef<Socket | null>(null);
    const scopeRef = useRef<{ coopId?: number; source: Source }>({ source: "real" });
    const defaultWrite = useRef<Promise<unknown>>(Promise.resolve());
    const selectionVersion = useRef(0);
    const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
    const enabled = hydrated && pathname.startsWith("/dashboard") && Boolean(token);
    useEffect(() => {
        const session = () => { socketRef.current?.disconnect(); void client.cancelQueries(); client.clear(); selectionVersion.current++; setSessionVersion(value => value + 1); setSelection({}); setSelectionError(null); setSource("real"); setToken(getToken()); };
        const unauthorized = () => { clearAuth(); session(); router.replace("/"); };
        const syncSession = () => { if (getToken() !== token) { session(); if (!getToken()) router.replace("/"); } };
        window.addEventListener("coasther:session", session);
        window.addEventListener("coasther:unauthorized", unauthorized);
        window.addEventListener("storage", syncSession); window.addEventListener("focus", syncSession);
        return () => { window.removeEventListener("coasther:session", session); window.removeEventListener("coasther:unauthorized", unauthorized); window.removeEventListener("storage", syncSession); window.removeEventListener("focus", syncSession); };
    }, [client, router, token]);
    const me = useQuery({ queryKey: ["broiler-session", sessionVersion], queryFn: ({ signal }) => readData<{ user: User }>("/api/auth/me", undefined, { signal }), enabled, retry: false, staleTime: 30000 });
    const user = enabled ? me.data?.user : undefined;
    const userId = user?.id;
    const farms = useQuery({ queryKey: ["broiler-farms", userId], queryFn: ({ signal }) => allPages<Farm>("/api/farms", "farms", undefined, { signal }), enabled: Boolean(user), retry: false });
    const coops = useQuery({ queryKey: ["broiler-coops", userId], queryFn: ({ signal }) => allPages<Coop>("/api/coops", "coops", undefined, { signal }), enabled: Boolean(user), retry: false });
    const bootstrap = useQuery({ queryKey: ["broiler-context", userId], queryFn: ({ signal }) => readData<{ state: string; coop: Coop | null; active_cycle: Cycle | null }>("/api/dashboard/context", undefined, { signal }), enabled: Boolean(user), retry: false });
    const allCoops = user ? coops.data ?? EMPTY_COOPS : EMPTY_COOPS;
    const defaultCoop = allCoops.find(c => c.id === user?.default_coop_id) ?? bootstrap.data?.coop ?? undefined;
    const farmId = selection.farmId ?? defaultCoop?.farm_id ?? farms.data?.[0]?.id;
    const visibleCoops = allCoops.filter(c => c.farm_id === farmId);
    const coop = visibleCoops.find(c => c.id === selection.coopId) ?? visibleCoops.find(c => c.id === defaultCoop?.id) ?? visibleCoops[0];
    const coopId = coop?.id;
    const capabilityQuery = useQuery({ queryKey: ["broiler-capabilities", userId, coopId], queryFn: ({ signal }) => readData<{ capabilities: Capabilities }>(`/api/coops/${coopId}/capabilities`, undefined, { signal }), enabled: Boolean(user && coopId), retry: false, refetchInterval: 60000 });
    const capabilities = capabilityQuery.isError ? EMPTY_CAPABILITIES : capabilityQuery.data?.capabilities ?? EMPTY_CAPABILITIES;
    const role = coop?.member_role ?? farms.data?.find(f => f.id === farmId)?.member_role;
    const canManage = coopId ? capabilities.manage === true : user?.role === "admin" || role === "owner" || role === "manager";
    const canOperate = capabilities.operate === true;
    const canRelay = capabilities.relay_operate === true || capabilities["relay:operate"] === true;
    const selectFarm = useCallback((id: number) => { selectionVersion.current++; setSelectionError(null); setSelection({ farmId: id }); }, []);
    const selectCoop = useCallback((id: number) => {
        const selected = allCoops.find(c => c.id === id);
        if (!selected) return;
        setSelection({ farmId: selected.farm_id, coopId: id });
        const version = ++selectionVersion.current;
        const selectedToken = getToken();
        setSelectionError(null);
        // Serialize preference writes so rapid coop switches persist the last selection.
        defaultWrite.current = defaultWrite.current.catch(() => { }).then(async () => {
            if (getToken() !== selectedToken || version !== selectionVersion.current) return;
            await writeData("put", "/api/users/me", { default_coop_id: id });
            if (getToken() === selectedToken && version === selectionVersion.current) await client.invalidateQueries({ queryKey: ["broiler-session"] });
        }).catch(error => { if (getToken() === selectedToken && version === selectionVersion.current) setSelectionError(error); });
    }, [allCoops, client]);
    const refresh = useCallback(async () => { await client.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("broiler") }); }, [client]);
    useEffect(() => { scopeRef.current = { coopId, source }; }, [coopId, source]);
    useEffect(() => {
        if (!enabled || !token || !userId) return;
        const connection = io(API_BASE_URL || undefined, {
            auth: { token }, autoConnect: false, withCredentials: false,
            path: process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io",
            transports: ["websocket", "polling"], tryAllTransports: true,
            transportOptions: { polling: { extraHeaders: { "ngrok-skip-browser-warning": "true" } } },
            reconnectionDelay: 2000, reconnectionDelayMax: 30000, randomizationFactor: 0.5, timeout: 15000,
        });
        socketRef.current = connection;
        setSocket(connection); setSocketStatus("connecting"); setSocketError(null);
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let reconnect: ReturnType<typeof setTimeout> | undefined;
        let reconnectDelay = 5000;
        const changes = new Map<number, Set<string>>();
        let inbox = false;
        const groups: Record<string, string[]> = {
            telemetry_update: ["summary", "telemetry-history", "diagnostics"],
            meter_update: ["summary", "charts", "monthly", "cycle-report", "meter"],
            device_status: ["summary", "device", "maintenance-status", "relay-preflight"],
            alert_created: ["alerts", "guard", "eco"], alert_updated: ["alerts", "guard", "eco"],
            relay_state_update: ["relay", "maintenance-status"], relay_command_update: ["relay", "diagnostics"],
            maintenance_request_update: ["maintenance-status", "maintenance-request", "diagnostics"],
        };
        const update = (event: string, payload?: { coop_id?: number }) => {
            if (!active) return;
            if (event.startsWith("notification_")) inbox = true;
            if (payload?.coop_id) {
                const names = changes.get(payload.coop_id) ?? new Set<string>();
                (groups[event] ?? []).forEach(name => names.add(name)); changes.set(payload.coop_id, names);
            }
            if (timer) return; timer = setTimeout(() => {
                timer = undefined;
                if (active) void client.invalidateQueries({
                    predicate: q => {
                        const key = q.queryKey;
                        if (key[1] !== userId) return false;
                        if (["broiler-nav-alerts", "broiler-nav-unread"].includes(String(key[0]))) return true;
                        if (key[0] === "broiler-overview") return changes.has(Number(key[3]));
                        if (key[0] !== "broiler") return false;
                        if (inbox && key.some(part => typeof part === "string" && /notification|inbox|unread/.test(part))) return true;
                        const names = changes.get(Number(typeof key[3] === "number" ? key[3] : key[2]));
                        return Boolean(names && key.some(part => typeof part === "string" && [...names].some(name => part.includes(name))));
                    }
                });
                changes.clear(); inbox = false;
            }, 2000);
        };
        const notified = new Set<number>();
        const notify = (payload: { id?: number; coop_id?: number; source?: string; severity?: string; title?: string; message?: string }) => {
            update("alert_created", payload);
            const selected = scopeRef.current;
            if ((payload.source === "simulation") === (selected.source === "simulation") && ["warning", "critical"].includes(payload.severity ?? "") && payload.id && !notified.has(payload.id)) {
                if (notified.size >= 100) notified.delete(notified.values().next().value!);
                notified.add(payload.id);
                void import("@/lib/guard-settings").then(({ getGuardSettings }) => {
                    const preference = getGuardSettings();
                    if (active && (preference.notifySound || preference.notifyBrowser)) void import("@/lib/alert-notify").then(module => {
                        if (!active) return;
                        if (preference.notifySound && payload.severity === "critical" && document.visibilityState === "visible") module.playAlertSound();
                        if (preference.notifyBrowser && payload.coop_id) module.showAlertNotification({ key: `broiler:${userId}:${payload.id}`, roomId: payload.coop_id, roomNumber: String(payload.coop_id), tier: payload.severity === "critical" ? "kritis" : "waspada", title: `${payload.source === "simulation" ? "[SIMULASI] " : ""}${payload.title ?? "Peringatan Guard"}`, action: payload.message ?? "Buka Guard untuk melihat bukti server." });
                    });
                });
            }
        };
        const disconnected = () => { if (active) { setSocketStatus("rest"); setSocketError("Socket terputus; pembaruan sementara melalui REST sambil menyambungkan ulang."); } };
        const failed = (error: Error & { data?: { statusCode?: number } }) => {
            if (!active) return;
            setSocketStatus("rest");
            setSocketError("Socket belum tersambung; data dipulihkan melalui REST. Periksa origin frontend, path Socket.IO dan respons tunnel ngrok.");
            if (error.data?.statusCode === 401 && getToken() === token) window.dispatchEvent(new Event("coasther:unauthorized"));
            else if (!connection.active && !reconnect) {
                reconnect = setTimeout(() => { reconnect = undefined; if (active && getToken() === token) connection.connect(); }, reconnectDelay);
                reconnectDelay = Math.min(30000, reconnectDelay * 2);
            }
        };
        const revoked = ({ coop_id }: { coop_id: number }) => {
            const affected = (q: { queryKey: readonly unknown[] }) => q.queryKey[1] === userId && (q.queryKey[0] === "broiler" ? (typeof q.queryKey[3] === "number" ? q.queryKey[3] : q.queryKey[2]) === coop_id : q.queryKey[0] === "broiler-overview" ? q.queryKey[3] === coop_id : q.queryKey[0] === "broiler-capabilities" && q.queryKey[2] === coop_id);
            void client.cancelQueries({ predicate: affected }); client.removeQueries({ predicate: affected });
            if (scopeRef.current.coopId === coop_id) { setSelection({}); setSocketStatus("rest"); setSocketError("Akses kandang berubah; daftar dan izin sedang dimuat ulang."); }
            void refresh();
        };
        const events = ["telemetry_update", "meter_update", "device_status", "alert_updated", "notification_created", "notification_updated", "notification_unread_count", "relay_state_update", "relay_command_update", "maintenance_request_update"];
        const handlers = events.map(event => ({ event, handler: (payload: { coop_id?: number }) => update(event, payload) }));
        handlers.forEach(({ event, handler }) => connection.on(event, handler));
        connection.on("alert_created", notify); connection.on("coop:revoked", revoked);
        connection.on("disconnect", disconnected); connection.on("connect_error", failed);
        connection.connect();
        return () => {
            active = false; if (timer) clearTimeout(timer); if (reconnect) clearTimeout(reconnect);
            handlers.forEach(({ event, handler }) => connection.off(event, handler));
            connection.off("alert_created", notify); connection.off("coop:revoked", revoked);
            connection.off("disconnect", disconnected); connection.off("connect_error", failed);
            connection.disconnect(); if (socketRef.current === connection) socketRef.current = null;
            setSocket(null); setSocketStatus("idle"); setSocketError(null);
        };
    }, [enabled, token, userId, client, refresh]);
    useEffect(() => {
        if (!socket) return;
        if (!coopId) { setSocketStatus("rest"); setSocketError(null); return; }
        let active = true;
        let attempt = 0;
        let retry: ReturnType<typeof setTimeout> | undefined;
        const subscribe = () => {
            if (!active || !socket.connected) return;
            if (retry) clearTimeout(retry);
            const currentAttempt = ++attempt;
            setSocketStatus("connecting");
            socket.timeout(10000).emit("coop:subscribe", { coop_id: coopId }, (error: Error | null, ack?: { success: boolean; statusCode?: number; message?: string }) => {
                if (!active || currentAttempt !== attempt || !socket.connected) return;
                if (!error && ack?.success) { setSocketStatus("live"); setSocketError(null); void refresh(); return; }
                setSocketStatus("rest"); setSocketError(ack?.message || "Subscription Socket belum terkonfirmasi; REST tetap aktif.");
                if (ack?.statusCode === 401) window.dispatchEvent(new Event("coasther:unauthorized"));
                else if (ack?.statusCode === 403 || ack?.statusCode === 404) { void client.invalidateQueries({ queryKey: ["broiler-coops"] }); void client.invalidateQueries({ queryKey: ["broiler-capabilities"] }); }
                else retry = setTimeout(subscribe, 15000);
            });
        };
        socket.on("connect", subscribe); subscribe();
        return () => { active = false; if (retry) clearTimeout(retry); socket.off("connect", subscribe); if (socket.connected) socket.emit("coop:unsubscribe", { coop_id: coopId }); };
    }, [socket, coopId, source, client, refresh]);
    useEffect(() => {
        if (!enabled || !userId || socketStatus === "live") return;
        const timer = setInterval(() => { void client.invalidateQueries({ predicate: q => q.queryKey[1] === userId && ["broiler", "broiler-overview", "broiler-nav-alerts", "broiler-nav-unread"].includes(String(q.queryKey[0])) }); }, 20000);
        return () => clearInterval(timer);
    }, [enabled, userId, socketStatus, client]);
    const error = me.error ?? farms.error ?? coops.error ?? bootstrap.error ?? capabilityQuery.error ?? selectionError;
    const value = useMemo(() => ({ user, farms: user ? farms.data ?? [] : [], coops: allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, setSource, refresh, capabilities, canOperate, canManage, canRelay, socketStatus, socketError, loading: enabled && (me.isPending || Boolean(user) && (farms.isPending || coops.isPending || bootstrap.isPending)), error: error ? apiErrorMessage(error) : null }), [user, farms.data, allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, refresh, capabilities, canOperate, canManage, canRelay, socketStatus, socketError, enabled, me.isPending, farms.isPending, coops.isPending, bootstrap.isPending, error]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBroiler() { const value = useContext(Context); if (!value) throw new Error("BroilerProvider diperlukan"); return value; }
