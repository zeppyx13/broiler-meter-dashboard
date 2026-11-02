"use client";

import Link from "next/link";
import SectionCard from "../section-card";

type RoomItem = {
    room_id: number;
    room_number: string;
    room_floor: number;
    tenant_name: string | null;
    status: string;
    bill_amount: string;
};

type RoomsTableProps = {
    rooms: RoomItem[];
};

export default function RoomsTable({ rooms }: RoomsTableProps) {
    return (
        <SectionCard className="xl:col-span-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-inter text-sm text-[#666]">Monitoring Kamar</p>
                    <h3 className="mt-1 font-poppins text-xl font-semibold text-[#2F2F2F]">
                        Status Kamar & Tagihan
                    </h3>
                </div>

                <Link
                    href="/dashboard/kamar"
                    className="rounded-2xl bg-[#7B1113] px-4 py-2 font-poppins text-sm font-semibold text-[#C6A971] transition hover:opacity-90"
                >
                    Lihat Semua
                </Link>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                        <tr>
                            <th className="text-left font-inter text-xs text-[#777]">Kamar</th>
                            <th className="text-left font-inter text-xs text-[#777]">Penghuni</th>
                            <th className="text-left font-inter text-xs text-[#777]">Status</th>
                            <th className="text-left font-inter text-xs text-[#777]">Tagihan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map((room) => (
                            <tr key={room.room_id} className="bg-[#FAFAFA]">
                                <td className="rounded-l-2xl px-4 py-4 font-inter text-sm font-medium">
                                    {room.room_number}
                                </td>

                                <td className="px-4 py-4 font-inter text-sm text-[#666]">
                                    {room.tenant_name ?? "-"}
                                </td>

                                <td className="px-4 py-4">
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${room.status === "Terisi"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-700"
                                            }`}
                                    >
                                        {room.status}
                                    </span>
                                </td>

                                <td className="rounded-r-2xl px-4 py-4 font-inter text-sm">
                                    Rp {Number(room.bill_amount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}