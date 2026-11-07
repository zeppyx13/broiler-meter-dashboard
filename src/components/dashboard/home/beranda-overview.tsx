"use client";

import Link from "next/link";
import { Droplets, Zap, Wallet, Wifi, WifiOff, ShieldCheck, ShieldAlert, ChevronRight, Sprout } from "lucide-react";
import { useKandangSnapshots, type KandangSnapshot } from "@/lib/kandang-snapshot";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { ALERT_TIER_ORDER, type AlertTier } from "@/lib/kandang-insights";
import { formatRupiah } from "@/lib/broiler-reference";

type Status = AlertTier | "normal" | "unknown";

const STATUS_STYLE: Record<Status, { pill: string; ring: string; label: string }> = {
    kritis: { pill: "bg-[#B42318] text-white", ring: "border-[#F6D0D0]", label: "Kritis" },
    waspada: { pill: "bg-[#B76E00] text-white", ring: "border-[#F3E2C0]", label: "Waspada" },
    info: { pill: "bg-[#EAF2FF] text-[#2F5BBA]", ring: "border-[#EAEAEA]", label: "Info" },
    normal: { pill: "bg-green-100 text-green-700", ring: "border-[#EAEAEA]", label: "Normal" },
    unknown: { pill: "bg-[#EAF2FF] text-[#2F5BBA]", ring: "border-[#EAEAEA]", label: "Belum tersedia" },
};

function worstStatus(s: KandangSnapshot): Status {
    const tiers = s.insights.alerts.map((a) => a.tier).sort((a, b) => ALERT_TIER_ORDER[a] - ALERT_TIER_ORDER[b]);
    const complete = s.dataAvailable && s.telemetryAvailable && s.todayUsage.waterTodayLiter != null && s.todayUsage.energyTodayKwh != null && s.insights.actualPowerKw != null;
    return tiers[0] ?? (complete && s.guardHealthy ? "normal" : "unknown");
}

const STATUS_ORDER: Record<Status, number> = { kritis: 0, waspada: 1, unknown: 2, info: 3, normal: 4 };

function subtotal(values: (number | null | undefined)[]) {
    const observed = values.filter((value): value is number => value != null && Number.isFinite(value));
    return { value: observed.length ? observed.reduce((sum, value) => sum + value, 0) : null, partial: observed.length < values.length };
}

