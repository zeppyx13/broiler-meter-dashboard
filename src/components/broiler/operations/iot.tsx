"use client";

import { useEffect, useRef, useState } from "react";
import { Power, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Swal from "sweetalert2";
import { useBroiler } from "../broiler-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { getToken } from "@/lib/auth";
import { relayAvailability, type RelayPreflight } from "./safety";
import { DeviceRegistry } from "./device-setup";
import { Card, DataState, StatusMessage, buttonClass, dateTime, saveData, scalar, secondaryClass, useAction, useScopedQuery, yes, type CommandRow, type DeviceRow, type RelayRow } from "./shared";

type LiveSnapshot = { status?: string; source?: string; recorded_at?: string; field_status?: Record<string, string>; metric_recorded_at?: Record<string, string | null>; metric_device_id?: Record<string, number | null>;[key: string]: unknown };
type RegistryDevice = DeviceRow & { coop_id?: number; data_provenance?: string };
type Summary = { state: string; coop?: { id: number } | null; live?: LiveSnapshot; devices: RegistryDevice[]; generated_at?: string; data_status?: string };

export function IotOperations() {
    const context = useBroiler();
    const [tab, setTab] = useState("monitor");
    if (context.loading && !context.coopId) return <Card title="Alat IoT"><p className="text-sm text-[#777]">Memuat kandang dan registry perangkat…</p></Card>;
    if (!context.coopId) return <Card title="Alat IoT"><p className="text-sm text-[#777]">Pilih kandang yang dapat diakses untuk melihat perangkat.</p></Card>;
    return <div className="space-y-5"><div role="tablist" aria-label="Alat IoT" className="flex flex-wrap gap-2">{[["monitor", "Live Monitor"], ["devices", "Kelola Alat"], ["relays", "Relay Manual"]].filter(([key]) => key !== "devices" || context.canAdminIot).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tab === key ? buttonClass : secondaryClass}>{label}</button>)}</div><div key={`${context.user?.id}:${context.farmId}:${context.coopId}:${tab}`} role="tabpanel">{tab === "monitor" ? <LiveMonitor onManage={context.canAdminIot ? () => setTab("devices") : undefined} /> : tab === "devices" ? <DeviceRegistry onNavigate={setTab} /> : <RelayRegistry />}</div></div>;
}

