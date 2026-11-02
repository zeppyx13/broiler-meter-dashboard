"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import RoomFilterBar from "./room-filter-bar";
import RoomTable from "./room-table";
import RoomFormModal from "./room-form-modal";
import { getRooms, createRoom, updateRoom, deleteRoom } from "@/lib/room-api";
import type { Room, RoomFormPayload } from "@/types/room";

const LIMIT = 10;

export default function RoomListSection() {
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<"" | "0" | "1">("");
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<Room | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["rooms", search, status, page],
        queryFn: () =>
            getRooms({
                search: search || undefined,
                is_available: status || undefined,
                page,
                limit: LIMIT,
            }),
        staleTime: 30 * 1000,
    });

    const rooms = data?.rooms ?? [];
    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleSearchChange(v: string) {
        setSearch(v);
        setPage(1);
    }

    function handleStatusChange(v: "" | "0" | "1") {
        setStatus(v);
        setPage(1);
    }

    function handleTambah() {
        setEditData(null);
        setModalOpen(true);
    }

    function handleEdit(room: Room) {
        setEditData(room);
        setModalOpen(true);
    }

    async function handleDelete(room: Room) {
        const result = await Swal.fire({
            title: `Hapus Kamar ${room.number}?`,
            text: "Kamar yang dihapus tidak bisa dikembalikan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });

        if (!result.isConfirmed) return;

        try {
            await deleteRoom(room.id);
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            Swal.fire({
                icon: "success",
                title: "Kamar dihapus",
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal menghapus",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        }
    }

    const handleSubmit = useCallback(
        async (payload: RoomFormPayload) => {
            try {
                if (editData) {
                    await updateRoom(editData.id, payload);
                } else {
                    await createRoom(payload);
                }

                queryClient.invalidateQueries({ queryKey: ["rooms"] });
                setModalOpen(false);

                Swal.fire({
                    icon: "success",
                    title: editData ? "Kamar diperbarui" : "Kamar ditambahkan",
                    timer: 1500,
                    showConfirmButton: false,
                });
            } catch (err: any) {
                Swal.fire({
                    icon: "error",
                    title: "Gagal menyimpan",
                    text: err?.response?.data?.message || "Terjadi kesalahan.",
                    confirmButtonColor: "#7B1113",
                });
            }
        },
        [editData, queryClient]
    );

    return (
        <div className="space-y-4">
            <RoomFilterBar
                search={search}
                status={status}
                onSearchChange={handleSearchChange}
                onStatusChange={handleStatusChange}
                onTambah={handleTambah}
            />

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-white border border-[#EAEAEA]" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data kamar.
                </div>
            )}

            {!isLoading && !isError && (
                <RoomTable
                    rooms={rooms}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            )}

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} kamar
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            <RoomFormModal
                open={modalOpen}
                editData={editData}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}