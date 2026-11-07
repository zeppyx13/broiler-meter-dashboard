"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { getToken } from "@/lib/auth";
import { acceptanceCommands, type AcceptanceCommand, type AcceptanceInput, type AcceptanceResult, type HardwareAcceptance, type MaintenanceDevice, type MaintenanceStatus } from "@/types/maintenance";
import { useBroiler } from "../broiler-provider";
import { InputField, buttonClass, controlClass, dateTime, secondaryClass } from "./shared";

type Props = {
    device?: MaintenanceDevice;
    snapshot?: MaintenanceStatus;
    loading: boolean;
    error: unknown;
    refreshStatus: () => Promise<MaintenanceStatus>;
};
type Draft = {
    command: AcceptanceCommand;
    accepted: boolean;
    baseline: string;
    evidence: string;
    note: string;
    confirmation: string;
    checks: boolean[];
    revokeAcknowledged: boolean;
};
type Outcome = { kind: "recorded" | "ambiguous" | "rejected"; message: string; requestId: string };
const checklist = [
    "Saya mencocokkan UID, kandang, topic/binding dan versi firmware yang terpasang dengan registry.",
    "Operator telah memeriksa konfigurasi MQTT binding dan token privat di server; saya tidak memasukkan token ke form ini.",
    "Saya memahami firmware v3.1 tidak memberi ACK dengan ID korelasi; published tidak membuktikan eksekusi fisik.",
    "Saya telah memeriksa keamanan beban dan lingkungan untuk command yang dipilih.",
    "Saya telah meninjau perangkat serta heartbeat, dan memiliki bukti pemeriksaan yang faktual.",
];

function acceptanceSignature(value: HardwareAcceptance | null | undefined) {
    return JSON.stringify(value ? [value.accepted, value.binding_matches, value.actor_id, value.recorded_at, value.evidence_reference] : value ?? null);
}
function sameTarget(left: MaintenanceDevice, right: MaintenanceDevice) {
    return left.id === right.id && left.coop_id === right.coop_id && left.device_uid === right.device_uid && left.name === right.name && left.device_type === right.device_type && left.firmware_version === right.firmware_version;
}
function acceptanceLabel(value: HardwareAcceptance | null | undefined, available: boolean) {
    if (!available || value === undefined) return "Unavailable · data persetujuan belum tersedia";
    if (value === null) return "Belum ada persetujuan";
    if (value.binding_matches === false) return "Invalid/stale binding · persetujuan lama tidak berlaku";
    if (value.binding_matches !== true) return "Unavailable · kecocokan binding belum diketahui";
    return value.accepted === true ? "Persetujuan tercatat" : value.accepted === false ? "Persetujuan dicabut (revoked)" : "Unavailable · status event belum diketahui";
}
function mutationError(cause: unknown) {
    const code = isAxiosError(cause) ? cause.response?.status : undefined;
    const descriptions: Record<number, string> = {
        400: "Input atau frasa konfirmasi tidak valid.",
        401: "Sesi berakhir; masuk kembali sebelum tindakan baru.",
        403: "Server menolak hak Owner/Admin untuk target ini.",
        404: "Perangkat atau kandang tidak tersedia dalam akses Anda.",
        409: "Target, binding, persyaratan, atau UUID berkonflik; tinjau snapshot terbaru.",
        429: "Batas permintaan tercapai; tunggu sebelum tindakan baru.",
        503: "Database/schema atau layanan belum tersedia; hasil perubahan perlu diperiksa.",
    };
    return { ambiguous: !code || code >= 500, message: `${code ? `HTTP ${code}: ` : ""}${code ? descriptions[code] ?? "Permintaan ditolak server." : "Respons jaringan tidak tersedia."} ${apiErrorMessage(cause)}` };
}

export function HardwareAcceptancePanel(props: Props) {
    const { device, loading, error } = props;
    return <details>
        <summary className="cursor-pointer text-sm text-[#7B1113]">Persetujuan perangkat (hardware acceptance)</summary>
        <div className="mt-3 space-y-3 text-xs text-[#777]">
            <p>Persetujuan mencatat izin untuk permintaan berikutnya. Menyimpan atau mencabut persetujuan tidak mengirim command perangkat. Kesiapan command tetap ditentukan preflight server.</p>
            {loading && <p role="status">Memuat identitas dan persetujuan dari server…</p>}
            {error ? <p role="alert" className="text-red-700">Snapshot persetujuan belum tersedia: {apiErrorMessage(error)}. Muat ulang snapshot; perubahan persetujuan dinonaktifkan.</p> : null}
            {device ? <AcceptanceTarget key={`${device.coop_id}:${device.id}:${device.device_uid}:${device.name}:${device.device_type}:${device.firmware_version}`} {...props} device={device} /> : !loading && !error ? <p>Pilih kandang dan perangkat terdaftar untuk melihat persetujuan hardware.</p> : null}
        </div>
    </details>;
}

