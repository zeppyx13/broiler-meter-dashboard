"use client";

import { useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { Search, ChevronRight, Wifi, WifiOff, Plus, MapPin } from "lucide-react";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { useKandangSnapshots } from "@/lib/kandang-snapshot";
import { writeData } from "@/lib/broiler-api";
import { apiErrorMessage } from "@/lib/api-error";
import RoomFormModal, { MAX_KANDANG_PER_LAHAN, type CoopFormPayload } from "./room-form-modal";

type Filter = "all" | "aktif" | "istirahat";

export default function RoomOverviewSection() {
    const b = useBroiler();
    const { snapshots, isLoading, isError } = useKandangSnapshots();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [formFarmId, setFormFarmId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);

    const canManageFarm = (farmId: number) =>
        b.user?.role === "admin" || ["owner", "manager"].includes(b.farms.find((f) => f.id === farmId)?.member_role ?? "");
    const manageableFarms = b.farms.filter((f) => canManageFarm(f.id));

    const matches = snapshots.filter((s) => {
        const matchSearch = !search || `${s.room.number} ${b.coops.find((c) => c.id === s.room.id)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
        const active = Boolean(s.cycle);
        return matchSearch && (filter === "all" || (filter === "aktif" ? active : !active));
    });
    const activeCount = snapshots.filter((s) => s.cycle).length;
    const filtering = Boolean(search) || filter !== "all";

    // Kelompokkan per lahan (farm); lahan tanpa kandang tetap tampil agar bisa diisi.
    const groups = b.farms.map((farm) => ({
        farm,
        count: snapshots.filter((s) => s.room.floor === farm.id).length,
        items: matches.filter((s) => s.room.floor === farm.id),
    })).filter((g) => g.items.length > 0 || !filtering);

    function openForm(farmId: number | null) {
        setFormFarmId(farmId);
        setFormOpen(true);
    }

    async function handleCreate(payload: CoopFormPayload) {
        try {
            await writeData("post", "/api/coops", payload);
            await b.refresh();
            setFormOpen(false);
            Swal.fire({ icon: "success", title: "Kandang ditambahkan", timer: 1300, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        }
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Summary label="Total kandang" value={snapshots.length} />
                <Summary label="Aktif" value={activeCount} tone="green" />
                <Summary label="Istirahat" value={snapshots.length - activeCount} tone="gray" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2.5 sm:flex-none">
                        <Search size={15} className="text-[#999]" />
                        <input
                            type="text"
                            placeholder="Cari kandang..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            suppressHydrationWarning
                            className="w-full bg-transparent font-inter text-sm outline-none placeholder:text-[#999] sm:w-40"
                        />
                    </div>
                    <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                        {(["all", "aktif", "istirahat"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                suppressHydrationWarning
                                className={`px-4 py-2.5 font-inter text-sm transition-colors ${filter === f ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                            >
                                {f === "all" ? "Semua" : f === "aktif" ? "Aktif" : "Istirahat"}
                            </button>
                        ))}
                    </div>
                </div>
                {manageableFarms.length > 0 && (
                    <button
                        onClick={() => openForm(null)}
                        suppressHydrationWarning
                        className="flex items-center justify-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                    >
                        <Plus size={16} /> Tambah Kandang
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />)}
                </div>
            )}

            {isError && <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">Gagal memuat data kandang dari server.</div>}

            {!isLoading && b.farms.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-14 text-center font-inter text-sm text-[#999]">
                    Belum ada lahan. Tambahkan di Pengaturan.
                </div>
            )}

            {!isLoading && groups.map(({ farm, count, items }) => (
                <section key={farm.id} className="space-y-2">
                    <div className="flex items-end justify-between gap-3 px-1">
                        <div className="min-w-0">
                            <p className="font-poppins text-base font-semibold text-[#2F2F2F]">{farm.name}</p>
                            <p className="flex items-center gap-1 truncate font-inter text-xs text-[#999]">
                                <MapPin size={11} /> {farm.location_text ?? "Lokasi belum diisi"}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className={`font-inter text-xs ${count >= MAX_KANDANG_PER_LAHAN ? "font-medium text-[#B76E00]" : "text-[#999]"}`}>
                                {count}/{MAX_KANDANG_PER_LAHAN} kandang
                            </span>
                            {canManageFarm(farm.id) && count < MAX_KANDANG_PER_LAHAN && (
                                <button
                                    onClick={() => openForm(farm.id)}
                                    suppressHydrationWarning
                                    title={`Tambah kandang di ${farm.name}`}
                                    className="flex items-center gap-1 rounded-xl border border-[#EAEAEA] bg-white px-2.5 py-1.5 font-inter text-xs font-medium text-[#7B1113] transition hover:bg-[#F8F8F8]"
                                >
                                    <Plus size={13} /> Kandang
                                </button>
                            )}
                        </div>
                    </div>
                    {items.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-[#E0E0E0] px-5 py-6 text-center font-inter text-sm text-[#999]">
                            Belum ada kandang di lahan ini.
                        </div>
                    ) : (
                        <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white">
                            {items.map((s) => {
                                const coop = b.coops.find((c) => c.id === s.room.id);
                                return (
                                    <Link
                                        href={`/dashboard/kamar/${s.room.id}`}
                                        key={s.room.id}
                                        className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#FAFAFA]"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-poppins text-sm font-bold text-[#2F2F2F]">
                                                Kandang {s.room.number}
                                                {coop?.name && coop.name !== s.room.number && <span className="font-inter font-normal text-[#777]"> · {coop.name}</span>}
                                            </p>
                                            <p className="truncate font-inter text-xs text-[#999]">
                                                {s.cycle
                                                    ? `Hari ke-${s.ageDays}${s.populationNow ? ` · ${s.populationNow.toLocaleString("id-ID")} ekor` : ""}`
                                                    : "Siap untuk siklus baru"}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className={`hidden items-center gap-1 rounded-full px-2.5 py-1 font-inter text-xs font-medium sm:flex ${s.online ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                                {s.online ? <Wifi size={11} /> : <WifiOff size={11} />}
                                                {s.online ? "Online" : "Offline"}
                                            </span>
                                            {!s.online && <WifiOff size={14} className="text-gray-400 sm:hidden" />}
                                            <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${s.cycle ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                                {s.cycle ? "Aktif" : "Istirahat"}
                                            </span>
                                            <ChevronRight size={16} className="text-[#CCC]" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            ))}

            <RoomFormModal
                open={formOpen}
                farms={manageableFarms}
                defaultFarmId={formFarmId}
                onClose={() => setFormOpen(false)}
                onSubmit={handleCreate}
            />
        </div>
    );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "green" | "gray" }) {
    const color = tone === "green" ? "text-green-700" : tone === "gray" ? "text-[#777]" : "text-[#2F2F2F]";
    return (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-center">
            <p className="font-inter text-xs text-[#999]">{label}</p>
            <p className={`mt-1 font-poppins text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );
}
