"use client";

import { useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { Power, PowerOff, LoaderCircle, WifiOff } from "lucide-react";
import { sendRelayCommand, type RelayCommand } from "@/lib/relay-api";
import { CancelButton, ModalShell } from "./form-parts";
import { apiErrorMessage } from "@/lib/api-error";

type Props = {
    open: boolean;
    onClose: () => void;
    roomId: number;
    roomNumber: string;
    online: boolean;
};

const LABEL: Record<RelayCommand, string> = { relay_on: "menyalakan", relay_off: "mematikan" };

export default function RelayModal({ open, onClose, roomId, roomNumber, online }: Props) {
    const [sending, setSending] = useState<RelayCommand | null>(null);
    const [lastSent, setLastSent] = useState<{ command: RelayCommand; at: Date } | null>(null);

    async function send(command: RelayCommand) {
        const confirm = await Swal.fire({
            title: `Yakin ${LABEL[command]} relay?`,
            text: `Kandang ${roomNumber} — lampu/pemanas yang tersambung ke relay akan ${command === "relay_on" ? "menyala" : "mati"}.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, kirim",
            cancelButtonText: "Batal",
            confirmButtonColor: command === "relay_off" ? "#b91c1c" : "#7B1113",
        });
        if (!confirm.isConfirmed) return;

        setSending(command);
        try {
            await sendRelayCommand(roomId, command);
            setLastSent({ command, at: new Date() });
            Swal.fire({ icon: "success", title: "Perintah terkirim", timer: 1300, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Gagal mengirim", text: apiErrorMessage(err), confirmButtonColor: "#7B1113" });
        } finally {
            setSending(null);
        }
    }

    if (!open) return null;

    return (
        <ModalShell
            title="Kontrol Relay"
            subtitle={`Kandang ${roomNumber} · lampu / pemanas`}
            onClose={onClose}
            footer={<CancelButton onClick={onClose} />}
        >
            {!online && (
                <p className="flex items-start gap-2 rounded-2xl bg-[#FFF4E5] px-4 py-3 font-inter text-sm text-[#9A6B14]">
                    <WifiOff size={16} className="mt-0.5 shrink-0" />
                    Perangkat sedang offline, jadi perintah kemungkinan tidak sampai ke alat.
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => send("relay_on")}
                    disabled={sending != null}
                    suppressHydrationWarning
                    className="flex flex-col items-center gap-2 rounded-3xl border border-green-200 bg-green-50 px-4 py-6 font-poppins text-base font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                    {sending === "relay_on" ? <LoaderCircle size={28} className="animate-spin" /> : <Power size={28} />}
                    Nyalakan
                </button>
                <button
                    onClick={() => send("relay_off")}
                    disabled={sending != null}
                    suppressHydrationWarning
                    className="flex flex-col items-center gap-2 rounded-3xl border border-red-200 bg-red-50 px-4 py-6 font-poppins text-base font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                    {sending === "relay_off" ? <LoaderCircle size={28} className="animate-spin" /> : <PowerOff size={28} />}
                    Matikan
                </button>
            </div>

            {lastSent && (
                <p className="font-inter text-xs text-[#777]">
                    Perintah terakhir: <span className="font-medium text-[#2F2F2F]">{lastSent.command === "relay_on" ? "nyalakan" : "matikan"}</span> pukul{" "}
                    {lastSent.at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.
                </p>
            )}

            <p className="font-inter text-xs text-[#999]">
                Alat tidak melaporkan posisi relay, jadi pastikan hasilnya langsung di kandang. Perintah lain (reboot, sinkron waktu) ada di{" "}
                <Link href="/dashboard/iot" className="font-medium text-[#7B1113] hover:underline">Alat IoT</Link>.
            </p>
        </ModalShell>
    );
}
