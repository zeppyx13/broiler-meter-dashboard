"use client";

import { useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { ArrowLeft, Wifi, WifiOff, ClipboardPlus, Flag, Pencil, Sprout, AlertTriangle } from "lucide-react";
import { updateRoom } from "@/lib/room-api";
import { localDateKey, setRoomExtra, type RoomExtra } from "@/lib/broiler-local-store";
import type { RoomFormPayload } from "@/types/room";
import RoomFormModal from "../room-form-modal";
import { useKandangData } from "./use-kandang-data";
import KandangRingkasan from "./kandang-ringkasan";
import CatatHarianTab from "./catat-harian-tab";
import KandangSettingsTab from "./kandang-settings-tab";
import DailyRecordModal from "./daily-record-modal";
import { CycleCloseModal, CycleStartModal } from "./cycle-modals";

type Tab = "ringkasan" | "harian" | "pengaturan";

const TABS: { key: Tab; label: string }[] = [
    { key: "ringkasan", label: "Ringkasan" },
    { key: "harian", label: "Catat Harian" },
    { key: "pengaturan", label: "Pengaturan" },
];

export default function KandangDetail({ roomId }: { roomId: number }) {
    const data = useKandangData(roomId);
    const { room, isLoading, isError, live, online, activeCycle, cycle, ageDays, harvestTargetDays } = data;

    const [tab, setTab] = useState<Tab>("ringkasan");
    const [startOpen, setStartOpen] = useState(false);
    const [editCycleOpen, setEditCycleOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [recordDate, setRecordDate] = useState<string | null>(null);
    const [roomFormOpen, setRoomFormOpen] = useState(false);

    if (isLoading) return <div className="h-96 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />;
    if (isError || !room) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-inter text-sm text-red-600">
                Gagal memuat data kandang. <Link href="/dashboard/kamar" className="font-semibold underline">Kembali</Link>
            </div>
        );
    }

    const recordedToday = cycle?.records.some((r) => r.date === localDateKey()) ?? false;
    const progressPct = ageDays != null ? Math.min(100, (ageDays / harvestTargetDays) * 100) : 0;
    const looksStale = ageDays != null && ageDays > harvestTargetDays + 14;

    async function handleRoomUpdate(payload: RoomFormPayload, extra: RoomExtra) {
        try {
            await updateRoom(room!.id, payload);
            setRoomExtra(room!.id, extra);
            data.refreshAll();
            setRoomFormOpen(false);
            Swal.fire({ icon: "success", title: "Kandang diperbarui", timer: 1300, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: err?.response?.data?.message || "Terjadi kesalahan.", confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="space-y-5">
            <Link href="/dashboard/kamar" className="inline-flex items-center gap-1.5 font-inter text-sm text-[#777] hover:text-[#7B1113]">
                <ArrowLeft size={14} /> Semua kandang
            </Link>

            {/* Header + siklus */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="font-poppins text-2xl font-bold text-[#2F2F2F]">Kandang {room.number}</h2>
                        <p className="mt-0.5 font-inter text-sm text-[#999]">
                            {room.floor != null ? `Blok ${room.floor}` : "Blok —"}
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

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => setRecordDate(localDateKey())}
                                suppressHydrationWarning
                                className="relative flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90 sm:flex-none"
                            >
                                <ClipboardPlus size={17} /> Catat Harian
                                {!recordedToday && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#C6A971]" title="Belum dicatat hari ini" />}
                            </button>
                            <button
                                onClick={() => setCloseOpen(true)}
                                suppressHydrationWarning
                                className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-3 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                            >
                                <Flag size={15} /> Tutup Siklus
                            </button>
                            <button
                                onClick={() => setEditCycleOpen(true)}
                                suppressHydrationWarning
                                className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] px-4 py-3 font-inter text-sm font-medium text-[#555] transition hover:bg-[#F8F8F8]"
                            >
                                <Pencil size={15} /> Edit Siklus
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#F8F8F8] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">Kandang sedang istirahat</p>
                            <p className="font-inter text-xs text-[#999]">Mulai siklus baru saat DOC masuk (chick-in).</p>
                        </div>
                        <button
                            onClick={() => setStartOpen(true)}
                            suppressHydrationWarning
                            className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-3 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                        >
                            <Sprout size={17} /> Mulai Siklus Baru
                        </button>
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
                <KandangRingkasan data={data} onEditCycle={() => setEditCycleOpen(true)} onEditRoom={() => setRoomFormOpen(true)} />
            )}
            {tab === "harian" && <CatatHarianTab data={data} onOpenRecord={(date) => setRecordDate(date ?? localDateKey())} />}
            {tab === "pengaturan" && <KandangSettingsTab data={data} onEditRoom={() => setRoomFormOpen(true)} />}

            {/* Modals */}
            <CycleStartModal open={startOpen} onClose={() => setStartOpen(false)} room={room} live={live} onSaved={data.refreshAll} />
            {activeCycle && (
                <>
                    <CycleStartModal open={editCycleOpen} onClose={() => setEditCycleOpen(false)} room={room} live={live} editCycle={activeCycle} onSaved={data.refreshAll} />
                    <CycleCloseModal
                        open={closeOpen}
                        onClose={() => setCloseOpen(false)}
                        cycle={activeCycle}
                        roomNumber={room.number}
                        populationNow={cycle?.populationNow}
                        live={live}
                        onSaved={data.refreshAll}
                    />
                    <DailyRecordModal
                        open={recordDate != null}
                        onClose={() => setRecordDate(null)}
                        leaseId={activeCycle.id}
                        startDate={activeCycle.start_date}
                        initialDate={recordDate ?? undefined}
                        onSaved={data.refreshLocal}
                    />
                </>
            )}
            <RoomFormModal open={roomFormOpen} editData={room} onClose={() => setRoomFormOpen(false)} onSubmit={handleRoomUpdate} />
        </div>
    );
}
