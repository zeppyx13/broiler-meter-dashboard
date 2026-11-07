"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Download, Power, RefreshCw, Send, ShieldAlert, Terminal, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { getToken } from "@/lib/auth";
import { maintenanceCommands, type MaintenanceCommand, type MaintenanceDevice, type MaintenanceRequest, type MaintenanceResult, type MaintenanceStatus } from "@/types/maintenance";
import { useBroiler } from "../broiler-provider";
import { Card, controlClass, dateTime, secondaryClass, useScopedQuery, type CommandRow } from "./shared";
import type { RelayPreflight } from "./safety";

type Diagnostic = { id: number; device_id?: number | null; level: string; code: string; message: string; source: string; recorded_at?: string | null; received_at?: string | null };
type LogLevel = "INFO" | "WARN" | "ERROR";
type LogEntry = { key: string; at: string; level: LogLevel; label: string; message: string };
type TerminalCommand = MaintenanceCommand | "relay_on" | "relay_off";
const aliases: readonly string[] = [...maintenanceCommands, "relay_on", "relay_off"];
const pendingStatuses = ["accepted", "publishing", "published", "observed"];
const labels: Record<string, string> = { accepted: "Menunggu", publishing: "Menunggu", queued: "Menunggu", requested: "Menunggu", published: "Dikirim", observed: "Tidak terverifikasi", unverified: "Tidak terverifikasi", reported: "Tidak terverifikasi", blocked: "Ditolak", failed: "Gagal", timed_out: "Timeout" };
const warnings = {
    reboot: "Perangkat akan dimulai ulang. Koneksi dan telemetry akan terputus sementara; pastikan operasi kandang aman.",
    clear_buf: "Data offline yang belum terkirim dapat hilang.",
    reset_nvs: "Counter air dan energi serta epoch perangkat dapat berubah.",
};
const dataProtection = "Tidak tersedia: perlu perlindungan data perangkat";