function AcceptanceTarget({ device, snapshot, loading, error: snapshotError, refreshStatus }: Props & { device: MaintenanceDevice }) {
    const context = useBroiler();
    const mounted = useRef(true);
    const inFlight = useRef(false);
    const dialogOpen = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const currentScope = snapshot?.coop_id === context.coopId && snapshot?.source === context.source && device.coop_id === context.coopId;
    const available = Boolean(currentScope && snapshot && !snapshotError && !loading && snapshot.capabilities.schema_ready === true);
    const canManage = available && context.source === "real" && snapshot?.capabilities.acceptance_manage === true;
    const phrase = draft ? `ACCEPT ${draft.command} ${device.device_uid}` : "";
    const validDraft = Boolean(draft && draft.evidence.trim().length >= 8 && draft.evidence.trim().length <= 255 && draft.note.trim().length >= 16 && draft.note.trim().length <= 1000 && (draft.accepted ? draft.confirmation === phrase && draft.checks.every(Boolean) : draft.revokeAcknowledged));

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controller.current?.abort();
            if (dialogOpen.current) Swal.close();
        };
    }, []);

    function begin(command: AcceptanceCommand, accepted: boolean) {
        const capability = device.command_capabilities?.[command];
        if (!canManage || !capability || capability.acceptance === undefined || inFlight.current || busy) return;
        if (!accepted && !(capability.acceptance?.accepted === true && capability.acceptance.binding_matches === true)) return;
        setError(null);
        setDraft({ command, accepted, baseline: acceptanceSignature(capability.acceptance), evidence: "", note: "", confirmation: "", checks: checklist.map(() => false), revokeAcknowledged: false });
    }

    async function readSnapshot() {
        if (inFlight.current || reading) return;
        const token = getToken();
        setReading(true); setError(null);
        try { await refreshStatus(); }
        catch (cause) { if (mounted.current && getToken() === token) setError(`Status terkini belum tersedia: ${apiErrorMessage(cause)}`); }
        finally { if (mounted.current && getToken() === token) setReading(false); }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft || !canManage || !validDraft || inFlight.current) return;
        const action = draft;
        const token = getToken();
        const stillCurrent = () => mounted.current && getToken() === token;
        inFlight.current = true; setBusy(true); setError(null);
        try {
            dialogOpen.current = true;
            const confirmation = await Swal.fire({
                title: action.accepted ? "Catat persetujuan perangkat?" : "Cabut persetujuan perangkat?",
                text: `Kandang ${context.coop?.name ?? context.coopId} · ${device.name} · UID ${device.device_uid} · command ${action.command}. ${action.accepted ? "Ini hanya mencatat persetujuan berdasarkan pemeriksaan Anda, tanpa mengirim command MQTT. Kesiapan tetap diperiksa server." : "Pencabutan memblokir permintaan masa depan. Command yang telah dipublikasikan tidak dibatalkan; histori tetap disimpan."}${outcome?.kind === "ambiguous" ? " Hasil tindakan sebelumnya belum dapat dipastikan. Ini tindakan baru dengan UUID baru, bukan pengiriman ulang otomatis." : ""}`,
                icon: "warning", showCancelButton: true, confirmButtonText: outcome?.kind === "ambiguous" ? "Konfirmasi tindakan baru" : action.accepted ? "Catat persetujuan" : "Cabut persetujuan", cancelButtonText: "Batal", confirmButtonColor: "#7B1113",
            });
            dialogOpen.current = false;
            if (!confirmation.isConfirmed || !stillCurrent()) return;
            const latest = await refreshStatus();
            if (!stillCurrent()) return;
            const target = latest.devices.find(item => item.id === device.id);
            const capability = target?.command_capabilities?.[action.command];
            // Grant must not depend on command.allowed: missing acceptance itself makes it false.
            if (latest.coop_id !== context.coopId || latest.source !== "real" || latest.capabilities.acceptance_manage !== true || latest.capabilities.schema_ready !== true || !target || !sameTarget(device, target) || !capability || capability.acceptance === undefined) {
                setError("Target atau kewenangan server berubah. Muat ulang snapshot dan mulai konfirmasi baru; tidak ada perubahan dikirim.");
                setDraft(null); return;
            }
            if (acceptanceSignature(capability.acceptance) !== action.baseline || !action.accepted && !(capability.acceptance?.accepted === true && capability.acceptance.binding_matches === true)) {
                setError("Persetujuan target berubah selama konfirmasi. Tinjau catatan terbaru dan mulai tindakan baru; tidak ada perubahan dikirim.");
                setDraft(null); return;
            }
            if (!globalThis.crypto?.randomUUID) throw new Error("Browser memerlukan HTTPS dan UUID aman sebelum mencatat persetujuan.");
            const requestId = crypto.randomUUID();
            const body: AcceptanceInput = {
                device_id: target.id, command: action.command, accepted: action.accepted, request_id: requestId,
                evidence_reference: action.evidence.trim(), note: action.note.trim(),
                ...(action.accepted ? { confirmation: action.confirmation } : {}),
            };
            controller.current = new AbortController();
            // This is the only mutation. Never retry PUT or chain a POST maintenance command.
            try {
                const response = await api.put<{ success: boolean; message?: string; data?: AcceptanceResult }>(`/api/coops/${context.coopId}/maintenance/acceptance`, body, { signal: controller.current.signal });
                if (!stillCurrent()) return;
                if (response.data.success !== true || !response.data.data?.acceptance || typeof response.data.data.acceptance.accepted !== "boolean" || typeof response.data.data.acceptance.binding_matches !== "boolean") {
                    setOutcome({ kind: "ambiguous", requestId, message: "Status perubahan belum dapat dipastikan: respons server tidak lengkap. Baca snapshot terbaru; tidak ada PUT ulang otomatis." });
                } else {
                    setOutcome({ kind: "recorded", requestId, message: action.accepted ? "Server mengonfirmasi pencatatan persetujuan. Kesiapan command mengikuti snapshot terbaru; tidak ada command dikirim." : "Server mengonfirmasi pencatatan pencabutan persetujuan. Permintaan masa depan mengikuti status terbaru; command yang sudah dipublikasikan tidak dibatalkan." });
                    setDraft(null);
                }
            } catch (cause) {
                if (!stillCurrent()) return;
                const failure = mutationError(cause);
                setOutcome({ kind: failure.ambiguous ? "ambiguous" : "rejected", requestId, message: `${failure.ambiguous ? "Status perubahan belum dapat dipastikan. " : "Perubahan ditolak. "}${failure.message} Tidak ada PUT ulang otomatis.` });
            }
            if (!stillCurrent()) return;
            // Do not turn a lost PUT response into success by matching evidence/date in GET.
            // The API exposes only the latest acceptance, without its request UUID/event ID.
            try { await refreshStatus(); }
            catch (cause) { if (stillCurrent()) setError(`Periksa snapshot terbaru sebelum tindakan berikutnya: ${apiErrorMessage(cause)}`); }
        } catch (cause) {
            if (stillCurrent()) setError(apiErrorMessage(cause));
        } finally {
            inFlight.current = false;
            if (stillCurrent()) setBusy(false);
        }
    }

    return <>
        <p className="break-words"><strong>{device.name}</strong> · UID {device.device_uid} · kandang {context.coop?.name ?? device.coop_id}<br />Jenis {device.device_type} · firmware registry {device.firmware_version ?? "belum tersedia"} (pemasangan fisik perlu diperiksa operator).<br />Heartbeat perangkat: {device.connectivity_status ?? "unknown"} · trusted receipt {dateTime(device.last_seen_at)}. Ini berbeda dari koneksi broker MQTT.<br />Topic/fingerprint binding tidak diekspos endpoint ini; pencocokannya ditentukan server. Token tidak ditampilkan.</p>
        <button type="button" className={secondaryClass} disabled={busy || reading || loading} onClick={() => { void readSnapshot(); }}>{reading ? "Membaca snapshot…" : "Muat ulang persetujuan · REST"}</button>
        {context.source !== "real" && <p>Mode SIM bersifat read-only. Pilih sumber REAL/Sensor untuk mengelola persetujuan perangkat fisik.</p>}
        {snapshot?.capabilities.acceptance_manage !== true && <p>Read-only: hanya Owner farm/Admin yang diizinkan server dapat mencatat atau mencabut persetujuan. Manager, Operator dan Viewer dapat membaca sesuai akses kandang.</p>}
        {snapshot?.capabilities.schema_ready !== true && <p>Unavailable: penyimpanan persetujuan belum tersedia menurut server. Tinjau konfigurasi operator; UI ini tidak menjalankan migrasi.</p>}
        <div className="space-y-3">{acceptanceCommands.map(command => {
            const capability = device.command_capabilities?.[command];
            const acceptance = capability?.acceptance;
            return <div key={command} className="space-y-1">
                <p><strong>{command}</strong> · {acceptanceLabel(acceptance, available)}</p>
                {available && acceptance && <p className="break-words">Catatan terakhir: {dateTime(acceptance.recorded_at)} · actor #{acceptance.actor_id} · referensi {acceptance.evidence_reference}</p>}
                <p>Kesiapan command: {available && capability ? `${capability.allowed ? "siap diminta menurut preflight server" : "belum siap"} · ${capability.reason} · ${capability.explanation}` : "belum tersedia; baca snapshot terbaru"}.</p>
                {canManage && capability && acceptance !== undefined && <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryClass} disabled={busy || reading} onClick={() => begin(command, true)}>Catat persetujuan · {command}</button>
                    {acceptance?.accepted === true && acceptance.binding_matches === true && <button type="button" className={secondaryClass} disabled={busy || reading} onClick={() => begin(command, false)}>Cabut persetujuan · {command}</button>}
                </div>}
            </div>;
        })}</div>
        <div className="space-y-1">{(["clear_buf", "reset_nvs"] as const).map(command => <p key={command}><strong>{command}</strong> · blocked/read-only · {device.command_capabilities?.[command]?.explanation ?? "Membutuhkan prosedur firmware, backup dan rekonsiliasi data yang memadai."} Tidak tersedia tombol grant.</p>)}</div>
        <p>API hanya menyediakan ringkasan acceptance terakhir: actor, waktu dan referensi. Isi note, UUID event, serta histori acceptance lengkap tidak diekspos; tidak ada histori atau reviewer yang dibuat oleh UI.</p>
        {draft && <form onSubmit={event => { void submit(event); }} className="space-y-3">
            <fieldset disabled={busy || reading || !canManage} className="space-y-3">
                <legend className="text-sm font-semibold text-[#555]">{draft.accepted ? "Catat persetujuan" : "Cabut persetujuan"} · {draft.command}</legend>
                <p className="break-words">Target: {device.name} · UID {device.device_uid} · kandang {context.coop?.name ?? device.coop_id} · command {draft.command}. {draft.accepted ? "Hanya mencatat persetujuan; tidak mengirim command perangkat." : "Hanya memblokir permintaan masa depan; tidak membatalkan command yang sudah dipublikasikan."}</p>
                <InputField label="Referensi bukti nyata" hint="8–255 karakter. Jangan masukkan token atau secret."><input autoFocus required minLength={8} maxLength={255} value={draft.evidence} onChange={event => setDraft({ ...draft, evidence: event.target.value })} className={controlClass} /></InputField>
                <InputField label={draft.accepted ? "Catatan pemeriksaan operator" : "Alasan pencabutan"} hint="16–1000 karakter; isi berdasarkan pemeriksaan atau kejadian yang faktual."><textarea required minLength={16} maxLength={1000} rows={3} value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} className={controlClass} /></InputField>
                {draft.accepted ? <>
                    <div className="space-y-2">{checklist.map((text, index) => <label key={text} className="flex items-start gap-2"><input type="checkbox" required checked={draft.checks[index]} onChange={event => setDraft({ ...draft, checks: draft.checks.map((checked, position) => position === index ? event.target.checked : checked) })} className="mt-0.5" /><span>{text}</span></label>)}</div>
                    <InputField label="Frasa konfirmasi target" hint={`Ketik persis: ${phrase}. Frasa tidak diisi otomatis.`}><input required maxLength={255} autoComplete="off" spellCheck={false} value={draft.confirmation} onChange={event => setDraft({ ...draft, confirmation: event.target.value })} className={controlClass} /></InputField>
                </> : <label className="flex items-start gap-2"><input type="checkbox" required checked={draft.revokeAcknowledged} onChange={event => setDraft({ ...draft, revokeAcknowledged: event.target.checked })} className="mt-0.5" /><span>Saya memahami pencabutan hanya memblokir permintaan masa depan dan tidak membatalkan command yang sudah dipublikasikan.</span></label>}
            </fieldset>
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={!canManage || !validDraft || busy || reading} className={buttonClass}>{busy ? "Memproses persetujuan…" : draft.accepted ? "Catat persetujuan" : "Cabut persetujuan"}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className={secondaryClass}>Batal</button></div>
        </form>}
        {busy && <p role="status">Menunggu konfirmasi atau respons server. Jangan ulangi tindakan; tidak ada command perangkat yang dikirim oleh form ini.</p>}
        {outcome && <p role={outcome.kind === "recorded" ? "status" : "alert"} className={`break-words ${outcome.kind === "recorded" ? "text-[#555]" : "text-amber-900"}`}>{outcome.message} UUID tindakan: {outcome.requestId}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
    </>;
}
