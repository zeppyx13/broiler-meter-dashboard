"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Download, RefreshCw, ShieldAlert } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { getToken } from "@/lib/auth";
import { maintenanceCommands, type MaintenanceCommand, type MaintenanceDevice, type MaintenanceRequest, type MaintenanceResult, type MaintenanceStatus } from "@/types/maintenance";
import { useBroiler } from "../broiler-provider";
import { Card, DataState, controlClass, dateTime, secondaryClass, useScopedQuery } from "./shared";

type Diagnostic = { id: number; device_id?: number | null; level: string; code: string; message: string; source: string; recorded_at?: string | null; received_at?: string | null };
type DiagnosticsResponse = { entries: Diagnostic[] };
type Phase = "idle" | "confirming" | "submitting" | "blocked" | "failed";
const pendingStatuses = ["accepted", "publishing", "published", "observed"];
const warnings: Record<MaintenanceCommand, string> = {
    status: "Meminta status aktif melalui MQTT. Ini berbeda dari snapshot REST. Laporan firmware tidak memiliki ID korelasi permintaan.",
    sync_ntp: "Meminta sinkronisasi NTP. Waktu perangkat dapat berubah dan proses dapat berlangsung beberapa detik. Publikasi belum membuktikan sinkronisasi berhasil.",
    reboot: "Perangkat akan dimulai ulang dan koneksi serta telemetry terputus sementara. Perintah tidak diulang otomatis. Pastikan operasi kandang aman selama perangkat terputus.",
    clear_buf: "Seluruh data offline yang belum terkirim dapat hilang. Diperlukan inventaris buffer, backup yang terverifikasi, dan persetujuan kehilangan data. Firmware v3.1 belum menyediakan kontrak tersebut.",
    reset_nvs: "Counter air dan energi serta baseline dapat berubah. Diperlukan snapshot counter terpercaya, backup, counter epoch, dan prosedur rekonsiliasi histori. Firmware v3.1 belum menyediakan kontrak tersebut.",
};

export function TerminalOperations() {
    const context = useBroiler();
    // A scope switch destroys local confirmations and pending presentation immediately.
    return <TerminalScope key={`${context.user?.id ?? "none"}:${context.coopId ?? "none"}:${context.source}`} />;
}