function clean(value: unknown) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\b(Bearer\s+)\S+/gi, "$1[REDACTED]")
        .replace(/(["']?\b(?:token|password|secret|authorization|mqtt_cmd_token|api_key)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[REDACTED]")
        .replace(/\b((?:mqtts?|https?):\/\/)[^\s/:@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
        .replace(/\b(status|sync_ntp|relay_on|relay_off|reboot|clear_buf|reset_nvs):[^\s]+/gi, "$1:[REDACTED]")
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
        .slice(0, 1200);
}
function requestLog(request: MaintenanceRequest): LogEntry {
    return {
        key: `maintenance:${request.request_id}:${request.status}:${request.observation?.received_at ?? ""}`,
        at: request.observation?.received_at ?? request.published_at ?? request.requested_at,
        level: ["blocked", "failed"].includes(request.status) ? "ERROR" : ["unverified", "observed", "timed_out"].includes(request.status) ? "WARN" : "INFO",
        label: "AUDIT",
        message: `${request.command} · ${labels[request.status] ?? request.status} · ${request.request_id}${request.failure_reason ? ` · ${request.failure_reason}` : ""}${request.observation ? ` · laporan umum ${request.observation.result ?? "perangkat"}, bukan ACK permintaan` : ""}. Eksekusi fisik belum terverifikasi.`,
    };
}

export function TerminalOperations() {
    const context = useBroiler();
    return <TerminalScope key={`${context.user?.id ?? "none"}:${context.coopId ?? "none"}`} />;
}

function TerminalScope() {
    const context = useBroiler();
    const [selectedDevice, setSelectedDevice] = useState<number>();
    const status = useScopedQuery<MaintenanceStatus>("maintenance-status", `/api/coops/${context.coopId}/maintenance/status`, { source: "real" }, Boolean(context.coopId), 10_000);
    const devices = status.data?.devices.filter(item => item.data_provenance !== "simulation") ?? [];
    const device = devices.find(item => item.id === selectedDevice) ?? devices[0];
    async function refreshStatus() {
        const latest = await status.refetch();
        if (latest.isError || !latest.data) throw latest.error ?? new Error("Snapshot server belum tersedia.");
        return latest.data;
    }
    return <div className="space-y-5">
        <Card title="Remote Terminal" description="Monitor log dan perintah ESP32 melalui backend COASTHER.">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-[#777]">Kandang
                    <select aria-label="Kandang terminal" value={context.coopId ?? ""} onChange={event => context.selectCoop(Number(event.target.value))} className={controlClass} disabled={!context.coops.length}>
                        {!context.coops.length && <option value="">Belum ada kandang</option>}
                        {context.coops.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
                    </select>
                </label>
                <label className="space-y-1 text-xs text-[#777]">Perangkat
                    <select aria-label="Perangkat terminal" value={device?.id ?? ""} onChange={event => setSelectedDevice(Number(event.target.value))} disabled={!devices.length} className={controlClass}>
                        {!devices.length && <option value="">Belum ada perangkat terhubung</option>}
                        {devices.map(item => <option key={item.id} value={item.id}>{item.name} · {item.device_uid}</option>)}
                    </select>
                </label>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-[#7B1113]">Backend REST: {status.isError ? "gagal dihubungi" : status.data ? "terhubung" : "menunggu"}</span>
                <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-[#7B1113]">Socket: {context.socketStatus === "live" ? "terhubung" : context.socketStatus === "connecting" ? "menghubungkan" : "REST fallback"}</span>
                <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-[#7B1113]">ESP32: {status.isError ? "status tidak tersedia" : device?.connectivity_status ?? "belum ada heartbeat"}</span>
            </div>
            {status.error && <p role="alert" className="text-sm text-red-700">{clean(apiErrorMessage(status.error))}</p>}
            {context.socketError && <p className="text-xs text-[#888]">{clean(context.socketError)}</p>}
        </Card>
        <DeviceTerminal key={device ? `${device.id}:${device.device_uid}:${device.firmware_version}:${device.mqtt_topic_key}` : "no-device"} device={device} snapshot={status.data} available={!status.isError && Boolean(status.data)} refreshStatus={refreshStatus} />
    </div>;
}

function DeviceTerminal({ device, snapshot, available, refreshStatus }: { device?: MaintenanceDevice; snapshot?: MaintenanceStatus; available: boolean; refreshStatus: () => Promise<MaintenanceStatus> }) {
    const context = useBroiler();
    const [level, setLevel] = useState<"ALL" | LogLevel>("ALL");
    const [autoScroll, setAutoScroll] = useState(true);
    const [input, setInput] = useState("");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [requestId, setRequestId] = useState<string>();
    const [submitted, setSubmitted] = useState<MaintenanceResult>();
    const [polling, setPolling] = useState(false);
    const mounted = useRef(true);
    const inFlight = useRef(false);
    const dialogOpen = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const seen = useRef(new Set<string>());
    const localSequence = useRef(0);
    const bottom = useRef<HTMLDivElement>(null);
    const diagnostics = useScopedQuery<{ entries: Diagnostic[] }>("diagnostics", `/api/coops/${context.coopId}/diagnostics`, { source: "real", limit: 100 }, Boolean(context.coopId), 10_000);
    const relay = snapshot?.relays.find(item => item.device_id === device?.id && item.channel === 1);
    const relayPreflight = useScopedQuery<RelayPreflight>(`terminal-relay-preflight-${relay?.id}`, `/api/relays/${relay?.id}/preflight`, undefined, Boolean(relay), 10_000);
    const relayCommands = useScopedQuery<{ commands: CommandRow[] }>(`terminal-relay-commands-${relay?.id}`, `/api/relays/${relay?.id}/commands`, { page: 1, limit: 20 }, Boolean(relay), 10_000);
    const lookup = useScopedQuery<MaintenanceResult>(`maintenance-request-${requestId}`, `/api/coops/${context.coopId}/maintenance/requests/${requestId}`, undefined, Boolean(requestId) && !busy, polling ? 3_000 : undefined);
    const request = lookup.data?.request ?? submitted?.request;
    const canCommand = context.canAdminIot && Boolean(device && available);
    const entries = logs.filter(entry => level === "ALL" || entry.level === level);
    const append = useCallback((items: LogEntry[]) => {
        const fresh = items.filter(item => !seen.current.has(item.key));
        if (!fresh.length) return;
        fresh.forEach(item => seen.current.add(item.key));
        if (seen.current.size > 2000) seen.current = new Set([...seen.current].slice(-1500));
        setLogs(current => [...current, ...fresh.map(item => ({ ...item, label: clean(item.label), message: clean(item.message) }))].slice(-500));
    }, []);
    function local(message: string, severity: LogLevel = "INFO") {
        append([{ key: `local:${++localSequence.current}`, at: new Date().toISOString(), level: severity, label: "SISTEM", message }]);
    }

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; controller.current?.abort(); if (dialogOpen.current) Swal.close(); };
    }, []);
    useEffect(() => {
        append([...(diagnostics.data?.entries ?? [])].reverse().filter(item => item.device_id == null || item.device_id === device?.id).map<LogEntry>(item => ({
            key: `diagnostic:${item.id}`, at: item.received_at ?? item.recorded_at ?? "", level: item.level === "error" ? "ERROR" : ["warning", "warn"].includes(item.level) ? "WARN" : "INFO",
            label: item.device_id ? device?.name ?? "PERANGKAT" : "SISTEM", message: `${item.code} · ${item.message} · ${item.source}`,
        })));
    }, [diagnostics.data, device?.id, device?.name, append]);
    useEffect(() => {
        append((snapshot?.recent_requests ?? []).filter(item => item.device_id === device?.id).slice().reverse().map(requestLog));
    }, [snapshot?.recent_requests, device?.id, append]);
    useEffect(() => {
        if (!request) return;
        append([requestLog(request)]);
        if (!pendingStatuses.includes(request.status)) setPolling(false);
    }, [request, append]);
    useEffect(() => {
        if (isAxiosError(lookup.error) && [400, 401, 403, 404].includes(lookup.error.response?.status ?? 0)) setPolling(false);
    }, [lookup.error]);
    useEffect(() => {
        if (!polling) return;
        const timeout = setTimeout(() => setPolling(false), 60_000);
        return () => clearTimeout(timeout);
    }, [polling, requestId]);
    useEffect(() => {
        append((relayCommands.data?.commands ?? []).slice().reverse().map<LogEntry>(item => ({ key: `relay:${item.id}:${item.status}`, at: item.published_at ?? item.requested_at ?? "", level: ["failed", "blocked"].includes(item.status) ? "ERROR" : ["timed_out", "reported"].includes(item.status) ? "WARN" : "INFO", label: "RELAY", message: `${item.command} · ${labels[item.status] ?? item.status}${item.failure_reason ? ` · ${item.failure_reason}` : ""}. Hasil fisik belum terverifikasi.` })));
    }, [relayCommands.data, append]);
    useEffect(() => { if (autoScroll) bottom.current?.scrollIntoView({ block: "nearest" }); }, [logs, level, autoScroll]);

    function blockedReason(command: TerminalCommand) {
        if (command === "status") return context.coopId ? null : "Pilih kandang terlebih dahulu.";
        if (command === "clear_buf" || command === "reset_nvs") return dataProtection;
        if (!device) return "Belum ada ESP32 terhubung. Daftarkan perangkat melalui Kelola Alat.";
        if (!canCommand) return "Command hanya tersedia untuk Admin atau Owner pada perangkat dalam cakupannya.";
        if (command === "relay_on" || command === "relay_off") return !relay ? "Hubungkan mapping relay kanal 1 melalui Kelola Alat." : relayPreflight.isError || !relayPreflight.data ? "Preflight relay belum tersedia." : relayPreflight.data.allowed ? null : relayPreflight.data.reason;
        const capability = device?.command_capabilities?.[command];
        return capability?.allowed === true ? null : capability?.explanation ?? "Kesiapan command belum tersedia dari server.";
    }

    async function send(command: TerminalCommand) {
        if (inFlight.current) return;
        const reason = blockedReason(command);
        if (reason) { local(reason, "WARN"); return; }
        inFlight.current = true; setBusy(true);
        const sessionToken = getToken();
        const stillCurrent = () => mounted.current && getToken() === sessionToken;
        try {
            if (command === "status") {
                const latest = await refreshStatus();
                if (!stillCurrent()) return;
                const target = latest.devices.find(item => item.id === device?.id);
                local(`Snapshot REST · ${target?.name ?? "kandang"}: ${target?.connectivity_status ?? "belum ada perangkat"} · heartbeat ${dateTime(target?.last_seen_at)}. Tidak mengirim command fisik.`);
                return;
            }
            if (!device) return;
            const relayCommand = command === "relay_on" || command === "relay_off";
            if (command === "reboot" || relayCommand) {
                dialogOpen.current = true;
                const confirmation = await Swal.fire({ title: `${command === "reboot" ? "Reboot" : command === "relay_on" ? "Relay ON" : "Relay OFF"} · ${device.name}?`, text: command === "reboot" ? warnings.reboot : `Kandang ${context.coop?.name ?? context.coopId} · ${relay?.name}. Beban yang terhubung dapat berubah. Publikasi belum membuktikan hasil fisik.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, Jalankan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
                dialogOpen.current = false;
                if (!confirmation.isConfirmed || !stillCurrent()) return;
            }
            const latest = await refreshStatus();
            if (!stillCurrent()) return;
            const target = latest.devices.find(item => item.id === device.id && item.device_uid === device.device_uid && item.mqtt_topic_key === device.mqtt_topic_key && item.firmware_version === device.firmware_version);
            if (!target) throw new Error("Binding perangkat berubah. Pilih ulang target sebelum mengirim command.");
            controller.current = new AbortController();
            if (relayCommand) {
                if (!relay || !latest.relays.some(item => item.id === relay.id && item.device_id === target.id && item.channel === 1)) throw new Error("Mapping relay berubah; pilih ulang perangkat.");
                const preflight = await relayPreflight.refetch();
                if (!stillCurrent()) return;
                if (preflight.isError || !preflight.data?.allowed) throw preflight.error ?? new Error(preflight.data?.reason ?? "Relay belum diizinkan server.");
                // One POST only. A missing response is recovered through GET audit, never replayed.
                const response = await api.post<{ success: boolean; message?: string; data: { command: CommandRow } }>(`/api/relays/${relay.id}/commands`, { command: command === "relay_on" ? "on" : "off" }, { signal: controller.current.signal });
                if (!stillCurrent()) return;
                if (response.data.success !== true) throw new Error(response.data.message ?? "Permintaan relay ditolak.");
                local(`${command} · ${labels[response.data.data?.command?.status] ?? "Permintaan tercatat"}. Hasil fisik belum terverifikasi.`);
            } else {
                const capability = target.command_capabilities?.[command];
                if (capability?.allowed !== true) throw new Error(capability?.explanation ?? "Command belum diizinkan server.");
                if (!globalThis.crypto?.randomUUID) throw new Error("Browser memerlukan HTTPS dan UUID aman sebelum pengiriman.");
                const id = crypto.randomUUID();
                setRequestId(id); setSubmitted(undefined); setPolling(false);
                // UUID is retained across an ambiguous transport outcome; no automatic retry.
                const response = await api.post<{ success: boolean; message?: string; data: MaintenanceResult }>(`/api/coops/${context.coopId}/maintenance`, { device_id: target.id, command, request_id: id, source: "real" }, { signal: controller.current.signal });
                if (!stillCurrent()) return;
                if (!response.data.success || !response.data.data?.request) throw new Error(response.data.message ?? "Status pengiriman belum diketahui.");
                setSubmitted(response.data.data); setPolling(pendingStatuses.includes(response.data.data.request.status));
            }
        } catch (cause) {
            if (!stillCurrent()) return;
            const code = isAxiosError(cause) ? cause.response?.status : undefined;
            const result = isAxiosError<{ errors?: MaintenanceResult }>(cause) ? cause.response?.data.errors : undefined;
            if (result?.request) setSubmitted(result);
            local(`${code ? `HTTP ${code} · ` : ""}${apiErrorMessage(cause)}${isAxiosError(cause) && !code ? " Hasil pengiriman belum diketahui. Baca audit sebelum tindakan baru; command tidak diulang otomatis." : ""}`, "ERROR");
            if (isAxiosError(cause) && (!code || code >= 500)) setPolling(true);
        } finally {
            inFlight.current = false;
            if (stillCurrent()) { setBusy(false); void refreshStatus().catch(() => {}); if (relay) { void relayPreflight.refetch(); void relayCommands.refetch(); } }
        }
    }

    function exportLog() {
        const text = entries.map(entry => `${entry.at}\t${entry.level}\t${entry.label}\t${entry.message}`).join("\n");
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `coasther-terminal-${context.coopId}-${device?.id ?? "coop"}.txt`; anchor.click(); URL.revokeObjectURL(url);
    }
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const command = input.trim().toLowerCase();
        if (!aliases.includes(command)) { local("Perintah tidak dikenal. Gunakan status, sync_ntp, relay_on, relay_off, reboot, clear_buf, atau reset_nvs.", "WARN"); return; }
        setInput(""); void send(command as TerminalCommand);
    }
    function commandButton(command: TerminalCommand, title: string, danger = false) {
        const reason = blockedReason(command);
        return <button key={command} disabled={busy || Boolean(reason)} title={reason ?? title} onClick={() => { void send(command); }} className={`${secondaryClass} w-full justify-start ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : ""}`}>{command.startsWith("relay_") ? <Power size={15} /> : command === "reboot" || command === "sync_ntp" ? <RefreshCw size={15} /> : <Terminal size={15} />}{title}</button>;
    }
    return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-label="Konsol terminal" className="min-w-0 overflow-hidden rounded-3xl border border-[#EAEAEA] bg-[#151515]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex gap-1">{(["ALL", "INFO", "WARN", "ERROR"] as const).map(value => <button key={value} onClick={() => setLevel(value)} aria-pressed={level === value} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${level === value ? "bg-[#7B1113] text-[#C6A971]" : "text-white/55 hover:bg-white/5"}`}>{value}</button>)}</div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/65"><label className="flex items-center gap-1.5"><input type="checkbox" checked={autoScroll} onChange={event => setAutoScroll(event.target.checked)} />Auto-scroll</label><button className="flex items-center gap-1 disabled:opacity-40" disabled={!entries.length} onClick={exportLog}><Download size={14} />Export</button><button className="flex items-center gap-1" title="Hanya membersihkan tampilan lokal; audit server tetap tersimpan" onClick={() => setLogs([])}><Trash2 size={14} />Clear</button></div>
            </div>
            <div role="log" aria-label="Log perangkat dan audit command" aria-live="polite" className="h-[30rem] overflow-auto p-4 font-mono text-xs leading-6 sm:h-[36rem]">
                {diagnostics.isLoading && <p className="text-white/50">Memuat diagnostik server…</p>}
                {diagnostics.error && <p className="text-red-300">Diagnostik: {clean(apiErrorMessage(diagnostics.error))}</p>}
                {lookup.error && <p className="text-amber-200">Audit permintaan: {clean(apiErrorMessage(lookup.error))}. Pengiriman tidak diulang.</p>}
                {!entries.length && <p className="text-white/40">{context.coopId ? "Menunggu log perangkat. Clear hanya membersihkan tampilan lokal." : "Pilih kandang untuk membaca log."}</p>}
                {entries.map(entry => <p key={entry.key} className="break-words"><span className="text-white/35">{dateTime(entry.at)}</span>{" "}<span className={entry.level === "ERROR" ? "text-red-300" : entry.level === "WARN" ? "text-amber-200" : "text-emerald-300"}>[{entry.level}]</span>{" "}<span className="text-[#C6A971]">[{entry.label}]</span>{" "}<span className="text-white/80">{entry.message}</span></p>)}
                <div ref={bottom} />
            </div>
            <form onSubmit={submit} className="flex items-center gap-3 border-t border-white/10 px-4 py-3"><span className="font-mono text-[#C6A971]">&gt;</span><input aria-label="Perintah terminal" autoComplete="off" spellCheck={false} value={input} onChange={event => setInput(event.target.value)} maxLength={32} disabled={busy || !context.coopId} placeholder="status, sync_ntp, relay_on…" className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-40" /><button type="submit" aria-label="Kirim perintah" disabled={busy || !input.trim()} className="rounded-xl bg-[#7B1113] p-2.5 text-[#C6A971] disabled:opacity-40"><Send size={16} /></button></form>
            <p className="border-t border-white/5 px-4 py-2 text-[10px] text-white/35">REST / Socket.IO backend · tidak ada koneksi MQTT langsung dari browser · maksimal 500 log lokal</p>
        </section>
        <aside className="space-y-5">
            <Card title="Quick Commands">
                <div className="space-y-2">{commandButton("status", "Status")}{commandButton("sync_ntp", "Sync NTP")}{commandButton("relay_on", "Relay ON")}{commandButton("relay_off", "Relay OFF")}</div>
                {!context.canAdminIot && <p className="text-xs text-[#888]">Snapshot dapat dibaca sesuai akses. Command administrasi memerlukan Admin atau Owner.</p>}
                {device?.command_capabilities?.sync_ntp?.allowed !== true && <p className="text-xs text-[#888]">{clean(blockedReason("sync_ntp"))}</p>}
                {relay ? <p className="text-xs text-[#888]">{relay.name} · kanal 1<br />Desired: {relay.desired_state ?? "unknown"} · Reported: {relay.reported_state ?? "unknown"} ({relay.reported_status ?? "unknown"})<br />{clean(relayPreflight.data?.reason ?? "Menunggu preflight relay.")}</p> : <p className="text-xs text-[#888]">Hubungkan relay opsional di Kelola Alat untuk memakai ON/OFF.</p>}
                <p className="text-xs leading-relaxed text-[#888]">Status membaca snapshot REST. Dikirim berarti publikasi transport; laporan perangkat belum membuktikan eksekusi fisik.</p>
                {requestId && <button className={`${secondaryClass} w-full`} disabled={busy || lookup.isFetching} onClick={() => { void lookup.refetch(); }}>Baca status permintaan</button>}
                {request && <p className="break-words text-xs text-[#777]">{request.command}: <strong>{labels[request.status] ?? request.status}</strong> · {request.request_id}</p>}
            </Card>
            <section className="space-y-4 rounded-3xl border border-red-200 bg-red-50/60 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-poppins text-lg font-semibold text-red-800"><ShieldAlert size={19} />Danger Zone</h2><div className="space-y-2">{commandButton("reboot", "Reboot", true)}{commandButton("clear_buf", "Clear Buffer", true)}{commandButton("reset_nvs", "Reset NVS", true)}</div><p className="text-xs leading-relaxed text-red-800">Reboot memutus telemetry sementara. {dataProtection}. Firmware v3.1 belum menyediakan inventaris/backup buffer dan rekonsiliasi epoch counter.</p>{device?.command_capabilities?.reboot?.allowed !== true && <p className="text-xs text-red-700">{clean(blockedReason("reboot"))}</p>}</section>
        </aside>
    </div>;
}
