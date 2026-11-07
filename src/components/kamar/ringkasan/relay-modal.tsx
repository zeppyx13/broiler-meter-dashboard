"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Swal from "sweetalert2";
import { Power, PowerOff, LoaderCircle, WifiOff } from "lucide-react";
import { readData, writeData } from "@/lib/broiler-api";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { CancelButton, ModalShell } from "./form-parts";
import { apiErrorMessage } from "@/lib/api-error";
import type { RelayPreflight } from "@/components/broiler/operations/safety";

type Props = {
    open: boolean;
    onClose: () => void;
    roomId: number;
    roomNumber: string;
    online: boolean;
};

type RelayCommand = "relay_on" | "relay_off";
type RelayRow = { id: number; name: string; channel: number; is_enabled: boolean | number; desired_state?: string | null; reported_state?: string | null };

const LABEL: Record<RelayCommand, string> = { relay_on: "menyalakan", relay_off: "mematikan" };

export default function RelayModal({ open, onClose, roomId, roomNumber, online }: Props) {
    const b = useBroiler();
    const relays = useQuery({
        queryKey: ["broiler", b.user?.id, roomId, "relays"],
        queryFn: ({ signal }) => readData<{ relays: RelayRow[] }>("/api/relays", { coop_id: roomId, page: 1, limit: 20 }, { signal }),
        enabled: open && Boolean(b.user),
        refetchInterval: open ? 5000 : false,
    });
    const relay = (relays.data?.relays ?? []).find((r) => Boolean(Number(r.is_enabled)));
    const preflight = useQuery({
        queryKey: ["broiler", b.user?.id, roomId, "relay-preflight", relay?.id],
        queryFn: ({ signal }) => readData<RelayPreflight>(`/api/relays/${relay!.id}/preflight`, undefined, { signal }),
        enabled: open && Boolean(b.user && relay) && b.source === "real", refetchInterval: open ? 5000 : false,
    });
    const blocked = b.source !== "real" ? "Relay hanya bisa dikendalikan pada mode Sensor (bukan Simulasi)." : !b.canRelay ? "Akun Anda tidak punya izin mengendalikan relay di kandang ini." : relays.error ? apiErrorMessage(relays.error) : relays.isSuccess && !relay ? "Belum ada relay aktif yang terdaftar di kandang ini." : preflight.error ? apiErrorMessage(preflight.error) : !preflight.data ? "Memeriksa perangkat…" : !preflight.data.allowed ? preflight.data.reason : null;
    const [sending, setSending] = useState<RelayCommand | null>(null);
    const [lastSent, setLastSent] = useState<{ command: RelayCommand; at: Date } | null>(null);
    const inFlight = useRef(false);
    const scope = `${b.user?.id}:${roomId}:${b.source}:${open}`;
    const currentScope = useRef(scope);
    useEffect(() => { currentScope.current = scope; setLastSent(null); setSending(null); return () => { currentScope.current = ""; }; }, [scope]);

    async function send(command: RelayCommand) {
        if (blocked || !relay || inFlight.current) return;
        const requestedScope = scope;
        inFlight.current = true; setSending(command);
        try {
        const confirm = await Swal.fire({
            title: `Yakin ${LABEL[command]} relay?`,
            text: `Kandang ${roomNumber} · ${relay.name}. Beban terhubung dapat berubah. Publikasi belum membuktikan hasil fisik.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, kirim",
            cancelButtonText: "Batal",
            confirmButtonColor: command === "relay_off" ? "#b91c1c" : "#7B1113",
        });
        if (!confirm.isConfirmed || currentScope.current !== requestedScope) return;
            const latest = await preflight.refetch();
            if (currentScope.current !== requestedScope) return;
            if (latest.isError) throw latest.error;
            if (!latest.data?.allowed) throw new Error(latest.data?.reason || "Preflight server belum tersedia.");
            // Tidak idempoten di server: jangan retry otomatis.
            await writeData("post", `/api/relays/${relay.id}/commands`, { command: command === "relay_on" ? "on" : "off" });
            void relays.refetch();
            void preflight.refetch();
            if (currentScope.current !== requestedScope) return;
            setLastSent({ command, at: new Date() });
            Swal.fire({ icon: "info", title: "Permintaan tercatat", text: "Periksa histori publikasi dan laporan perangkat. Hasil fisik belum terkonfirmasi.", confirmButtonColor: "#7B1113" });
        } catch (err) {
            void relays.refetch(); void preflight.refetch();
            if (currentScope.current === requestedScope) Swal.fire({ icon: "error", title: "Permintaan belum terkonfirmasi", text: `${apiErrorMessage(err)}. Periksa histori sebelum mengirim permintaan baru.`, confirmButtonColor: "#7B1113" });
        } finally {
            inFlight.current = false;
            if (currentScope.current === requestedScope) setSending(null);
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
                    Perangkat belum online.
                </p>
            )}

            {blocked && <p className="rounded-2xl bg-[#F8F8F8] px-4 py-3 font-inter text-sm text-[#777]">{blocked}</p>}
            {relay && (
                <p className="font-inter text-xs text-[#777]">
                    {relay.name} · channel {relay.channel} · posisi dilaporkan alat: <span className="font-medium text-[#2F2F2F]">{relay.reported_state ?? "belum ada"}</span> · observasi, perlu verifikasi fisik
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => send("relay_on")}
                    disabled={sending != null || Boolean(blocked) || !relay}
                    suppressHydrationWarning
                    className="flex flex-col items-center gap-2 rounded-3xl border border-green-200 bg-green-50 px-4 py-6 font-poppins text-base font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                    {sending === "relay_on" ? <LoaderCircle size={28} className="animate-spin" /> : <Power size={28} />}
                    Nyalakan
                </button>
                <button
                    onClick={() => send("relay_off")}
                    disabled={sending != null || Boolean(blocked) || !relay}
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
                Perintah terkirim belum tentu berarti relay sudah berpindah — pastikan hasilnya langsung di kandang. Riwayat perintah dan pengaturan relay ada di{" "}
                <Link href="/dashboard/iot" className="font-medium text-[#7B1113] hover:underline">Alat IoT</Link>.
            </p>
        </ModalShell>
    );
}