function TerminalScope() {
    const context = useBroiler();
    const [level, setLevel] = useState("all");
    const [selectedDevice, setSelectedDevice] = useState<number>();
    const diagnostics = useScopedQuery<DiagnosticsResponse>("diagnostics", `/api/coops/${context.coopId}/diagnostics`, { limit: 100 }, Boolean(context.coopId), 10_000);
    const status = useScopedQuery<MaintenanceStatus>("maintenance-status", `/api/coops/${context.coopId}/maintenance/status`, { source: context.source }, Boolean(context.coopId), 10_000);
    const capabilities = status.data?.capabilities;
    const entries = (diagnostics.data?.entries ?? []).filter(entry => level === "all" || entry.level === level);
    const device = status.data?.devices.find(item => item.id === selectedDevice) ?? status.data?.devices[0];
    function exportLog() {
        const text = entries.map(entry => `${entry.received_at ?? entry.recorded_at ?? "unknown"}\t${entry.level}\t${entry.source}\t${entry.code}\t${entry.message}`).join("\n");
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `coasther-diagnostics-coop-${context.coopId}.txt`; anchor.click(); URL.revokeObjectURL(url);
    }
    return <div className="space-y-5">
        <Card title="IoT Terminal · diagnostik server" description="Log tersanitasi dan terbatas pada kandang yang diotorisasi. Koneksi browser ke Socket.IO tidak membuktikan broker MQTT atau perangkat fisik online.">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">{["all", "info", "warning", "error"].map(value => <button key={value} aria-pressed={level === value} onClick={() => setLevel(value)} className={`${secondaryClass} ${level === value ? "border-[#7B1113] text-[#7B1113]" : ""}`}>{value.toUpperCase()}</button>)}</div>
                <div className="flex gap-2">
                    <button disabled={!context.coopId} onClick={() => { void diagnostics.refetch(); void status.refetch(); }} className={secondaryClass}><RefreshCw size={14} />Refresh</button>
                    <button disabled={entries.length === 0} onClick={exportLog} className={secondaryClass}><Download size={14} />Ekspor log aman</button>
                </div>
            </div>
            {!context.coopId ? <p className="text-sm text-[#888]">Pilih kandang terlebih dahulu.</p> : <DataState loading={diagnostics.isLoading} error={diagnostics.error} empty={entries.length === 0}>
                <div role="log" aria-label="Diagnostik kandang" aria-live="polite" className="max-h-[60vh] space-y-2 overflow-auto rounded-2xl bg-[#181818] p-4 font-mono text-xs leading-relaxed">
                    {entries.map(entry => <article key={entry.id} className={entry.level === "error" ? "text-red-300" : entry.level === "warning" ? "text-amber-200" : "text-emerald-200"}>
                        <p><span className="text-white/45">{dateTime(entry.received_at ?? entry.recorded_at)}</span> [{entry.level.toUpperCase()}] {entry.code}</p>
                        <p className="break-words text-white/80">{entry.message}</p>
                        <p className="text-[10px] text-white/40">source={entry.source} · device={entry.device_id ?? "—"}</p>
                    </article>)}
                </div>
            </DataState>}
            <p className="text-xs text-[#999]">Sumber REAL/SIM untuk analitik tidak mengubah provenance log perangkat. Tidak ada subscription topic MQTT langsung atau token broker di browser.</p>
        </Card>
        <Card title="Maintenance terkontrol" description="Snapshot REST bersifat pasif. Aksi MQTT membutuhkan capability dan acceptance per perangkat dari server, konfirmasi operator, serta audit.">
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <span>{status.error ? apiErrorMessage(status.error) : capabilities ? "Kesiapan diperiksa per perangkat dan command oleh server." : "Capability server belum tersedia; pengiriman diblokir."}
                    <span className="mt-1 block text-xs">GET snapshot tidak mengirim MQTT. Published bukan konfirmasi eksekusi. Observasi tanpa ID korelasi tidak membuktikan hasil permintaan tertentu.
                        {status.data && <> Snapshot {dateTime(status.data.generated_at)}: {status.data.devices.map(item => `${item.name}: ${item.connectivity_status ?? "unknown"}`).join("; ") || "belum ada perangkat"}. {status.data.relays.map(relay => `${relay.name}: reported=${relay.reported_state ?? "unknown"} (${relay.reported_status ?? "unknown"}), physical_state_confirmed=${String(relay.physical_state_confirmed === true)}`).join("; ")}</>}
                    </span>
                </span>
            </p>
            <div className="flex flex-wrap items-end gap-3">
                <button disabled={!context.coopId || status.isFetching || status.isError || capabilities?.status_read !== true} onClick={() => { void status.refetch(); }} className={secondaryClass}>status · snapshot REST</button>
                <label className="text-xs text-[#777]">Target perangkat
                    <select aria-label="Target perangkat maintenance" value={device?.id ?? ""} onChange={event => setSelectedDevice(Number(event.target.value))} disabled={!status.data?.devices.length} className={controlClass}>
                        {!status.data?.devices.length && <option value="">Belum ada perangkat</option>}
                        {status.data?.devices.map(item => <option key={item.id} value={item.id}>{item.name} · {item.device_uid}</option>)}
                    </select>
                </label>
            </div>
            {device ? <DeviceMaintenance key={`${device.id}:${device.device_uid}:${device.firmware_version}:${device.mqtt_topic_key}`} device={device} available={!status.isError && Boolean(capabilities)} refreshStatus={async () => {
                const latest = await status.refetch();
                if (latest.isError || !latest.data) throw latest.error ?? new Error("Preflight server tidak tersedia.");
                return latest.data;
            }} recentRequests={status.data?.recent_requests?.filter(request => request.device_id === device.id) ?? []} /> : <p className="text-xs text-[#777]">Daftarkan perangkat dan binding kandang melalui Alat IoT sebelum meminta maintenance.</p>}
            <p className="text-xs text-[#999]">Kontrol relay manual tersedia di Alat IoT → Relay Manual. Pemilik berwenang mencatat atau mencabut acceptance per perangkat dan command melalui API resmi berdasarkan bukti penerimaan hardware.</p>
        </Card>
    </div>;
}

function DeviceMaintenance({ device, available, refreshStatus, recentRequests }: { device: MaintenanceDevice; available: boolean; refreshStatus: () => Promise<MaintenanceStatus>; recentRequests: MaintenanceRequest[] }) {
    const context = useBroiler();
    const mounted = useRef(true);
    const inFlight = useRef(false);
    const dialogOpen = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const [phase, setPhase] = useState<Phase>("idle");
    const [error, setError] = useState<string | null>(null);
    const [requestId, setRequestId] = useState<string>();
    const [submitted, setSubmitted] = useState<MaintenanceResult>();
    const [polling, setPolling] = useState(false);
    const lookup = useScopedQuery<MaintenanceResult>(`maintenance-request-${requestId}`, `/api/coops/${context.coopId}/maintenance/requests/${requestId}`, undefined, Boolean(requestId) && phase !== "submitting", polling ? 3_000 : undefined);
    const request = lookup.data?.request ?? submitted?.request;
    const busy = phase === "confirming" || phase === "submitting";

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controller.current?.abort();
            if (dialogOpen.current) Swal.close();
        };
    }, []);
    useEffect(() => {
        if (lookup.data?.request && !pendingStatuses.includes(lookup.data.request.status)) setPolling(false);
        if (isAxiosError(lookup.error) && [400, 401, 403].includes(lookup.error.response?.status ?? 0)) setPolling(false);
    }, [lookup.data, lookup.error]);

    async function send(command: MaintenanceCommand) {
        const capability = device.command_capabilities?.[command];
        if (inFlight.current || !available || capability?.allowed !== true) return;
        inFlight.current = true;
        const sessionToken = getToken();
        const stillCurrent = () => mounted.current && getToken() === sessionToken;
        setPhase("confirming"); setError(null);
        try {
            dialogOpen.current = true;
            const confirmation = await Swal.fire<string>({
                title: `Kirim ${command}?`,
                text: `Kandang ${context.coop?.name ?? context.coopId} · ${device.name} · UID ${device.device_uid}. ${warnings[command]} Isi alasan tindakan (8–500 karakter).`,
                icon: "warning", input: "textarea", inputAttributes: { maxlength: "500", "aria-label": "Alasan maintenance" },
                inputValidator: value => value.trim().length < 8 ? "Isi alasan minimal 8 karakter." : undefined,
                showCancelButton: true, confirmButtonText: "Saya memahami risiko; lanjutkan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113",
            });
            dialogOpen.current = false;
            if (!confirmation.isConfirmed || !stillCurrent()) return;
            let typedConfirmation: string | undefined;
            if (capability.confirmation_phrase) {
                dialogOpen.current = true;
                const typed = await Swal.fire<string>({
                    title: `Konfirmasi target ${device.name}`,
                    text: `UID ${device.device_uid}. Ketik persis: ${capability.confirmation_phrase}. ${warnings[command]}`,
                    icon: "warning", input: "text", inputAttributes: { autocomplete: "off", "aria-label": "Frasa konfirmasi target" },
                    inputValidator: value => value !== capability.confirmation_phrase ? "Frasa harus cocok dengan identitas target." : undefined,
                    showCancelButton: true, confirmButtonText: "Konfirmasi tindakan manual", cancelButtonText: "Batal", confirmButtonColor: "#7B1113",
                });
                dialogOpen.current = false;
                if (!typed.isConfirmed || !stillCurrent()) return;
                typedConfirmation = typed.value;
            }
            const latest = await refreshStatus();
            if (!stillCurrent()) return;
            const target = latest.devices.find(item => item.id === device.id && item.device_uid === device.device_uid);
            const preflight = target?.command_capabilities?.[command];
            if (!target || preflight?.allowed !== true || preflight.confirmation_phrase !== capability.confirmation_phrase) {
                setPhase("blocked");
                setError(preflight?.explanation ?? preflight?.reason ?? "Target atau capability berubah. Baca kondisi server dan lakukan konfirmasi baru.");
                return;
            }
            if (!globalThis.crypto?.randomUUID) throw new Error("Browser memerlukan HTTPS dan UUID aman sebelum pengiriman.");
            const id = crypto.randomUUID();
            setRequestId(id); setSubmitted(undefined); setPolling(false); setPhase("submitting");
            controller.current = new AbortController();
            // Exactly one POST. A lost response is recovered only by GET with this UUID.
            try {
                const response = await api.post<{ success: boolean; message?: string; data: MaintenanceResult }>(`/api/coops/${context.coopId}/maintenance`, {
                    device_id: device.id, command, request_id: id, source: context.source,
                    confirmation: "MAINTENANCE ACCEPTED", reason: confirmation.value?.trim(),
                    ...(typedConfirmation ? { typed_confirmation: typedConfirmation } : {}),
                }, { signal: controller.current.signal });
                if (!stillCurrent()) return;
                if (!response.data.success || !response.data.data?.request) throw new Error(response.data.message ?? "Respons tidak lengkap; status pengiriman belum diketahui.");
                setSubmitted(response.data.data); setPolling(pendingStatuses.includes(response.data.data.request.status)); setPhase("idle");
            } catch (cause) {
                if (!stillCurrent()) return;
                const code = isAxiosError(cause) ? cause.response?.status : undefined;
                const result = isAxiosError<{ errors?: MaintenanceResult }>(cause) ? cause.response?.data.errors : undefined;
                if (result?.request) setSubmitted(result);
                setPhase([400, 401, 403, 409, 429, 503].includes(code ?? 0) ? "blocked" : "failed");
                setError(`${code ? `HTTP ${code}: ` : ""}${apiErrorMessage(cause)}${!code ? " Hasil pengiriman belum diketahui. UUID dipertahankan; hanya pembacaan status yang diulang, tanpa POST ulang." : " Periksa alasan server dan status audit sebelum tindakan baru."}`);
                setPolling(!code || code >= 500 || Boolean(result?.request && pendingStatuses.includes(result.request.status)));
            } finally {
                if (stillCurrent()) void refreshStatus().catch(() => { });
            }
        } catch (cause) {
            if (stillCurrent()) { setPhase("failed"); setError(apiErrorMessage(cause)); }
        } finally {
            inFlight.current = false;
            if (stillCurrent()) setPhase(current => current === "confirming" || current === "submitting" ? "idle" : current);
        }
    }

    return <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {maintenanceCommands.map(command => {
                const capability = device.command_capabilities?.[command];
                const allowed = available && capability?.allowed === true;
                return <button key={command} disabled={!allowed || busy} onClick={() => { void send(command); }} className={`${secondaryClass}${allowed ? "" : " cursor-not-allowed"}`} title={capability?.explanation ?? "Capability server belum tersedia."}>{command} · {allowed ? "MQTT" : "terkunci"}</button>;
            })}
        </div>
        <div className="space-y-2 text-xs text-[#777]">{maintenanceCommands.map(command => {
            const capability = device.command_capabilities?.[command];
            return <p key={command}><strong>{command}</strong>: {capability ? `${capability.reason} · ${capability.explanation}` : "Capability server belum tersedia; pengiriman diblokir."}{Boolean(capability?.prerequisites.length) && <span className="block">Prasyarat: {capability?.prerequisites.join("; ")}</span>}</p>;
        })}</div>
        <div role="status" aria-live="polite" className="space-y-2 text-xs text-[#777]">
            <p>Status permintaan: <strong>{busy || phase === "blocked" && !request ? phase : request?.status ?? phase}</strong>{requestId && <> · UUID {requestId}</>}</p>
            {requestId && <button className={secondaryClass} disabled={busy || lookup.isFetching} onClick={() => { void lookup.refetch(); }}>Baca status UUID · REST</button>}
            {request && <RequestStatus request={request} />}
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {lookup.error && <p className="text-amber-900">Pembacaan audit: {apiErrorMessage(lookup.error)}. Pengiriman tidak diulang. Pilih Baca status UUID · REST untuk membaca status terbaru.</p>}
            <p>Socket reconnect hanya memuat ulang data. Permintaan tidak dikirim ulang. Berpindah sumber, kandang, akun, atau target menghapus tampilan konfirmasi lokal; permintaan yang sudah diterima server tetap tercatat.</p>
        </div>
        <details><summary className="cursor-pointer text-sm text-[#7B1113]">Histori maintenance perangkat (terbaru)</summary>
            <ul className="mt-3 space-y-2 text-xs">{recentRequests.map(item => <li key={item.request_id} className="rounded-xl bg-[#FAFAFA] p-3"><RequestStatus request={item} /></li>)}</ul>
            {recentRequests.length === 0 && <p className="mt-2 text-xs text-[#888]">Belum ada permintaan yang terlihat pada scope ini.</p>}
        </details>
    </>;
}

function RequestStatus({ request }: { request: MaintenanceRequest }) {
    return <div className="space-y-1 break-words">
        <p>{request.command} · <strong>{request.status}</strong> · {request.request_id} · {dateTime(request.requested_at)}</p>
        {request.published_at && <p>Published {dateTime(request.published_at)}: publikasi transport, belum membuktikan eksekusi perangkat.</p>}
        {request.observation && <p>Observed (uncorrelated): {request.observation.result ?? "laporan umum perangkat"} · receipt {dateTime(request.observation.received_at)}; bukan ACK permintaan ini.</p>}
        {request.timeout_at && <p>Batas observasi server: {dateTime(request.timeout_at)}.</p>}
        {["unverified", "timed_out"].includes(request.status) && <p>Eksekusi belum terverifikasi. Periksa perangkat secara manual; tidak ada pengiriman ulang otomatis.</p>}
        {request.failure_reason && <p className="text-red-700">{request.failure_reason}</p>}
        <p>executed=false · device_acknowledged=false · physical_state_confirmed=false</p>
    </div>;
}