function LiveMonitor({ onManage }: { onManage?: () => void }) {
    const context = useBroiler();
    const summary = useScopedQuery<Summary>("iot-summary", "/api/dashboard/summary", { coop_id: context.coopId }, Boolean(context.coopId), 15_000);
    const scoped = Number(summary.data?.coop?.id) === context.coopId ? summary.data : undefined;
    const live = scoped?.live?.source === "sensor" ? scoped.live : undefined;
    const devices = scoped?.devices.filter(device => device.data_provenance !== "simulation") ?? [];
    const metrics: [string, string, string, number][] = [["flow_rate_lpm", "Debit inlet tandon", "L/menit", 2], ["water_total_liter", "Counter kumulatif air", "L", 3], ["power_w", "Daya panel agregat", "W", 1], ["energy_kwh_total", "Counter kumulatif energi", "kWh", 3], ["voltage_v", "Tegangan", "V", 1], ["current_a", "Arus", "A", 3], ["frequency_hz", "Frekuensi", "Hz", 2], ["power_factor", "Faktor daya", "", 2]];
    return <Card title="Telemetri server" description="YF-S201 mengukur inlet tandon; PZEM mengukur panel agregat. Counter kumulatif bukan konsumsi harian atau siklus.">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#F5EEE4] px-3 py-1 text-xs font-semibold text-[#7B1113]">SENSOR NYATA · {live?.status ?? "no_data"}</span><button onClick={() => { void summary.refetch(); }} className={secondaryClass}><RefreshCw size={14} />Muat ulang</button></div>
        {summary.data?.state === "no_coop" && <StatusMessage error="Kandang belum tersedia dalam cakupan akun. Pilih kandang yang dapat diakses." />}
        {scoped?.state === "no_active_cycle" && <p className="text-sm text-[#777]">Belum ada siklus aktif. Sensor tetap ditampilkan; agregat harian dan siklus menunggu siklus produksi.</p>}
        {summary.data?.coop && !scoped && <StatusMessage error="Respons bukan untuk kandang yang sedang dipilih. Muat ulang data kandang." />}
        <DataState loading={summary.isLoading} error={summary.error}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([field, title, unit, digits]) => {
                const ownerId = live?.metric_device_id?.[field];
                const owner = devices.find(device => Number(device.id) === Number(ownerId));
                const attributed = ownerId == null || Boolean(owner && (owner.coop_id == null || Number(owner.coop_id) === context.coopId));
                return <div key={field} className="rounded-2xl border border-[#EAEAEA] p-4"><p className="text-xs text-[#888]">{title}</p><p className="mt-2 font-poppins text-xl font-semibold">{scalar(attributed ? live?.[field] : null, digits)} <span className="text-xs font-normal text-[#999]">{unit}</span></p><p className="mt-1 text-xs text-[#777]">{attributed ? live?.field_status?.[field] ?? live?.status ?? "no_data" : "no_data"}</p><p className="mt-1 text-[11px] text-[#999]">{dateTime(live?.metric_recorded_at?.[field])}{owner && ` · ${owner.name}`}</p></div>;
            })}</div>
            <p className="text-xs text-[#888]">Data: {scoped?.data_status ?? "no_data"} · Pembaruan server: {dateTime(scoped?.generated_at)}. Stale/offline berbeda dari pembacaan nol.</p>
            {devices.length === 0 ? <div className="rounded-2xl border border-dashed border-[#DDD] p-5 text-sm text-[#888]">Belum ada perangkat fisik terkait pada kandang ini. Hubungkan ESP32 beserta meter air dan listrik melalui Kelola Alat.{onManage ? <div className="mt-3"><button className={secondaryClass} onClick={onManage}>Kelola Alat</button></div> : <p className="mt-3">Hubungi Owner atau Admin farm untuk menghubungkan perangkat.</p>}</div> : <div className="grid gap-3 sm:grid-cols-2">{devices.map(device => <div key={device.id} className="rounded-2xl bg-[#FAFAFA] p-4"><p className="flex items-center gap-2 font-semibold">{device.connectivity_status === "online" ? <Wifi size={16} className="text-green-600" /> : <WifiOff size={16} className="text-[#888]" />}{device.name}</p><p className="mt-1 text-xs text-[#777]">{device.connectivity_status ?? "unknown"} · {device.device_uid}</p><p className="mt-1 text-xs text-[#888]">Receipt terakhir: {dateTime(device.last_seen_at)}</p></div>)}</div>}
        </DataState>
    </Card>;
}
function RelayRegistry() {
    const context = useBroiler();
    const [page, setPage] = useState(1);
    const devices = useScopedQuery<{ devices: RegistryDevice[] }>("relay-devices", "/api/devices", { coop_id: context.coopId, limit: 100 }, true, 15_000);
    const relays = useScopedQuery<{ relays: RelayRow[] }>("relays", "/api/relays", { coop_id: context.coopId, page, limit: 20 }, true, 15_000);
    const rows = relays.data?.relays.filter(relay => relay.channel === 1 && devices.data?.devices.some(device => device.id === relay.device_id && device.data_provenance !== "simulation")) ?? [];
    return <Card title="Relay manual dan histori audit" description="Firmware v3.1 menyediakan satu output per perangkat. Requested/published adalah status pengiriman; reported state belum membuktikan beban fisik menyala."><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Kontrol manual mengikuti izin kandang dari Owner. Perintah tidak diulang otomatis. Atur mapping opsional melalui kartu alat di Kelola Alat.</p><DataState loading={relays.isLoading || devices.isLoading} error={relays.error || devices.error} empty={rows.length === 0}><div className="space-y-4">{rows.map(relay => <RelayControl key={relay.id} relay={relay} device={devices.data?.devices.find(device => device.id === relay.device_id)} />)}</div></DataState><Pager page={page} setPage={setPage} hasNext={(relays.data?.relays.length ?? 0) === 20} /></Card>;
}
function RelayControl({ relay, device }: { relay: RelayRow; device?: DeviceRow }) {
    const context = useBroiler(); const action = useAction();
    const mounted = useRef(true);
    const confirming = useRef(false);
    const dialogVisible = useRef(false);
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (dialogVisible.current) Swal.close(); }; }, []);
    const commands = useScopedQuery<{ commands: CommandRow[] }>(`relay-commands-${relay.id}`, `/api/relays/${relay.id}/commands`, { page: 1, limit: 20 }, true, 10_000);
    const preflight = useScopedQuery<RelayPreflight>(`relay-preflight-${relay.id}`, `/api/relays/${relay.id}/preflight`, undefined, context.canRelay, 10_000);
    const availability = relayAvailability({ allowed: context.canRelay, source: "real", relay, device, command: commands.data?.commands[0], preflight: preflight.data });
    const commandDisabled = !availability.allowed || !preflight.data || preflight.isError || action.busy || confirmationOpen;
    async function send(command: "on" | "off") {
        if (commandDisabled || confirming.current) return;
        const sessionToken = getToken();
        if (!sessionToken) return;
        confirming.current = true; setConfirmationOpen(true);
        try {
            dialogVisible.current = true;
            const confirmed = await Swal.fire({ title: `Kirim permintaan ${command.toUpperCase()}?`, text: `Kandang ${context.coop?.name ?? context.coopId} · ${relay.name} · ${relay.purpose ?? "peralatan terhubung"}. Beban yang terhubung dapat berubah. Publikasi tidak membuktikan hasil fisik.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, Jalankan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
            dialogVisible.current = false;
            if (!confirmed.isConfirmed || !mounted.current || getToken() !== sessionToken) return;
            const latest = await preflight.refetch();
            if (!mounted.current || getToken() !== sessionToken) return;
            if (latest.isError || !latest.data?.allowed) {
                action.setError(latest.error ? apiErrorMessage(latest.error) : latest.data?.reason ?? "Preflight server belum tersedia. Muat ulang sebelum mengirim perintah.");
                return;
            }
            await action.run(async () => {
                const result = await saveData("post", `/api/relays/${relay.id}/commands`, { command }) as { command?: CommandRow };
                if (result.command?.status === "failed") throw new Error(`Permintaan tercatat tetapi pengiriman gagal: ${result.command.failure_reason ?? "baca histori server"}.`);
                if (result.command?.status === "timed_out") throw new Error("Permintaan timeout. Aktuasi fisik belum dapat dipastikan; baca histori dan preflight sebelum tindakan berikutnya.");
            }, "Permintaan tercatat. Periksa status publikasi dan observasi perangkat; hasil fisik belum dikonfirmasi.");
        } finally {
            confirming.current = false;
            dialogVisible.current = false;
            if (mounted.current) setConfirmationOpen(false);
        }
    }
    return <article className="space-y-3 rounded-2xl border border-[#EAEAEA] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{relay.name} · kanal {relay.channel}</h3><p className="mt-1 text-xs text-[#888]">{device?.name ?? `Device #${relay.device_id}`} · {yes(relay.is_enabled) ? "Mapping enabled" : "Mapping disabled"}</p></div><span className="rounded-full bg-[#F5EEE4] px-3 py-1 text-xs text-[#7B1113]">Hasil fisik belum terverifikasi</span></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[#888]">Desired state</dt><dd>{relay.desired_state ?? "unknown"}</dd></div><div><dt className="text-xs text-[#888]">Reported state / kualitas</dt><dd>{relay.reported_state ?? "unknown"} · {relay.reported_status ?? "unknown"}</dd></div><div className="col-span-2 text-xs text-[#888]">Laporan perangkat: {dateTime(relay.last_reported_at)}. Laporan state bukan ACK permintaan.</div></dl><p className="text-xs leading-relaxed text-[#777]">{availability.reason}</p>{context.canRelay && <div className="flex flex-wrap gap-2"><button disabled={commandDisabled} onClick={() => { void send("on"); }} className={buttonClass}><Power size={14} />Minta ON</button><button disabled={commandDisabled} onClick={() => { void send("off"); }} className={secondaryClass}><Power size={14} />Minta OFF</button></div>}<StatusMessage error={action.error ?? (preflight.error ? apiErrorMessage(preflight.error) : null)} success={action.success} /><details><summary className="cursor-pointer text-sm text-[#7B1113]">Histori perintah (20 terbaru)</summary><DataState loading={commands.isLoading} error={commands.error} empty={commands.data?.commands.length === 0}><ul className="mt-3 space-y-2 text-xs">{commands.data?.commands.map((command) => <li key={command.id} className="rounded-xl bg-[#FAFAFA] p-3">#{command.id} · {command.command} · <strong>{command.status}</strong> · {dateTime(command.requested_at)}{command.pending && command.timeout_at && <p className="mt-1 text-[#777]">Batas tunggu server: {dateTime(command.timeout_at)}. Belum ada ACK terkorelasi; perlu verifikasi fisik.</p>}{command.status === "timed_out" && <p className="mt-1 text-amber-800">Timeout tidak memastikan aktuasi gagal. Tombol pulih setelah preflight server mengizinkan.</p>}{command.failure_reason && <p className="mt-1 text-red-700">{command.failure_reason}</p>}</li>)}</ul></DataState></details></article>;
}

export function Pager({ page, setPage, hasNext }: { page: number; setPage: (page: number) => void; hasNext: boolean }) {
    return <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-3 text-xs text-[#888]"><span>Halaman {page}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className={secondaryClass}>Sebelumnya</button><button disabled={!hasNext} onClick={() => setPage(page + 1)} className={secondaryClass}>Berikutnya</button></div></nav>;
}