export default function BerandaOverview() {
    const { snapshots: allSnapshots, isLoading, isError, lastUpdate } = useKandangSnapshots();
    const { farmId, farms } = useBroiler();
    // Beranda menampilkan lahan yang sedang dipilih (bila akun punya lebih dari satu lahan).
    const snapshots = farms.length > 1 ? allSnapshots.filter((s) => s.room.floor === farmId) : allSnapshots;
    const timezone = farms.find((farm) => farm.id === farmId)?.timezone ?? "Asia/Makassar";

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-32 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />)}
                </div>
            </div>
        );
    }
    if (isError) {
        return <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-inter text-sm text-red-700">Data kandang belum bisa dimuat. Muat ulang halaman.</div>;
    }

    const active = snapshots
        .filter((s) => s.cycle)
        .sort((a, b) => STATUS_ORDER[worstStatus(a)] - STATUS_ORDER[worstStatus(b)] || a.room.number.localeCompare(b.room.number));
    const resting = snapshots.filter((s) => !s.cycle && s.dataAvailable);
    const unknownCount = snapshots.filter((s) => !s.dataAvailable || (s.cycle && worstStatus(s) === "unknown")).length;

    const counts = { kritis: 0, waspada: 0, aman: 0 };
    active.forEach((s) => {
        const st = worstStatus(s);
        if (st === "kritis") counts.kritis++;
        else if (st === "waspada") counts.waspada++;
        else if (st === "normal") counts.aman++;
    });

    const waterToday = subtotal(snapshots.filter((s) => s.cycle || !s.dataAvailable).map((s) => s.todayUsage.waterTodayLiter));
    const energyToday = subtotal(snapshots.map((s) => s.todayUsage.energyTodayKwh));
    const energyCost = subtotal(snapshots.map((s) => s.insights.energyTodayCost));
    const powerNow = subtotal(snapshots.map((s) => s.insights.actualPowerKw));
    const onlineCount = subtotal(snapshots.map((s) => s.onlineDeviceCount));
    const deviceCount = subtotal(snapshots.map((s) => s.deviceCount));

    const headline = counts.kritis > 0
        ? { text: `${counts.kritis} kandang butuh tindakan segera`, tone: "text-[#B42318]", icon: <ShieldAlert size={22} className="text-[#B42318]" /> }
        : counts.waspada > 0
            ? { text: `${counts.waspada} kandang perlu dicek`, tone: "text-[#B76E00]", icon: <ShieldAlert size={22} className="text-[#B76E00]" /> }
            : unknownCount > 0 || active.some((s) => worstStatus(s) === "unknown")
                ? { text: "Sebagian status kandang belum tersedia", tone: "text-[#B76E00]", icon: <ShieldAlert size={22} className="text-[#B76E00]" /> }
                : active.length > 0
                    ? { text: "Semua kandang normal", tone: "text-green-700", icon: <ShieldCheck size={22} className="text-green-600" /> }
                    : { text: "Belum ada siklus berjalan", tone: "text-[#2F2F2F]", icon: <Sprout size={22} className="text-[#7B1113]" /> };

    return (
        <div className="space-y-6">
            {/* Status utama */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">{headline.icon}</div>
                    <div className="min-w-0 flex-1">
                        <h2 className={`font-poppins text-xl font-bold sm:text-2xl ${headline.tone}`}>{headline.text}</h2>
                        <p className="mt-1 font-inter text-sm text-[#777]">
                            {active.length} kandang aktif · {resting.length} istirahat{unknownCount > 0 ? ` · ${unknownCount} belum ada data` : ""}
                            {lastUpdate && ` · data alat ${new Date(lastUpdate).toLocaleTimeString("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                    </div>
                </div>
                {active.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 font-inter text-xs font-medium">
                        <span className="rounded-full bg-[#FDEAEA] px-3 py-1.5 text-[#B42318]">{counts.kritis} kritis</span>
                        <span className="rounded-full bg-[#FFF4E5] px-3 py-1.5 text-[#B76E00]">{counts.waspada} waspada</span>
                        <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-700">{counts.aman} normal</span>
                    </div>
                )}
            </div>

            {/* Total hari ini */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Kpi icon={<Droplets size={16} className="text-blue-500" />} label="Air inlet hari ini" value={waterToday.value == null ? "—" : `${waterToday.value.toLocaleString("id-ID", { maximumFractionDigits: 0 })} L`} sub={waterToday.value == null ? "Belum ada data" : waterToday.partial ? "Data parsial kandang aktif" : "Semua kandang aktif"} />
                <Kpi icon={<Zap size={16} className="text-amber-500" />} label="Daya sekarang" value={powerNow.value == null ? "—" : `${powerNow.value.toFixed(2)} kW`} sub={powerNow.value == null ? "Belum ada data" : powerNow.partial ? "Data panel parsial" : "Total panel teramati"} />
                <Kpi icon={<Wallet size={16} className="text-[#7B1113]" />} label="Energi hari ini" value={energyToday.value == null ? "—" : `${energyToday.value.toFixed(1)} kWh`} sub={`${energyCost.value == null ? "Biaya belum tersedia" : `≈ ${formatRupiah(energyCost.value)}`}${energyToday.partial || energyCost.partial ? " · parsial" : ""}`} />
                <Kpi icon={<Wifi size={16} className="text-green-600" />} label="Perangkat online" value={onlineCount.value == null || deviceCount.value == null ? "—" : `${onlineCount.value} / ${deviceCount.value}`} sub={deviceCount.value == null ? "Heartbeat belum tersedia" : deviceCount.value === 0 ? "Belum ada perangkat terdaftar" : `Heartbeat perangkat${onlineCount.partial ? " · data parsial" : ""}`} />
            </div>

            {/* Kandang aktif */}
            <section>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-poppins text-lg font-semibold text-[#2F2F2F]">Kandang aktif</h3>
                    <Link href="/dashboard/kamar" className="font-inter text-sm font-semibold text-[#7B1113] hover:underline">Semua kandang</Link>
                </div>
                {active.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-[#D8D8D8] bg-white px-6 py-10 text-center">
                        {snapshots.length === 0 ? (
                            <>
                                <p className="font-inter text-sm text-[#777]">Belum ada kandang terdaftar.</p>
                                <Link href="/dashboard/kamar" className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90">
                                    Tambah kandang pertama <ChevronRight size={15} />
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="font-inter text-sm text-[#777]">{unknownCount > 0 ? "Sebagian data kandang gagal dimuat." : "Belum ada siklus berjalan."}</p>
                                <Link href={`/dashboard/kamar/${snapshots[0].room.id}`} className="mt-3 inline-flex items-center gap-1.5 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90">
                                    <Sprout size={15} /> Mulai siklus di Kandang {snapshots[0].room.number}
                                </Link>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {active.map((s) => <KandangCard key={s.room.id} snapshot={s} />)}
                    </div>
                )}
            </section>

            {resting.length > 0 && (
                <section>
                    <h3 className="mb-3 font-poppins text-base font-semibold text-[#2F2F2F]">Istirahat ({resting.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {resting.map((s) => (
                            <Link
                                key={s.room.id}
                                href={`/dashboard/kamar/${s.room.id}`}
                                className="rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#555] transition hover:border-[#7B1113]/30 hover:text-[#7B1113]"
                            >
                                Kandang {s.room.number}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="rounded-3xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 font-inter text-xs text-[#999]">{icon} {label}</div>
            <p className="mt-2 font-poppins text-xl font-bold text-[#2F2F2F] sm:text-2xl">{value}</p>
            <p className="mt-1 truncate font-inter text-xs text-[#999]">{sub}</p>
        </div>
    );
}

function KandangCard({ snapshot: s }: { snapshot: KandangSnapshot }) {
    const status = worstStatus(s);
    const style = STATUS_STYLE[status];
    const progress = s.ageDays != null ? Math.min(100, (s.ageDays / s.harvestTargetDays) * 100) : 0;
    const topAlert = s.insights.alerts.filter((a) => a.tier !== "info").sort((a, b) => ALERT_TIER_ORDER[a.tier] - ALERT_TIER_ORDER[b.tier])[0];
    const dev = s.insights.waterDeviation;

    return (
        <Link href={`/dashboard/kamar/${s.room.id}`} className={`block rounded-3xl border bg-white p-5 transition hover:shadow-md ${style.ring}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-poppins text-base font-bold text-[#2F2F2F]">Kandang {s.room.number}</p>
                    <p className="font-inter text-xs text-[#999]">Hari ke-{s.ageDays} dari {s.harvestTargetDays}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-inter text-xs font-semibold ${style.pill}`}>{style.label}</span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
                <div className="h-full rounded-full bg-[#7B1113]" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 font-inter">
                <Metric label="Populasi" value={s.populationNow != null ? s.populationNow.toLocaleString("id-ID") : "—"} />
                <Metric
                    label="Air"
                    value={dev ? `${dev.pct >= 0 ? "+" : ""}${dev.pct.toFixed(0)}%` : s.todayUsage.waterTodayLiter != null ? `${s.todayUsage.waterTodayLiter.toFixed(0)} L` : "—"}
                    tone={dev?.tier === "kritis" ? "text-[#B42318]" : dev?.tier === "waspada" ? "text-[#B76E00]" : undefined}
                />
                <Metric
                    label="Daya"
                    value={s.insights.actualPowerKw != null ? `${s.insights.actualPowerKw.toFixed(1)} kW` : "—"}
                    tone={s.insights.powerDeviation?.tier === "kritis" ? "text-[#B42318]" : s.insights.powerDeviation?.tier === "waspada" ? "text-[#B76E00]" : undefined}
                />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#F0F0F0] pt-3">
                <p className={`min-w-0 truncate font-inter text-xs ${topAlert ? "font-medium text-[#2F2F2F]" : "text-[#999]"}`}>
                    {topAlert ? topAlert.title : !s.guardAvailable ? "Belum ada data" : s.telemetryAvailable ? "Tidak ada peringatan" : "Menunggu data alat"}
                </p>
                <span className={`flex shrink-0 items-center gap-1 font-inter text-xs ${s.online ? "text-green-700" : "text-[#999]"}`}>
                    {s.online ? <Wifi size={12} /> : <WifiOff size={12} />}
                    <ChevronRight size={14} className="text-[#CCC]" />
                </span>
            </div>
        </Link>
    );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-2xl bg-[#FAFAFA] px-2.5 py-2">
            <p className="text-[11px] text-[#999]">{label}</p>
            <p className={`mt-0.5 font-poppins text-sm font-semibold ${tone ?? "text-[#2F2F2F]"}`}>{value}</p>
        </div>
    );
}
