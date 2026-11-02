"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Tenant } from "@/types/tenant";

type Props = {
    tenants: Tenant[];
    onEdit: (tenant: Tenant) => void;
    onDelete: (tenant: Tenant) => void;
};

const ROLE_STYLE: Record<string, string> = {
    tenant: "bg-blue-100 text-blue-700",
    admin: "bg-purple-100 text-purple-700",
    manager: "bg-amber-100 text-amber-700",
};

export default function TenantTable({ tenants, onEdit, onDelete }: Props) {
    if (tenants.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">Tidak ada penghuni ditemukan.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#EAEAEA] bg-white">
            <table className="min-w-full">
                <thead>
                    <tr className="border-b border-[#EAEAEA]">
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Nama</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Email</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">No. HP</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Role</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Kamar</th>
                        <th className="px-6 py-4 text-left font-inter text-xs font-medium text-[#777]">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {tenants.map((t, i) => {
                        const isLast = i === tenants.length - 1;
                        return (
                            <tr
                                key={t.id}
                                className={`transition hover:bg-[#FAFAFA] ${!isLast ? "border-b border-[#F0F0F0]" : ""}`}
                            >
                                <td className="px-6 py-4">
                                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">{t.name}</p>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{t.email}</td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">{t.phone ?? "-"}</td>
                                <td className="px-6 py-4">
                                    <span className={`rounded-full px-3 py-1 font-inter text-xs font-medium ${ROLE_STYLE[t.role] ?? "bg-gray-100 text-gray-700"}`}>
                                        {t.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-inter text-sm text-[#666]">
                                    {t.room_number ? `Kamar ${t.room_number}` : "-"}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            title="Edit"
                                            onClick={() => onEdit(t)}
                                            className="rounded-xl bg-[#F8F8F8] p-2 transition hover:bg-[#EAEAEA]"
                                        >
                                            <Pencil size={15} className="text-[#555]" />
                                        </button>
                                        <button
                                            title="Hapus"
                                            onClick={() => onDelete(t)}
                                            className="rounded-xl bg-red-50 p-2 transition hover:bg-red-100"
                                        >
                                            <Trash2 size={15} className="text-red-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}