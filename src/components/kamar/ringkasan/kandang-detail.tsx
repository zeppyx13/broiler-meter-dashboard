"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { ArrowLeft, Wifi, WifiOff, ClipboardPlus, Flag, Pencil, Sprout, AlertTriangle, Power, Bot, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { localDateKey } from "@/lib/broiler-local-store";
import { writeData } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import RoomFormModal, { type CoopFormPayload } from "../room-form-modal";
import { useKandangData } from "./use-kandang-data";
import KandangRingkasan from "./kandang-ringkasan";
import CatatHarianTab from "./catat-harian-tab";
import PeralatanTab from "./peralatan-tab";
import KandangSettingsTab from "./kandang-settings-tab";
import DailyRecordModal from "./daily-record-modal";
import { CycleCloseModal, CycleStartModal } from "./cycle-modals";
import RelayModal from "./relay-modal";
import { askCopilot } from "@/lib/copilot-context";
import RiwayatSiklusTab from "./riwayat-siklus-tab";
import { apiErrorMessage } from "@/lib/api-error";

type Tab = "ringkasan" | "harian" | "riwayat" | "peralatan" | "pengaturan";

const TABS: { key: Tab; label: string }[] = [
    { key: "ringkasan", label: "Ringkasan" },
    { key: "harian", label: "Catat Harian" },
    { key: "riwayat", label: "Riwayat" },
    { key: "peralatan", label: "Peralatan" },
    { key: "pengaturan", label: "Pengaturan" },
];

