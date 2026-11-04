"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Check, Clock, Radar, Timer } from "lucide-react";
import type { LoggedAlert } from "@/lib/alert-log";
import { ackSec, eventDurationSec, formatSeconds, guardStats } from "@/lib/guard-performance";
import type { AlertTier } from "@/lib/kandang-insights";

const DOT: Record<AlertTier, string> = { kritis: "bg-[#B42318]", waspada: "bg-[#B76E00]", info: "bg-[#2F5BBA]" };
const WINDOW_DAYS = 7;
const PAGE = 25;

const clock = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long" });

/** Linimasa kejadian 7 hari terakhir + ringkasan kecepatan deteksi & tanggapan. */
export default function KejadianTimeline({ active, history, sinceMs }: { active: LoggedAlert[]; history: LoggedAlert[]; sinceMs: number }) {
    const [shown, setShown] = useState(PAGE);
    const [onlyImportant, setOnlyImportant] = useState(true);

    const events = useMemo(
        () => [...active, ...history]
            .filter((a) => new Date(a.firstSeen).getTime() >= sinceMs && (!onlyImportant || a.tier !== "info"))
            .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)),
        [active, history, sinceMs, onlyImportant]
    );
    const stats = useMemo(() => guardStats([...active, ...history], sinceMs), [active, history, sinceMs]);
    const instantDetections = [stats.detectionSec.power, stats.detectionSec.voltage].filter((v): v is number => v != null);
    const fastDetection = instantDetections.length > 0 ? Math.max(...instantDetections) : null;

    const groups: { day: string; items: LoggedAlert[] }[] = [];
    events.slice(0, shown).forEach((a) => {
        const day = dayLabel(a.firstSeen);
        const g = groups[groups.length - 1];
        if (g?.day === day) g.items.push(a);
        else groups.push({ day, items: [a] });
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Summary icon={<Activity size={15} className="text-[#7B1113]" />} label={`Kejadian ${WINDOW_DAYS} hari`} value={String(stats.events)} sub={`${stats.kritis} kritis · ${stats.waspada} waspada`} />
                <Summary
                    icon={<Radar size={15} className="text-[#7B1113]" />}
                    label="Waktu deteksi"
                    value={formatSeconds(fastDetection)}
                    sub={stats.detectionSec.offline != null ? `padam/offline ${formatSeconds(stats.detectionSec.offline)}` : "kipas mati & tegangan"}
                />
                <Summary icon={<Check size={15} className="text-[#7B1113]" />} label="Dicek peternak" value={formatSeconds(stats.medianAckSec)} sub={stats.unacked > 0 ? `${stats.unacked} belum ditandai dicek` : "median sejak peringatan"} />
                <Summary icon={<Timer size={15} className="text-[#7B1113]" />} label="Lama kejadian" value={formatSeconds(stats.medianDurationSec)} sub="median sampai normal lagi" />
            </div>

            <div className="flex items-center justify-between gap-3">
                <p className="font-inter text-xs text-[#999]">Waktu deteksi = jeda dari data alat masuk sampai peringatan muncul (median).</p>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 font-inter text-xs text-[#555]">
                    <input type="checkbox" checked={!onlyImportant} onChange={(e) => setOnlyImportant(!e.target.checked)} className="h-3.5 w-3.5 accent-[#7B1113]" />
                    Tampilkan info
                </label>
            </div>

            {events.length === 0 ? (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-14 text-center">
                    <p className="font-inter text-sm text-[#999]">Belum ada kejadian dalam {WINDOW_DAYS} hari terakhir.</p>
                </div>
            ) : (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    {groups.map((g) => (
                        <section key={g.day} className="mb-5 last:mb-0">
                            <h4 className="mb-3 font-inter text-xs font-semibold uppercase tracking-wide text-[#999]">{g.day}</h4>
                            <ol className="relative ml-1.5 border-l border-[#EAEAEA]">
                                {g.items.map((a) => <TimelineItem key={`${a.key}-${a.firstSeen}`} alert={a} />)}
                            </ol>
                        </section>
                    ))}
                    {events.length > shown && (
                        <button onClick={() => setShown((n) => n + PAGE)} suppressHydrationWarning className="mt-2 font-inter text-sm font-medium text-[#7B1113] hover:underline">
                            Tampilkan {Math.min(PAGE, events.length - shown)} kejadian lagi
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function TimelineItem({ alert }: { alert: LoggedAlert }) {
    const ongoing = !alert.resolvedAt;
    const ack = ackSec(alert);
    return (
        <li className="relative pb-4 pl-5 last:pb-0">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT[alert.tier]}`} aria-hidden />
            <Link href={`/dashboard/kamar/${alert.roomId}`} className="group block">
                <p className="font-inter text-sm text-[#2F2F2F]">
                    <span className="mr-1.5 font-mono text-xs text-[#999]">{clock(alert.firstSeen)}</span>
                    <span className="font-semibold">Kandang {alert.roomNumber}</span> · <span className="group-hover:text-[#7B1113]">{alert.title}</span>
                    <span className="sr-only"> ({alert.tier})</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 font-inter text-[11px]">
                    {alert.detectionSec != null && (
                        <Chip>
                            <Radar size={11} /> {alert.alertId === "offline" ? `terdeteksi ${formatSeconds(alert.detectionSec)} tanpa data` : `terdeteksi ${formatSeconds(alert.detectionSec)}`}
                        </Chip>
                    )}
                    {ack != null ? <Chip><Check size={11} /> dicek {formatSeconds(ack)}</Chip> : !ongoing && alert.tier !== "info" ? <Chip muted>tidak ditandai dicek</Chip> : null}
                    {ongoing ? (
                        <Chip tone="live"><Clock size={11} /> masih berlangsung</Chip>
                    ) : (
                        <Chip><Timer size={11} /> {formatSeconds(eventDurationSec(alert))} · normal {clock(alert.lastSeen)}</Chip>
                    )}
                </div>
            </Link>
        </li>
    );
}

function Chip({ children, muted, tone }: { children: React.ReactNode; muted?: boolean; tone?: "live" }) {
    const cls = tone === "live" ? "bg-[#FDEAEA] text-[#B42318]" : muted ? "bg-[#F5F5F5] text-[#999]" : "bg-[#F8F1E7] text-[#7A5C1E]";
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}

function Summary({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
            <p className="flex items-center gap-1.5 font-inter text-xs text-[#999]">{icon} {label}</p>
            <p className="mt-1 font-poppins text-xl font-bold text-[#2F2F2F]">{value}</p>
            <p className="font-inter text-[11px] text-[#999]">{sub}</p>
        </div>
    );
}
