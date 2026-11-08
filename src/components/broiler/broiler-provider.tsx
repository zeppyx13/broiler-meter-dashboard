"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";
import { getToken, clearAuth } from "@/lib/auth";
import { allPages, readData, writeData, type User, type Farm, type Coop, type Cycle, type Source, type BusinessRole, type Capabilities } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";

type ContextValue = { user?: User; farms: Farm[]; coops: Coop[]; farmId?: number; coopId?: number; coop?: Coop; source: Source; selectFarm: (id: number) => void; selectCoop: (id: number) => void; refresh: () => Promise<void>; capabilities: Capabilities; farmCapabilities: Capabilities; effectiveRole: BusinessRole; accessVersion: number; canMaintenance: boolean; canInsights: boolean; canDailyCorrect: boolean; canHarvest: boolean; canOperate: boolean; canManage: boolean; canAdminIot: boolean; canRelay: boolean; loading: boolean; error: string | null; socketStatus: "idle" | "connecting" | "live" | "rest"; socketError: string | null };
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
    const [accessVersion, setAccessVersion] = useState(0);
    const [selection, setSelection] = useState<{ farmId?: number; coopId?: number }>({});
    const source: Source = "real";
    const [socket, setSocket] = useState<Socket | null>(null);
    const [socketStatus, setSocketStatus] = useState<ContextValue["socketStatus"]>("idle");
    const [socketError, setSocketError] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<unknown>(null);
    const socketRef = useRef<Socket | null>(null);
    const defaultWrite = useRef<Promise<unknown>>(Promise.resolve());
    const selectionVersion = useRef(0);
    const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
    const enabled = hydrated && pathname.startsWith("/dashboard") && Boolean(token);
    const reloadAccess = useCallback(() => {
        socketRef.current?.disconnect();
        void client.cancelQueries(); client.clear();
        selectionVersion.current++;
        setSelection({}); setSelectionError(null);
        setAccessVersion(value => value + 1); setSessionVersion(value => value + 1);
        window.dispatchEvent(new Event("coasther:access-changed"));
        void import("sweetalert2").then(({ default: Swal }) => Swal.close());
    }, [client]);
    useEffect(() => {
        const session = () => { socketRef.current?.disconnect(); void client.cancelQueries(); client.clear(); selectionVersion.current++; setSessionVersion(value => value + 1); setAccessVersion(value => value + 1); setSelection({}); setSelectionError(null); setToken(getToken()); };
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
    const farms = useQuery({ queryKey: ["broiler-farms", userId], queryFn: ({ signal }) => allPages<Farm>("/api/farms", "farms", undefined, { signal }), enabled: Boolean(user), retry: false, refetchInterval: 60000 });
    const coops = useQuery({ queryKey: ["broiler-coops", userId], queryFn: ({ signal }) => allPages<Coop>("/api/coops", "coops", undefined, { signal }), enabled: Boolean(user), retry: false, refetchInterval: 60000 });
    const bootstrap = useQuery({ queryKey: ["broiler-context", userId], queryFn: ({ signal }) => readData<{ state: string; coop: Coop | null; active_cycle: Cycle | null }>("/api/dashboard/context", undefined, { signal }), enabled: Boolean(user), retry: false });
    const allCoops = user ? coops.data ?? EMPTY_COOPS : EMPTY_COOPS;
    // Prefer an accessible physical binding when a saved legacy default has no real device.
    // An explicit selection always wins, including a coop that has no telemetry yet.
    const deviceRegistry = useQuery({ queryKey: ["broiler-device-selection", userId], queryFn: ({ signal }) => allPages<{ coop_id: number; device_type: string; data_provenance?: string; is_active: boolean | number }>("/api/devices", "devices", { is_active: 1 }, { signal }), enabled: Boolean(user), retry: false, staleTime: 60000 });
    const hasPhysicalDevice = (id: number) => deviceRegistry.data?.some(device => device.coop_id === id && device.device_type === "esp32" && device.data_provenance !== "simulation" && (device.is_active === true || Number(device.is_active) === 1)) ?? false;
    const preferredCoop = allCoops.find(c => c.id === user?.default_coop_id) ?? allCoops.find(c => c.id === bootstrap.data?.coop?.id);
    const defaultCoop = preferredCoop && hasPhysicalDevice(preferredCoop.id) ? preferredCoop : allCoops.find(c => hasPhysicalDevice(c.id)) ?? preferredCoop;
    const farmId = farms.data?.find(farm => farm.id === selection.farmId)?.id ?? defaultCoop?.farm_id ?? farms.data?.[0]?.id;
    const visibleCoops = allCoops.filter(c => c.farm_id === farmId);
    const coop = user && deviceRegistry.isPending && !selection.coopId && !selection.farmId ? undefined : visibleCoops.find(c => c.id === selection.coopId) ?? visibleCoops.find(c => c.id === defaultCoop?.id) ?? visibleCoops.find(c => hasPhysicalDevice(c.id)) ?? visibleCoops[0];
    const coopId = coop?.id;
    useEffect(() => {
        // Keep the initial registry-backed choice stable while a setup wizard adds a device.
        // This is local selection only; preference writes remain explicit user actions.
        if (coopId && farmId && !deviceRegistry.isPending && !selection.coopId && !selection.farmId) setSelection({ farmId, coopId });
    }, [coopId, farmId, deviceRegistry.isPending, selection.coopId, selection.farmId]);
    const capabilityQuery = useQuery({ queryKey: ["broiler-capabilities", userId, coopId], queryFn: ({ signal }) => readData<{ effective_role?: BusinessRole; capabilities: Capabilities }>(`/api/coops/${coopId}/capabilities`, undefined, { signal }), enabled: Boolean(user && coopId), retry: false, refetchInterval: 60000 });
    const capabilities = capabilityQuery.isError ? EMPTY_CAPABILITIES : capabilityQuery.data?.capabilities ?? EMPTY_CAPABILITIES;
    const selectedFarm = farms.data?.find(farm => farm.id === farmId);
    const farmCapabilities = farms.isError ? EMPTY_CAPABILITIES : selectedFarm?.capabilities ?? EMPTY_CAPABILITIES;
    const effectiveRole = capabilityQuery.isError ? "none" : capabilityQuery.data?.effective_role ?? coop?.effective_role ?? selectedFarm?.effective_role ?? "none";
    useEffect(() => {
        if (isAxiosError(capabilityQuery.error) && [403, 404, 409].includes(capabilityQuery.error.response?.status ?? 0)) reloadAccess();
    }, [capabilityQuery.error, reloadAccess]);
    const canManage = capabilities.manage === true;
    const canOperate = capabilities.operate === true;
    const canAdminIot = capabilities["device:manage"] === true;
    const canMaintenance = capabilities["maintenance:operate"] === true;
    const canRelay = capabilities["relay:operate"] === true;
    const canInsights = capabilities["insights:use"] === true;
    const canDailyCorrect = capabilities["daily:correct"] === true;
    const canHarvest = capabilities["cycle:harvest"] === true;
    const selectFarm = useCallback((id: number) => { if (!farms.data?.some(farm => farm.id === id)) return; selectionVersion.current++; setSelectionError(null); setSelection({ farmId: id }); }, [farms.data]);
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
            if (["rule", "manual", "real", "sensor"].includes(payload.source ?? "") && ["warning", "critical"].includes(payload.severity ?? "") && payload.id && !notified.has(payload.id)) {
                if (notified.size >= 100) notified.delete(notified.values().next().value!);
                notified.add(payload.id);
                void import("@/lib/guard-settings").then(({ getGuardSettings }) => {
                    const preference = getGuardSettings();
                    if (active && getToken() === token && (preference.notifySound || preference.notifyBrowser)) void import("@/lib/alert-notify").then(module => {
                        if (!active || getToken() !== token) return;
                        if (preference.notifySound && payload.severity === "critical" && document.visibilityState === "visible") module.playAlertSound();
                        if (preference.notifyBrowser && payload.coop_id) module.showAlertNotification({ key: `broiler:${userId}:${payload.id}`, roomId: payload.coop_id, roomNumber: String(payload.coop_id), tier: payload.severity === "critical" ? "kritis" : "waspada", title: payload.title ?? "Peringatan Guard", action: payload.message ?? "Buka Guard untuk melihat bukti server." });
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
        const accessChanged = () => {
            if (!active || getToken() !== token) return;
            reloadAccess();
        };
        const revoked = () => accessChanged();
        const events = ["telemetry_update", "meter_update", "device_status", "alert_updated", "notification_created", "notification_updated", "notification_unread_count", "relay_state_update", "relay_command_update", "maintenance_request_update"];
        const handlers = events.map(event => ({ event, handler: (payload: { coop_id?: number }) => update(event, payload) }));
        handlers.forEach(({ event, handler }) => connection.on(event, handler));
        connection.on("alert_created", notify); connection.on("coop:revoked", revoked); connection.on("access:changed", accessChanged);
        connection.on("disconnect", disconnected); connection.on("connect_error", failed);
        connection.connect();
        return () => {
            active = false; if (timer) clearTimeout(timer); if (reconnect) clearTimeout(reconnect);
            handlers.forEach(({ event, handler }) => connection.off(event, handler));
            connection.off("alert_created", notify); connection.off("coop:revoked", revoked); connection.off("access:changed", accessChanged);
            connection.off("disconnect", disconnected); connection.off("connect_error", failed);
            connection.disconnect(); if (socketRef.current === connection) socketRef.current = null;
            setSocket(null); setSocketStatus("idle"); setSocketError(null);
        };
    }, [enabled, token, userId, client, refresh, reloadAccess]);
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
                else if ([403, 404, 409].includes(ack?.statusCode ?? 0)) reloadAccess();
                else retry = setTimeout(subscribe, 15000);
            });
        };
        socket.on("connect", subscribe); subscribe();
        return () => { active = false; if (retry) clearTimeout(retry); socket.off("connect", subscribe); if (socket.connected) socket.emit("coop:unsubscribe", { coop_id: coopId }); };
    }, [socket, coopId, client, refresh, reloadAccess]);
    const error = me.error ?? farms.error ?? coops.error ?? bootstrap.error ?? deviceRegistry.error ?? capabilityQuery.error ?? selectionError;
    const value = useMemo(() => ({ user, farms: user ? farms.data ?? [] : [], coops: allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, refresh, capabilities, farmCapabilities, effectiveRole, accessVersion, canMaintenance, canInsights, canDailyCorrect, canHarvest, canOperate, canManage, canAdminIot, canRelay, socketStatus, socketError, loading: enabled && (me.isPending || Boolean(user) && (farms.isPending || coops.isPending || bootstrap.isPending || deviceRegistry.isPending || Boolean(coopId) && capabilityQuery.isPending)), error: error ? apiErrorMessage(error) : user?.scope_warnings?.length ? "Akses sebagian farm diblokir karena kepemilikan belum konsisten. Owner perlu meninjau hubungan kepemilikan sebelum akses dibuka kembali." : null }), [user, farms.data, allCoops, farmId, coopId, coop, source, selectFarm, selectCoop, refresh, capabilities, farmCapabilities, effectiveRole, accessVersion, canMaintenance, canInsights, canDailyCorrect, canHarvest, canOperate, canManage, canAdminIot, canRelay, socketStatus, socketError, enabled, me.isPending, farms.isPending, coops.isPending, bootstrap.isPending, deviceRegistry.isPending, capabilityQuery.isPending, error]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBroiler() { const value = useContext(Context); if (!value) throw new Error("BroilerProvider diperlukan"); return value; }