export default function KandangDetail({ roomId }: { roomId: number }) {
    const data = useKandangData(roomId);
    const { room, isLoading, isError, live, online, activeCycle, cycle, ageDays, harvestTargetDays, canOperate, canManage, canRelay } = data;
    const b = useBroiler();
    // Hak akses (capability) dihitung per kandang terpilih, jadi pilih kandang ini di konteks.
    const { loading: contextLoading, coopId: selectedCoopId, coops, selectCoop } = b;
    useEffect(() => {
        if (!contextLoading && selectedCoopId !== roomId && coops.some((c) => c.id === roomId)) selectCoop(roomId);
    }, [contextLoading, selectedCoopId, roomId, coops, selectCoop]);

    const [tab, setTab] = useState<Tab>("ringkasan");
    const [startOpen, setStartOpen] = useState(false);
    const [editCycleOpen, setEditCycleOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [recordDate, setRecordDate] = useState<string | null>(null);
    const [roomFormOpen, setRoomFormOpen] = useState(false);
    const [relayOpen, setRelayOpen] = useState(false);

    if (isLoading) return <div className="h-96 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />;
    if (isError || !room) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-inter text-sm text-red-600">
                Kandang tidak tersedia atau akun Anda tidak punya akses ke kandang ini. <Link href="/dashboard/kamar" className="font-semibold underline">Kembali</Link>
            </div>
        );
    }

    const recordedToday = cycle?.records.some((r) => r.date === localDateKey()) ?? false;
    const progressPct = ageDays != null ? Math.min(100, (ageDays / harvestTargetDays) * 100) : 0;
    const looksStale = ageDays != null && ageDays > harvestTargetDays + 14;

    const farmName = b.farms.find((f) => f.id === room.floor)?.name ?? "Lahan —";

    async function handleRoomUpdate(payload: CoopFormPayload) {
        try {
            // Lahan kandang tidak bisa dipindah dari form ini.
            await writeData("patch", `/api/coops/${room!.id}`, {
                code: payload.code, name: payload.name, capacity_birds: payload.capacity_birds, description: payload.description,
            });
            await b.refresh();
            data.refreshAll();
            setRoomFormOpen(false);
            Swal.fire({ icon: "success", title: "Kandang diperbarui", timer: 1300, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <Link href="/dashboard/kamar" className="inline-flex items-center gap-1.5 font-inter text-sm text-[#777] hover:text-[#7B1113]">
                    <ArrowLeft size={14} /> Semua kandang
                </Link>
                <KandangPager roomId={room.id} />
            </div>

            {/* Header + siklus */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="font-poppins text-2xl font-bold text-[#2F2F2F]">
                            Kandang {room.number}
                            {data.coop?.name && data.coop.name !== room.number && <span className="font-inter text-lg font-normal text-[#777]"> · {data.coop.name}</span>}
                        </h2>
                        <p className="mt-0.5 font-inter text-sm text-[#999]">
                            {farmName}
                            {cycle?.extra.strain && ` · ${cycle.extra.strain}`}
                        </p>
                    </div>
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-inter text-xs font-medium ${online ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {online ? "Perangkat online" : "Perangkat offline"}
                        {live?.recorded_at && ` · ${new Date(live.recorded_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                </div>

                {activeCycle && cycle ? (
                    <div className="mt-5">
                        <div className="flex flex-wrap items-end justify-between gap-2 font-inter text-sm">
                            <p className="text-[#555]">
                                <span className="font-poppins text-lg font-bold text-[#2F2F2F]">Hari ke-{ageDays}</span>
                                <span className="text-[#999]"> dari target {harvestTargetDays}</span>
                            </p>
                            <p className="text-[#555]">
                                {cycle.populationNow != null
                                    ? <><span className="font-semibold text-[#2F2F2F]">{cycle.populationNow.toLocaleString("id-ID")}</span> ekor</>
                                    : "Populasi belum diisi"}
                                {cycle.depletionPct != null && <span className="text-[#999]"> · deplesi {cycle.depletionPct.toFixed(1)}%</span>}
                            </p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
                            <div className="h-full rounded-full bg-[#7B1113]" style={{ width: `${progressPct}%` }} />
                        </div>

                        {looksStale && (
                            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF4E5] px-4 py-3 font-inter text-xs text-[#9A6B14]">
                                <AlertTriangle size={14} className="mt-px shrink-0" />
                                Siklus ini sudah berjalan {ageDays} hari, jauh melewati target panen. Jika ini data lama, tutup siklusnya.
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {canOperate && <button
                                onClick={() => setRecordDate(localDateKey())}
                                suppressHydrationWarning
                                className="relative flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 sm:w-auto"
                            >
                                <ClipboardPlus size={17} /> Catat Harian
                                {!recordedToday && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#C6A971]" title="Belum dicatat hari ini" />}
                            </button>}
                            <SecondaryActions roomId={room.id} onRelay={canRelay ? () => setRelayOpen(true) : undefined} onCopilot={() => askCopilot()} showReport />
                        </div>
                        {canOperate && <div className="mt-3 flex gap-4 font-inter text-sm">
                            <button onClick={() => setEditCycleOpen(true)} suppressHydrationWarning className="flex items-center gap-1.5 text-[#777] hover:text-[#7B1113]">
                                <Pencil size={14} /> Edit siklus
                            </button>
                            <button onClick={() => setCloseOpen(true)} suppressHydrationWarning className="flex items-center gap-1.5 text-[#777] hover:text-[#7B1113]">
                                <Flag size={14} /> Tutup siklus (panen)
                            </button>
                        </div>}
                    </div>
                ) : (
                    <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#F8F8F8] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">Kandang sedang istirahat</p>
                            <p className="font-inter text-xs text-[#999]">Mulai siklus baru saat DOC masuk (chick-in).</p>
                        </div>
                        {canOperate && <button
                            onClick={() => setStartOpen(true)}
                            suppressHydrationWarning
                            className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                        >
                            <Sprout size={17} /> Mulai Siklus Baru
                        </button>}
                    </div>
                )}
                {!activeCycle && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <SecondaryActions roomId={room.id} onRelay={canRelay ? () => setRelayOpen(true) : undefined} onCopilot={() => askCopilot()} />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex w-full overflow-x-auto rounded-2xl border border-[#EAEAEA] bg-white p-1 sm:w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        suppressHydrationWarning
                        className={`flex-1 whitespace-nowrap rounded-xl px-5 py-2.5 font-inter text-sm font-medium transition sm:flex-none ${tab === t.key ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "ringkasan" && (
                <KandangRingkasan data={data} onEditCycle={() => setEditCycleOpen(true)} onOpenEquipment={() => setTab("peralatan")} />
            )}
            {tab === "harian" && <CatatHarianTab data={data} onOpenRecord={(date) => setRecordDate(date ?? localDateKey())} />}
            {tab === "riwayat" && <RiwayatSiklusTab data={data} />}
            {tab === "peralatan" && <PeralatanTab data={data} />}
            {tab === "pengaturan" && <KandangSettingsTab data={data} onEditRoom={canManage ? () => setRoomFormOpen(true) : undefined} />}

            {/* Modals */}
            <CycleStartModal open={startOpen} onClose={() => setStartOpen(false)} data={data} onSaved={data.refreshAll} />
            {activeCycle && (
                <>
                    <CycleStartModal open={editCycleOpen} onClose={() => setEditCycleOpen(false)} data={data} editing onSaved={data.refreshAll} />
                    <CycleCloseModal open={closeOpen} onClose={() => setCloseOpen(false)} data={data} onSaved={data.refreshAll} />
                    <DailyRecordModal
                        open={recordDate != null}
                        onClose={() => setRecordDate(null)}
                        data={data}
                        initialDate={recordDate ?? undefined}
                        onSaved={data.refreshAll}
                    />
                </>
            )}
            <RoomFormModal open={roomFormOpen} editData={data.coop} farms={b.farms} onClose={() => setRoomFormOpen(false)} onSubmit={handleRoomUpdate} />
            <RelayModal open={relayOpen} onClose={() => setRelayOpen(false)} roomId={room.id} roomNumber={room.number} online={online} />
        </div>
    );
}

/** Pindah ke kandang sebelumnya/berikutnya (urut nama kandang) tanpa kembali ke daftar. */
function KandangPager({ roomId }: { roomId: number }) {
    const { coops } = useBroiler();
    const rooms = [...coops].map((c) => ({ id: c.id, number: c.code })).sort((a, b) => a.number.localeCompare(b.number, "id", { numeric: true }));
    const index = rooms.findIndex((r) => r.id === roomId);
    if (index < 0 || rooms.length < 2) return null;
    const prev = rooms[index - 1];
    const next = rooms[index + 1];

    const cls = "flex items-center gap-1 rounded-xl border border-[#EAEAEA] bg-white px-3 py-1.5 font-inter text-sm font-medium text-[#555] transition hover:border-[#7B1113]/30 hover:text-[#7B1113]";
    const disabled = "flex items-center gap-1 rounded-xl border border-[#F0F0F0] px-3 py-1.5 font-inter text-sm text-[#CCC]";
    return (
        <nav aria-label="Kandang lain" className="flex items-center gap-2">
            {prev ? (
                <Link href={`/dashboard/kamar/${prev.id}`} className={cls} aria-label={`Kandang sebelumnya: ${prev.number}`}>
                    <ChevronLeft size={15} /> {prev.number}
                </Link>
            ) : (
                <span className={disabled} aria-hidden><ChevronLeft size={15} /> Awal</span>
            )}
            <span className="hidden font-inter text-xs text-[#999] sm:inline">{index + 1} / {rooms.length}</span>
            {next ? (
                <Link href={`/dashboard/kamar/${next.id}`} className={cls} aria-label={`Kandang berikutnya: ${next.number}`}>
                    {next.number} <ChevronRight size={15} />
                </Link>
            ) : (
                <span className={disabled} aria-hidden>Akhir <ChevronRight size={15} /></span>
            )}
        </nav>
    );
}

function SecondaryActions({ roomId, onRelay, onCopilot, showReport }: { roomId: number; onRelay?: () => void; onCopilot: () => void; showReport?: boolean }) {
    const cls = "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-3 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8] sm:flex-none";
    return (
        <>
            {onRelay && <button onClick={onRelay} suppressHydrationWarning className={cls}>
                <Power size={15} /> Relay
            </button>}
            <button onClick={onCopilot} suppressHydrationWarning className={cls}>
                <Bot size={15} /> Copilot
            </button>
            {showReport && (
                <Link href={`/dashboard/tagihan?kandang=${roomId}`} className={cls}>
                    <FileText size={15} /> Laporan
                </Link>
            )}
        </>
    );
}
