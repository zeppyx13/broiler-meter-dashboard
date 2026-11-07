"use client";

import { useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { CheckCircle2, CircleDashed, ShieldCheck, XCircle } from "lucide-react";
import { readData, writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { useKandangSnapshots } from "@/lib/kandang-snapshot";
import { formatSeconds } from "@/lib/guard-performance";
import {
    CALIBRATION_LIMIT_PCT, CALIBRATION_UNIT, MIN_REPEATS, errorPct, summarizeCalibrations,
    type CalibrationEntry, type CalibrationType,
} from "@/lib/calibration";

const num = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const UPTIME_TARGET = 98;

type Status = "lulus" | "belum" | "kurang-data";

type ServerCalibration = {
    id: number; coop_id: number; type: "water" | "electricity"; reference_value: number; sensor_value: number;
    measured_at: string; note?: string | null; verification_state: string; instrument_id: string; recorded_by: number; source: string;
};
type ValidationReport = {
    telemetry_reliability?: { state: string; received_pct?: number | null; reason?: string; observations?: { evidence_id: number; received_packets: number; expected_packets: number; received_pct: number }[] };
    guard_response?: { state: string; observations?: { evidence_id: number; alert_id: number; response_seconds: number }[] };
    evidence?: { id: number; kind: string; source: string; verification_state: string; recorded_by: number; observed_start: string; observed_end: string; evidence: { reference?: string } }[];
};

const INSTRUMENT: Record<CalibrationType, { id: string; method: string }> = {
    listrik: { id: "Clamp meter", method: "Bandingkan daya PZEM-004T dengan clamp meter pada beban yang sama." },
    air: { id: "Ember takar 10 L", method: "Isi ember takar 10 L dari jalur air lalu bandingkan dengan total YF-S201." },
};

/** Panel validasi mengikuti Tabel 4 proposal: akurasi, keandalan data, respons Guard, uji lapangan. */
export default function ValidationPanel() {
    const { coops } = useBroiler();
    const rooms = useMemo(() => coops.map((c) => ({ id: c.id, number: c.code })).sort((a, b) => a.number.localeCompare(b.number, "id", { numeric: true })), [coops]);
    const roomName = (id: number) => rooms.find((r) => r.id === id)?.number ?? `#${id}`;

    return (
        <section className="rounded-3xl border border-[#EAEAEA] bg-white p-6" aria-label="Validasi alat">
            <div className="space-y-6">
                <AccuracySection rooms={rooms} roomName={roomName} />
                <ReliabilitySection rooms={rooms} />
                <GuardResponseSection rooms={rooms} />
                <FieldTestSection />
            </div>
        </section>
    );
}

// ── 1. Akurasi sensor ──────────────────────────────────────────────────────

function AccuracySection({ rooms, roomName }: { rooms: { id: number; number: string }[]; roomName: (id: number) => string }) {
    const b = useBroiler();
    const calibrationQueries = useQueries({
        queries: rooms.map((r) => ({
            queryKey: ["broiler", b.user?.id, r.id, "calibrations", b.source],
            queryFn: () => readData<{ calibrations: ServerCalibration[] }>(`/api/coops/${r.id}/calibrations`, { source: b.source, limit: 100 }),
        })),
    });
    const calibrationKey = calibrationQueries.map((q) => q.dataUpdatedAt).join(",");
    const entries = useMemo<(CalibrationEntry & { verified: boolean; recordedBy: number })[]>(() => calibrationQueries.flatMap((q) => (q.data?.calibrations ?? []).map((c) => ({
        id: String(c.id),
        roomId: c.coop_id,
        type: c.type === "electricity" ? "listrik" as const : "air" as const,
        reference: Number(c.reference_value),
        sensor: Number(c.sensor_value),
        at: c.measured_at,
        note: c.note ?? undefined,
        verified: c.source === "real" && c.verification_state === "independently_verified",
        recordedBy: c.recorded_by,
    }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calibrationKey]);
    const [saving, setSaving] = useState(false);
    const adding = useRef(false);
    const scope = useRef("");
    scope.current = `${b.user?.id}:${b.source}`;
    const { snapshots } = useKandangSnapshots();
    const [roomId, setRoomId] = useState<number | "">("");
    const [type, setType] = useState<CalibrationType>("listrik");
    const [reference, setReference] = useState("");
    const [sensor, setSensor] = useState("");

    const summaries = useMemo(() => summarizeCalibrations(entries).sort((a, b) => roomName(a.roomId).localeCompare(roomName(b.roomId), "id", { numeric: true }) || a.type.localeCompare(b.type)), [entries, roomName]);
    const verifiedSummaries = summarizeCalibrations(entries.filter((e) => e.verified));
    const status: Status = verifiedSummaries.length === 0 ? "kurang-data" : verifiedSummaries.every((s) => s.passed && s.enoughRepeats) && verifiedSummaries.length === summaries.length ? "lulus" : "belum";
    const selectedRoom = roomId || rooms[0]?.id;
    const live = snapshots.find((x) => x.room.id === selectedRoom && x.online)?.live;

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (adding.current) return;
        const ref = Number(reference);
        const sen = Number(sensor);
        if (!selectedRoom || !reference.trim() || !sensor.trim() || !(ref > 0) || !(sen >= 0)) {
            Swal.fire({ icon: "warning", title: "Lengkapi data uji", text: "Isi nilai alat acuan dan pembacaan COASTHER.", confirmButtonColor: "#7B1113" });
            return;
        }
        adding.current = true;
        const requestedScope = scope.current;
        setSaving(true);
        try {
            const instrument = await Swal.fire({ title: "Alat acuan", text: "Baris 1: ID alat acuan. Baris 2: cara ukur.", input: "textarea", inputPlaceholder: `${INSTRUMENT[type].id} · ID/nomor seri\n${INSTRUMENT[type].method}`, inputValidator: (value) => { const [id, ...method] = value.trim().split("\n"); return id?.trim() && method.join("\n").trim().length >= 8 ? undefined : "Isi identitas instrumen dan metode pada baris terpisah."; }, showCancelButton: true, confirmButtonText: "Simpan uji", cancelButtonText: "Batal", confirmButtonColor: "#7B1113" });
            if (!instrument.isConfirmed || scope.current !== requestedScope) return;
            const [instrumentId, ...method] = String(instrument.value).trim().split("\n");
            await writeData("post", `/api/coops/${selectedRoom}/calibrations`, {
                type: type === "listrik" ? "electricity" : "water",
                reference_value: ref,
                sensor_value: sen,
                unit: type === "listrik" ? "W" : "L",
                instrument_id: instrumentId.trim(),
                method: method.join("\n").trim(),
                measured_at: new Date().toISOString(),
                source: b.source,
                note: null,
            });
            setReference("");
            setSensor("");
            await b.refresh();
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan uji", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            adding.current = false;
            setSaving(false);
        }
    }

    return (
        <Block title="1 · Akurasi sensor"
            target="Listrik ≤ 2%, air ≤ 5%, 3 ulangan"
            status={status}
        >
            {summaries.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] font-inter text-sm">
                        <thead>
                            <tr className="border-b border-[#EAEAEA] text-left text-xs text-[#999]">
                                <th className="py-2 font-medium">Kandang</th>
                                <th className="py-2 font-medium">Sensor</th>
                                <th className="py-2 text-right font-medium">Ulangan</th>
                                <th className="py-2 text-right font-medium">Galat rata-rata</th>
                                <th className="py-2 text-right font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaries.map((s) => (
                                <tr key={`${s.roomId}-${s.type}`} className="border-b border-[#F5F5F5] align-top last:border-0">
                                    <td className="py-2.5 font-medium text-[#2F2F2F]">{roomName(s.roomId)}</td>
                                    <td className="py-2.5 text-[#555]">{s.type === "listrik" ? "Listrik (PZEM-004T)" : "Air (YF-S201)"}</td>
                                    <td className="py-2.5 text-right text-[#555]">{s.entries.length}/{MIN_REPEATS}</td>
                                    <td className="py-2.5 text-right text-[#555]">
                                        {num(s.meanErrorPct)}% <span className="text-xs text-[#999]">/ ≤ {CALIBRATION_LIMIT_PCT[s.type]}%</span>
                                    </td>
                                    <td className="py-2.5 text-right">
                                        {s.passed && s.enoughRepeats && s.entries.filter((entry) => entries.find((item) => item.id === entry.id)?.verified).length >= MIN_REPEATS ? (
                                            <span className="font-medium text-green-700">Lulus</span>
                                        ) : !s.passed ? (
                                            <span className="font-medium text-[#B42318]">Perlu kalibrasi</span>
                                        ) : (
                                            <span className="text-[#B76E00]">Belum lengkap</span>
                                        )}
                                        {!s.passed && (
                                            <p className="mt-0.5 text-[11px] font-normal text-[#777]">
                                                Sensor membaca {s.biasPct > 0 ? "lebih tinggi" : "lebih rendah"} ±{num(Math.abs(s.biasPct))}%.
                                                {s.type === "air" ? " Sesuaikan faktor pulsa YF-S201 di firmware." : " Cek posisi CT di kabel fase."}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <form onSubmit={handleAdd} className="mt-3 grid gap-2 rounded-2xl bg-[#FAFAFA] p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
                <Field label="Kandang">
                    <select value={selectedRoom ?? ""} onChange={(e) => setRoomId(Number(e.target.value))} suppressHydrationWarning className={inputCls}>
                        {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
                    </select>
                </Field>
                <Field label="Sensor">
                    <select value={type} onChange={(e) => setType(e.target.value as CalibrationType)} suppressHydrationWarning className={inputCls}>
                        <option value="listrik">Listrik (W)</option>
                        <option value="air">Air (L)</option>
                    </select>
                </Field>
                <Field label={type === "listrik" ? "Clamp meter (W)" : "Volume ember (L)"}>
                    <input type="number" step="any" min={0} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={type === "listrik" ? "cth. 128" : "10"} suppressHydrationWarning className={inputCls} />
                </Field>
                <Field label={`COASTHER (${CALIBRATION_UNIT[type]})`}>
                    <div className="flex gap-1">
                        <input type="number" step="any" min={0} value={sensor} onChange={(e) => setSensor(e.target.value)} suppressHydrationWarning className={inputCls} />
                        {type === "listrik" && live?.power != null && (
                            <button type="button" onClick={() => setSensor(String(live.power))} title="Pakai daya terukur alat sekarang" className="shrink-0 rounded-xl border border-[#EAEAEA] bg-white px-2 font-inter text-[11px] text-[#7B1113] hover:bg-[#F8F1E7]">
                                Alat
                            </button>
                        )}
                    </div>
                </Field>
                <button type="submit" disabled={saving} suppressHydrationWarning className="rounded-xl bg-[#7B1113] px-4 py-2 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90 disabled:opacity-50">
                    {saving ? "Menyimpan..." : "Simpan uji"}
                </button>
            </form>
            {reference && sensor && Number(reference) > 0 && (
                <p className="mt-1 font-inter text-xs text-[#555]">
                    Galat uji ini: <span className="font-semibold">{num(errorPct({ reference: Number(reference), sensor: Number(sensor) }))}%</span> (batas {CALIBRATION_LIMIT_PCT[type]}%)
                </p>
            )}

            {entries.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer font-inter text-xs text-[#7B1113]">Lihat {entries.length} catatan uji</summary>
                    <ul className="mt-2 divide-y divide-[#F0F0F0]">
                        {[...entries].sort((a, b) => b.at.localeCompare(a.at)).map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-3 py-2 font-inter text-xs text-[#555]">
                                <span>
                                    {new Date(e.at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} · {roomName(e.roomId)} · {e.type} · acuan {num(e.reference, 2)} vs alat {num(e.sensor, 2)} {CALIBRATION_UNIT[e.type]}
                                    <span className="ml-1 font-medium text-[#2F2F2F]">({num(errorPct(e))}%)</span>
                                </span>
                                {e.verified ? <span title="Diverifikasi independen" className="flex shrink-0 items-center gap-1 text-[11px] text-green-700"><ShieldCheck size={13} /> Terverifikasi</span> : b.canManage && b.source === "real" && e.recordedBy !== b.user?.id && <button className="text-[11px] text-[#7B1113] underline" onClick={async () => { const result = await Swal.fire({ title: "Verifikasi independen", input: "textarea", inputLabel: "Rujukan pemeriksaan minimal 8 karakter", inputValidator: (value) => value.trim().length >= 8 ? undefined : "Lengkapi rujukan pemeriksaan.", showCancelButton: true, confirmButtonColor: "#7B1113" }); if (!result.isConfirmed) return; try { await writeData("patch", `/api/coops/${e.roomId}/calibrations/${e.id}`, { verification_state: "independently_verified", evidence_note: String(result.value).trim() }); await b.refresh(); } catch (error) { await Swal.fire({ icon: "error", title: "Verifikasi ditolak", text: apiErrorMessage(error), confirmButtonColor: "#7B1113" }); } }}>Verifikasi independen</button>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </Block>
    );
}

// ── 2. Keandalan data ──────────────────────────────────────────────────────

function ReliabilitySection({ rooms }: { rooms: { id: number; number: string }[] }) {
    const b = useBroiler();
    const reports = useQueries({
        queries: rooms.map((r) => ({
            queryKey: ["broiler", b.user?.id, r.id, "validation-report", b.source],
            queryFn: () => readData<ValidationReport>(`/api/coops/${r.id}/validation-report`, { source: b.source }),
            staleTime: 60_000,
        })),
    });
    const isLoading = reports.some((q) => q.isPending);
    const isError = reports.length > 0 && reports.every((q) => q.isError);
    const rows = rooms
        .map((r, i) => ({ room: r, rel: reports[i]?.data?.telemetry_reliability }))
        .filter((x) => x.rel?.state === "independently_attested" && x.rel.observations?.length)
        .map(({ room, rel }) => ({
            room_id: room.id,
            number: room.number,
            uptime_pct: rel!.observations!.reduce((s, o) => s + o.received_packets, 0) / rel!.observations!.reduce((s, o) => s + o.expected_packets, 0) * 100,
            expected: rel!.observations!.reduce((s, o) => s + o.expected_packets, 0),
            received: rel!.observations!.reduce((s, o) => s + o.received_packets, 0),
            tests: rel!.observations!.length,
            attested: rel!.state === "independently_attested",
        }));
    const status: Status = rows.length === 0 ? "kurang-data" : rows.every((r) => r.uptime_pct >= UPTIME_TARGET) ? "lulus" : "belum";

    return (
        <Block title="2 · Keandalan data" target={`≥ ${UPTIME_TARGET}% paket diterima`} status={status}>
            {isLoading ? (
                <div className="h-24 animate-pulse rounded-2xl bg-[#FAFAFA]" />
            ) : isError ? (
                <p className="rounded-2xl bg-[#FAFAFA] px-4 py-4 font-inter text-xs text-[#777]">
                    Data validasi gagal dimuat.
                </p>
            ) : rows.length === 0 ? (
                <p className="rounded-2xl bg-[#FAFAFA] px-4 py-4 font-inter text-xs text-[#777]">
                    Belum ada uji pengiriman paket.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((r) => {
                        const ok = r.uptime_pct >= UPTIME_TARGET;
                        return (
                            <div key={r.room_id}>
                                <div className="flex items-baseline justify-between gap-3 font-inter text-sm">
                                    <span className="font-medium text-[#2F2F2F]">{r.number}</span>
                                    <span className={`font-semibold ${ok ? "text-green-700" : "text-[#B42318]"}`}>{num(r.uptime_pct, 2)}%</span>
                                </div>
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F0F0F0]" role="img" aria-label={`${r.number}: ${num(r.uptime_pct, 2)}% data diterima`}>
                                    <div className={`h-full rounded-full ${ok ? "bg-green-600" : "bg-[#B42318]"}`} style={{ width: `${Math.min(100, r.uptime_pct)}%` }} />
                                </div>
                                <p className="mt-1 font-inter text-[11px] text-[#999]">
                                    {r.tests} uji · {r.received.toLocaleString("id-ID")} dari {r.expected.toLocaleString("id-ID")} paket diterima
                                    {r.attested ? " · diverifikasi independen" : " · belum diverifikasi independen"}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </Block>
    );
}

// ── 3. Respons Guard ───────────────────────────────────────────────────────

function GuardResponseSection({ rooms }: { rooms: { id: number; number: string }[] }) {
    const b = useBroiler();
    const reports = useQueries({ queries: rooms.map((r) => ({ queryKey: ["broiler", b.user?.id, r.id, "validation-report", b.source], queryFn: () => readData<ValidationReport>(`/api/coops/${r.id}/validation-report`, { source: b.source }), staleTime: 60_000 })) });
    const values = reports.flatMap((q) => q.data?.guard_response?.state === "independently_attested" ? q.data.guard_response.observations ?? [] : []).map((v) => v.response_seconds).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
    const rows: { label: string; target: string; value: string; samples: number; ok: boolean | null; note?: string }[] = [{ label: "Waktu respons Guard (median)", target: "Sesuai jenis insiden", value: formatSeconds(median), samples: values.length, ok: null }];
    const status: Status = values.length ? "belum" : "kurang-data";

    return (
        <Block title="3 · Respons Guard" target="≤ 1 menit (kipas, padam) · ≤ 15 menit (bocor)" status={status}>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] font-inter text-sm">
                    <thead>
                        <tr className="border-b border-[#EAEAEA] text-left text-xs text-[#999]">
                            <th className="py-2 font-medium">Kejadian</th>
                            <th className="py-2 text-right font-medium">Target</th>
                            <th className="py-2 text-right font-medium">Terukur (median)</th>
                            <th className="py-2 text-right font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.label} className="border-b border-[#F5F5F5] align-top last:border-0">
                                <td className="py-2.5 text-[#2F2F2F]">
                                    {r.label}
                                    {r.note && <p className="text-[11px] text-[#999]">{r.note}</p>}
                                </td>
                                <td className="py-2.5 text-right text-[#555]">{r.target}</td>
                                <td className="py-2.5 text-right text-[#555]">
                                    {r.value}
                                    {r.samples > 0 && <p className="text-[11px] text-[#999]">{r.samples} kejadian</p>}
                                </td>
                                <td className="py-2.5 text-right">
                                    {r.ok == null ? <span className="text-[#999]">{r.samples ? "Perlu dinilai" : "Belum diuji"}</span> : r.ok ? <span className="font-medium text-green-700">Memenuhi</span> : <span className="font-medium text-[#B42318]">Belum</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Block>
    );
}

// ── 4. Uji lapangan ────────────────────────────────────────────────────────

function FieldTestSection() {
    const b = useBroiler();
    const inFlight = useRef(false);
    const scope = useRef("");
    scope.current = `${b.user?.id}:${b.source}`;
    const reports = useQueries({ queries: b.coops.map((c) => ({ queryKey: ["broiler", b.user?.id, c.id, "validation-report", b.source], queryFn: () => readData<ValidationReport>(`/api/coops/${c.id}/validation-report`, { source: b.source }), staleTime: 60_000 })) });
    const entries = reports.flatMap((q) => (q.data?.evidence ?? []).filter((e) => e.kind === "field_trial"));
    const allEntries = reports.flatMap((q, i) => (q.data?.evidence ?? []).map((e) => ({ ...e, coopId: b.coops[i].id })));
    async function recordEvidence() {
        if (inFlight.current) return;
        inFlight.current = true;
        const requestedScope = scope.current;
        try {
        const options = Object.fromEntries(b.coops.flatMap((c) => ["field_trial", "packet_delivery", "guard_response"].map((kind) => [`${c.id}:${kind}`, `${c.code} · ${kind}`])));
        const selected = await Swal.fire({ title: "Catat evidence manual", input: "select", inputOptions: options, showCancelButton: true, confirmButtonText: "Lanjut", confirmButtonColor: "#7B1113" });
        if (!selected.isConfirmed || !selected.value || scope.current !== requestedScope) return;
        const [coopId, kind] = String(selected.value).split(":");
        const fields = kind === "packet_delivery" ? { reference: "", expected_packets: null, received_packets: null, trusted_sequence_reference: "" } : kind === "guard_response" ? { reference: "", alert_id: null, physical_onset_at: "", detection_at: "" } : { reference: "", observations: "" };
        const result = await Swal.fire({ title: "Catat hasil uji", text: "Isi dengan pengamatan sebenarnya (waktu ISO dengan zona).", input: "textarea", inputValue: JSON.stringify({ instrument_id: "", method: "", observed_start: "", observed_end: "", evidence: fields }, null, 2), inputValidator: (value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? undefined : "Isi objek JSON."; } catch { return "Format JSON belum valid."; } }, showCancelButton: true, confirmButtonText: "Simpan evidence", confirmButtonColor: "#7B1113" });
        if (!result.isConfirmed || scope.current !== requestedScope) return;
        try { await writeData("post", `/api/coops/${coopId}/validation-evidence`, { ...JSON.parse(String(result.value)), kind, source: b.source }); await b.refresh(); }
        catch (error) { await Swal.fire({ icon: "error", title: "Evidence belum tersimpan", text: apiErrorMessage(error), confirmButtonColor: "#7B1113" }); }
        } finally { inFlight.current = false; }
    }
    async function verify(entry: typeof allEntries[number]) {
        const result = await Swal.fire({ title: "Verifikasi bukti", text: "Dilakukan orang lain dengan rujukan pengukuran.", input: "textarea", inputValidator: (value) => value.trim().length >= 8 ? undefined : "Rujukan minimal 8 karakter.", showCancelButton: true, confirmButtonColor: "#7B1113" });
        if (!result.isConfirmed) return;
        try { await writeData("patch", `/api/coops/${entry.coopId}/validation-evidence/${entry.id}`, { verification_state: "independently_verified", evidence_note: String(result.value).trim() }); await b.refresh(); }
        catch (error) { await Swal.fire({ icon: "error", title: "Review ditolak", text: apiErrorMessage(error), confirmButtonColor: "#7B1113" }); }
    }
    return (
        <Block title="4 · Uji lapangan" target="1 siklus (±35 hari) vs recording manual" status={entries.length ? "belum" : "kurang-data"}>
            <p className="font-inter text-sm text-[#555]">
                {entries.length ? `${entries.length} evidence lapangan tersimpan; ${entries.filter((e) => e.source === "real" && e.verification_state === "independently_verified").length} diverifikasi independen.` : "Belum ada catatan uji lapangan."}
            </p>
            {b.canOperate && <button onClick={recordEvidence} className="mt-2 font-inter text-xs text-[#7B1113] underline">Catat hasil uji</button>}
            {allEntries.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-inter text-xs text-[#7B1113]">Riwayat bukti uji</summary><ul className="mt-2 divide-y divide-[#F0F0F0]">{allEntries.map((entry) => <li key={entry.id} className="py-2 font-inter text-xs text-[#555]">#{entry.id} · {entry.kind} · {entry.source} · {entry.verification_state} · {entry.evidence.reference}{b.canManage && entry.source === "real" && entry.recorded_by !== b.user?.id && entry.verification_state !== "independently_verified" && <button onClick={() => verify(entry)} className="ml-2 text-[#7B1113] underline">Review independen</button>}</li>)}</ul></details>}
        </Block>
    );
}

// ── Komponen kecil ─────────────────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 font-inter text-sm text-[#2F2F2F] outline-none focus:border-[#7B1113]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="font-inter text-[11px] text-[#777]">{label}</span>
            <span className="mt-0.5 block">{children}</span>
        </label>
    );
}

const STATUS_BADGE: Record<Status, { cls: string; label: string; icon: React.ReactNode }> = {
    lulus: { cls: "bg-green-50 text-green-700", label: "Memenuhi", icon: <CheckCircle2 size={13} /> },
    belum: { cls: "bg-[#FFF4E5] text-[#B76E00]", label: "Sebagian", icon: <XCircle size={13} /> },
    "kurang-data": { cls: "bg-[#F5F5F5] text-[#777]", label: "Belum diuji", icon: <CircleDashed size={13} /> },
};

function Block({ title, target, status, children }: { title: string; target: string; status: Status; children: React.ReactNode }) {
    const badge = STATUS_BADGE[status];
    return (
        <div className="border-t border-[#F0F0F0] pt-5 first:border-0 first:pt-0">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{title}</p>
                    <p className="font-inter text-xs text-[#999]">Target: {target}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-xs font-medium ${badge.cls}`}>{badge.icon} {badge.label}</span>
            </div>
            {children}
        </div>
    );
}
