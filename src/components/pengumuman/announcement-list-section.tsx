"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus } from "lucide-react";
import Swal from "sweetalert2";
import AnnouncementFormModal from "./announcement-form-modal";
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/announcement-api";
import type { Announcement, AnnouncementFormPayload } from "@/types/announcement";

const LIMIT = 10;

const FILTER_OPTIONS = [
    { label: "Semua", value: undefined },
    { label: "Aktif", value: 1 },
    { label: "Nonaktif", value: 0 },
];

export default function AnnouncementListSection() {
    const queryClient = useQueryClient();
    const [isActive, setIsActive] = useState<number | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<Announcement | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["announcements-admin", isActive, page],
        queryFn: () => getAnnouncements({ is_active: isActive, page, limit: LIMIT }),
        staleTime: 30 * 1000,
    });

    const announcements = data?.announcements ?? [];
    const meta = data?.meta;
    const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

    function handleTambah() { setEditData(null); setModalOpen(true); }
    function handleEdit(a: Announcement) { setEditData(a); setModalOpen(true); }

    async function handleDelete(a: Announcement) {
        const result = await Swal.fire({
            title: "Hapus pengumuman ini?",
            text: `"${a.title}"`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (!result.isConfirmed) return;
        try {
            await deleteAnnouncement(a.id);
            queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
            Swal.fire({ icon: "success", title: "Dihapus", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({ icon: "error", title: "Gagal menghapus", text: err?.response?.data?.message || "Terjadi kesalahan.", confirmButtonColor: "#7B1113" });
        }
    }

    const handleSubmit = useCallback(async (payload: AnnouncementFormPayload) => {
        try {
            if (editData) {
                await updateAnnouncement(editData.id, payload);
            } else {
                await createAnnouncement(payload);
            }
            queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
            setModalOpen(false);
            Swal.fire({ icon: "success", title: editData ? "Diperbarui" : "Pengumuman dibuat", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire({ icon: "error", title: "Gagal menyimpan", text: err?.response?.data?.message || "Terjadi kesalahan.", confirmButtonColor: "#7B1113" });
        }
    }, [editData, queryClient]);

    return (
        <div className="space-y-4">
            {/* Filter + Tombol Tambah */}
            <div className="flex items-center justify-between">
                <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={String(opt.value)}
                            onClick={() => { setIsActive(opt.value); setPage(1); }}
                            suppressHydrationWarning
                            className={`px-4 py-2.5 font-inter text-sm transition-colors ${isActive === opt.value
                                ? "bg-[#7B1113] text-white"
                                : "text-[#666] hover:bg-[#F8F8F8]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleTambah}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl bg-[#7B1113] px-5 py-2.5 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                >
                    <Plus size={16} />
                    Buat Pengumuman
                </button>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data pengumuman.
                </div>
            )}

            {!isLoading && !isError && announcements.length === 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                    <p className="font-inter text-sm text-[#999]">Belum ada pengumuman.</p>
                </div>
            )}

            {/* Card list — lebih cocok dari tabel untuk konten panjang */}
            {!isLoading && !isError && announcements.map((a) => (
                <div key={a.id} className="rounded-3xl border border-[#EAEAEA] bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-poppins text-sm font-semibold text-[#2F2F2F]">{a.title}</h4>
                                <span className={`rounded-full px-2.5 py-0.5 font-inter text-xs font-medium ${Boolean(a.is_active)
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                    }`}>
                                    {Boolean(a.is_active) ? "Aktif" : "Nonaktif"}
                                </span>
                            </div>
                            <p className="mt-1.5 font-inter text-sm text-[#666] line-clamp-2">{a.body}</p>
                            <div className="mt-2 flex flex-wrap gap-3">
                                <span className="font-inter text-xs text-[#999]">
                                    Dibuat: {new Date(a.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                                {a.start_at && (
                                    <span className="font-inter text-xs text-[#999]">
                                        Mulai: {new Date(a.start_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                )}
                                {a.end_at && (
                                    <span className="font-inter text-xs text-[#999]">
                                        Berakhir: {new Date(a.end_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                title="Edit"
                                onClick={() => handleEdit(a)}
                                suppressHydrationWarning
                                className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                            >
                                <Pencil size={15} className="text-[#555]" />
                            </button>
                            <button
                                title="Hapus"
                                onClick={() => handleDelete(a)}
                                suppressHydrationWarning
                                className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100"
                            >
                                <Trash2 size={15} className="text-red-500" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="font-inter text-sm text-[#777]">
                        Halaman {page} dari {totalPages} · Total {meta?.total} pengumuman
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            suppressHydrationWarning
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            suppressHydrationWarning
                            className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8] disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            <AnnouncementFormModal
                open={modalOpen}
                editData={editData}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}