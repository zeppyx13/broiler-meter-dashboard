"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { CheckCircle2, CircleDashed, ClipboardCheck, Gauge, Radar, Sprout, Trash2, Wifi, XCircle } from "lucide-react";
import { getRooms } from "@/lib/room-api";
import { getAllLiveStatus } from "@/lib/live-status-api";
import { getDeviceHealth } from "@/lib/device-health-api";
import { getGuardSettings } from "@/lib/guard-settings";
import { formatSeconds, guardStats } from "@/lib/guard-performance";
import { useGuard } from "@/components/dashboard/guard/guard-monitor";
import {
    CALIBRATION_LIMIT_PCT, CALIBRATION_UNIT, MIN_REPEATS, addCalibration, errorPct, getCalibrations, removeCalibration, summarizeCalibrations,
    type CalibrationEntry, type CalibrationType,
} from "@/lib/calibration";

const num = (v: number, d = 1) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const HEALTH_DAYS = 7;
const UPTIME_TARGET = 98;

type Status = "lulus" | "belum" | "kurang-data";

/** Panel validasi mengikuti Tabel 4 proposal: akurasi, keandalan data, respons Guard, uji lapangan. */
export default function ValidationPanel() {
    const { data: roomData } = useQuery({ queryKey: ["rooms-overview"], queryFn: () => getRooms({ limit: 100 }), staleTime: 60_000 });
    const rooms = useMemo(() => [...(roomData?.rooms ?? [])].sort((a, b) => a.number.localeCompare(b.number, "id", { numeric: true })), [roomData]);
    const roomName = (id: number) => rooms.find((r) => r.id === id)?.number ?? `#${id}`;

    return (
        <section className="rounded-3xl border border-[#EAEAEA] bg-white p-6" aria-labelledby="validation-title">
            <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-[#7B1113]" />
                <h3 id="validation-title" className="font-poppins text-base font-semibold text-[#2F2F2F]">Validasi alat</h3>
            </div>
            <p className="mt-1 font-inter text-xs text-[#999]">Mengikuti rencana validasi di proposal (Tabel 4): akurasi sensor, keandalan data, respons Guard, dan uji lapangan.</p>

            <div className="mt-5 space-y-6">
                <AccuracySection rooms={rooms} roomName={roomName} />
                <ReliabilitySection />
                <GuardResponseSection />
                <FieldTestSection />
            </div>
        </section>
    );
}

// ── 1. Akurasi sensor ──────────────────────────────────────────────────────

function AccuracySection({ rooms, roomName }: { rooms: { id: number; number: string }[]; roomName: (id: number) => string }) {
    const [entries, setEntries] = useState<CalibrationEntry[]>(getCalibrations);
    // Dibaca setelah mount: data uji ada di browser, server tidak tahu isinya.

    const [roomId, setRoomId] = useState<number | "">("");
    const [type, setType] = useState<CalibrationType>("listrik");
    const [reference, setReference] = useState("");
    const [sensor, setSensor] = useState("");
    const { data: liveList } = useQuery({ queryKey: ["iot-live-status-all"], queryFn: getAllLiveStatus, refetchInterval: 10_000, staleTime: 5_000 });

    const summaries = useMemo(() => summarizeCalibrations(entries).sort((a, b) => roomName(a.roomId).localeCompare(roomName(b.roomId), "id", { numeric: true }) || a.type.localeCompare(b.type)), [entries, roomName]);
    const status: Status = summaries.length === 0 ? "kurang-data" : summaries.every((s) => s.passed && s.enoughRepeats) ? "lulus" : "belum";
    const selectedRoom = roomId || rooms[0]?.id;
    const live = liveList?.find((l) => l.room_id === selectedRoom);

    function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        const ref = Number(reference);
        const sen = Number(sensor);
        if (!selectedRoom || !(ref > 0) || !(sen >= 0)) {
            Swal.fire({ icon: "warning", title: "Lengkapi data uji", text: "Isi nilai alat acuan dan pembacaan COASTHER.", confirmButtonColor: "#7B1113" });
            return;
        }
        setEntries(addCalibration({ roomId: Number(selectedRoom), type, reference: ref, sensor: sen }));
        setReference("");
        setSensor("");
    }

    return (
        <Block
            icon={<Gauge size={16} />}
            title="1 · Akurasi sensor"
            target="Galat listrik ≤ 2% (PZEM vs clamp meter), air ≤ 5% (YF-S201 vs ember 10 L), 3 ulangan"
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
                                        {s.passed && s.enoughRepeats ? (
                                            <span className="font-medium text-green-700">Lulus</span>
                                        ) : !s.passed ? (
                                            <span className="font-medium text-[#B42318]">Perlu kalibrasi</span>
                                        ) : (
                                            <span className="text-[#B76E00]">Kurang ulangan</span>
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
                        {type === "listrik" && live && (
                            <button type="button" onClick={() => setSensor(String(live.power))} title="Pakai daya terukur alat sekarang" className="shrink-0 rounded-xl border border-[#EAEAEA] bg-white px-2 font-inter text-[11px] text-[#7B1113] hover:bg-[#F8F1E7]">
                                Alat
                            </button>
                        )}
                    </div>
                </Field>
                <button type="submit" suppressHydrationWarning className="rounded-xl bg-[#7B1113] px-4 py-2 font-inter text-sm font-medium text-[#C6A971] transition hover:opacity-90">
                    Simpan uji
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
                                <button onClick={() => setEntries(removeCalibration(e.id))} title="Hapus uji" className="rounded-lg p-1 text-[#BBB] hover:bg-red-50 hover:text-red-500">
                                    <Trash2 size={13} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </Block>
    );
}

// ── 2. Keandalan data ──────────────────────────────────────────────────────

function ReliabilitySection() {
    const { data, isLoading, isError } = useQuery({ queryKey: ["iot-health", HEALTH_DAYS], queryFn: () => getDeviceHealth(HEALTH_DAYS), staleTime: 60_000 });
    const rows = [...(data ?? [])].sort((a, b) => a.number.localeCompare(b.number, "id", { numeric: true }));
    const status: Status = !data || rows.length === 0 ? "kurang-data" : rows.every((r) => r.uptime_pct >= UPTIME_TARGET) ? "lulus" : "belum";

    return (
        <Block icon={<Wifi size={16} />} title="2 · Keandalan data" target={`≥ ${UPTIME_TARGET}% data diterima (${HEALTH_DAYS} hari terakhir), termasuk saat internet putus`} status={status}>
            {isLoading ? (
                <div className="h-24 animate-pulse rounded-2xl bg-[#FAFAFA]" />
            ) : isError ? (
                <p className="rounded-2xl bg-[#FAFAFA] px-4 py-4 font-inter text-xs text-[#777]">
                    Data keandalan butuh endpoint <code className="rounded bg-white px-1">/api/iot/health</code> di backend (lihat docs/BACKEND-HANDOFF.md).
                </p>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((r) => {
                        const lostMin = r.gaps.filter((g) => !g.buffered).reduce((s, g) => s + (new Date(g.end).getTime() - new Date(g.start).getTime()) / 60_000, 0);
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
                                    {r.gaps.length} kali putus · {r.resent.toLocaleString("id-ID")} paket dikirim ulang dari buffer · data hilang {num(lostMin, 0)} menit
                                    {r.gaps.some((g) => g.reason === "padam") && " (listrik padam)"}
                                </p>
                            </div>
                        );
                    })}
                    <p className="font-inter text-[11px] text-[#AAA]">Saat WiFi putus, ESP32 menyimpan data dan mengirim ulang setelah tersambung. Data hanya hilang bila alat ikut mati (listrik padam) atau restart.</p>
                </div>
            )}
        </Block>
    );
}

// ── 3. Respons Guard ───────────────────────────────────────────────────────

function GuardResponseSection() {
    const { active, history } = useGuard();
    const [sinceMs] = useState(() => Date.now() - HEALTH_DAYS * 86_400_000);
    const stats = useMemo(() => guardStats([...active, ...history], sinceMs), [active, history, sinceMs]);
    const [offlineMinutes] = useState(() => getGuardSettings().offlineMinutes);


    const rows: { label: string; target: string; value: string; samples: number; ok: boolean | null; note?: string }[] = [
        {
            label: "Kipas mati / daya turun",
            target: "≤ 1 menit",
            value: formatSeconds(stats.detectionSec.power),
            samples: stats.detectionSamples.power,
            ok: stats.detectionSec.power != null ? stats.detectionSec.power <= 60 : null,
        },
        {
            label: "Listrik padam / alat offline",
            target: "≤ 1 menit",
            value: formatSeconds(stats.detectionSec.offline),
            samples: stats.detectionSamples.offline,
            ok: stats.detectionSec.offline != null ? stats.detectionSec.offline <= 60 : null,
            note: `Ambang offline ${Math.round(offlineMinutes * 60)} detik tanpa data (bisa diubah di Pengaturan).`,
        },
        {
            label: "Air bocor (keran terbuka)",
            target: "≤ 15 menit",
            value: "≥ 2 jam",
            samples: 0,
            ok: false,
            note: "Guard menilai laju air harian setelah ≥ 2 jam data; aturan debit tinggi seketika belum dibuat.",
        },
    ];
    const status: Status = rows.every((r) => r.ok) ? "lulus" : rows.some((r) => r.ok) ? "belum" : "kurang-data";

    return (
        <Block icon={<Radar size={16} />} title="3 · Respons Guard" target="Notifikasi ≤ 1 menit (kipas mati, padam); ≤ 15 menit (bocor)" status={status}>
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
                                    {r.ok == null ? <span className="text-[#999]">Belum ada kejadian</span> : r.ok ? <span className="font-medium text-green-700">Memenuhi</span> : <span className="font-medium text-[#B42318]">Belum</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-1 font-inter text-[11px] text-[#AAA]">Diukur dari riwayat peringatan {HEALTH_DAYS} hari terakhir: jeda dari data alat masuk sampai peringatan muncul.</p>
        </Block>
    );
}

// ── 4. Uji lapangan ────────────────────────────────────────────────────────

function FieldTestSection() {
    return (
        <Block icon={<Sprout size={16} />} title="4 · Uji lapangan" target="Satu siklus (±35 hari) di kandang mitra, dibandingkan recording manual" status="kurang-data">
            <p className="font-inter text-sm text-[#555]">
                Belum dilakukan. Rencana: pasang di satu kandang mitra selama satu siklus, lalu bandingkan kurva L/ekor/hari, kWh/siklus, dan kejadian yang tertangkap Guard dengan catatan manual peternak.
            </p>
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

function Block({ icon, title, target, status, children }: { icon: React.ReactNode; title: string; target: string; status: Status; children: React.ReactNode }) {
    const badge = STATUS_BADGE[status];
    return (
        <div className="border-t border-[#F0F0F0] pt-5 first:border-0 first:pt-0">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="flex items-center gap-1.5 font-poppins text-sm font-semibold text-[#2F2F2F]"><span className="text-[#7B1113]">{icon}</span> {title}</p>
                    <p className="font-inter text-xs text-[#999]">Kriteria: {target}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-xs font-medium ${badge.cls}`}>{badge.icon} {badge.label}</span>
            </div>
            {children}
        </div>
    );
}
