"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, Power, PowerOff, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { socket } from "@/lib/socket";

type LiveStatus = {
    room_id: number;
    number: string;
    flow_rate_lpm: number;
    water_total_liter: number;
    voltage: number;
    current: number;
    power: number;
    energy_kwh_total: number;
    frequency: number;
    pf: number;
    recorded_at: string;
    updated_at: string;
};

type TelemetryUpdate = {
    room_id: number | string;
    flow_rate_lpm?: number;
    water_total_liter?: number;
    voltage?: number;
    current?: number;
    power?: number;
    energy_kwh_total?: number;
    frequency?: number;
    pf?: number;
    recorded_at?: string;
};

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getAllLiveStatus(): Promise<LiveStatus[]> {
    const response = await api.get("/api/iot/live-status", {
        headers: authHeader(),
    });
    return response.data.data ?? [];
}

async function sendRelay(roomId: number, command: "relay_on" | "relay_off" | "reset_nvs" | "sync_ntp" | "reboot" | "clear_buf" | "status") {
    const response = await api.post(
        `/api/iot/relay/${roomId}`,
        { command },
        { headers: authHeader() }
    );
    return response.data;
}

// Cek apakah data masih segar (dalam 2 menit)
function isOnline(recorded_at: string): boolean {
    if (!recorded_at) return false;
    const diff = Date.now() - new Date(recorded_at).getTime();
    return diff < 2 * 60 * 1000;
}

function formatTime(recorded_at: string): string {
    if (!recorded_at) return "-";
    return new Date(recorded_at).toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

export default function IotMonitorSection() {
    const [liveData, setLiveData] = useState<Record<number, LiveStatus>>({});
    const [relayLoading, setRelayLoading] = useState<Record<number, boolean>>({});

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["iot-live-status"],
        queryFn: getAllLiveStatus,
        refetchInterval: 5 * 1000,
        staleTime: 10 * 1000,
    });

    // Inisialisasi dari REST
    useEffect(() => {
        if (data) {
            const map: Record<number, LiveStatus> = {};
            data.forEach((d) => { map[d.room_id] = d; });
            setLiveData(map);
        }
    }, [data]);

    // Update realtime dari Socket.IO
    useEffect(() => {
        socket.connect();

        const onTelemetry = (payload: TelemetryUpdate) => {
            const roomId = Number(payload.room_id);
            if (!roomId) return;

            setLiveData((prev) => {
                const existing = prev[roomId] ?? {} as LiveStatus;
                return {
                    ...prev,
                    [roomId]: {
                        ...existing,
                        room_id: roomId,
                        flow_rate_lpm: payload.flow_rate_lpm ?? existing.flow_rate_lpm ?? 0,
                        water_total_liter: payload.water_total_liter ?? existing.water_total_liter ?? 0,
                        voltage: payload.voltage ?? existing.voltage ?? 0,
                        current: payload.current ?? existing.current ?? 0,
                        power: payload.power ?? existing.power ?? 0,
                        energy_kwh_total: payload.energy_kwh_total ?? existing.energy_kwh_total ?? 0,
                        frequency: payload.frequency ?? existing.frequency ?? 0,
                        pf: payload.pf ?? existing.pf ?? 0,
                        recorded_at: payload.recorded_at ?? new Date().toISOString(),
                    },
                };
            });
        };

        socket.on("telemetry_update", onTelemetry);

        return () => {
            socket.off("telemetry_update", onTelemetry);
            socket.disconnect();
        };
    }, []);

    async function handleRelay(roomId: number, roomNumber: string, command: "relay_on" | "relay_off" | "reset_nvs" | "sync_ntp" | "reboot" | "clear_buf" | "status") {
        const labelMap = {
            relay_on: "menyalakan relay",
            relay_off: "mematikan relay",
            reset_nvs: "reset NVS",
            sync_ntp: "sinkronisasi waktu NTP",
            reboot: "reboot perangkat",
            clear_buf: "bersihkan buffer offline",
            status: "cek status perangkat",
        };

        const result = await Swal.fire({
            title: `${labelMap[command].charAt(0).toUpperCase() + labelMap[command].slice(1)}?`,
            text: `Kamar ${roomNumber}`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, kirim",
            cancelButtonText: "Batal",
            confirmButtonColor: "#7B1113",
        });

        if (!result.isConfirmed) return;

        try {
            setRelayLoading((prev) => ({ ...prev, [roomId]: true }));
            await sendRelay(roomId, command);
            Swal.fire({
                icon: "success",
                title: "Perintah terkirim",
                text: `${command} → Kamar ${roomNumber}`,
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (err: any) {
            Swal.fire({
                icon: "error",
                title: "Gagal mengirim",
                text: err?.response?.data?.message || "Terjadi kesalahan.",
                confirmButtonColor: "#7B1113",
            });
        } finally {
            setRelayLoading((prev) => ({ ...prev, [roomId]: false }));
        }
    }

    const rooms = Object.values(liveData).sort((a, b) =>
        String(a.number ?? a.room_id).localeCompare(String(b.number ?? b.room_id))
    );

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                Gagal memuat data live IoT.
            </div>
        );
    }

    if (rooms.length === 0) {
        return (
            <div className="rounded-3xl border border-[#EAEAEA] bg-white px-6 py-16 text-center">
                <p className="font-inter text-sm text-[#999]">
                    Belum ada data telemetry. Pastikan ESP32 terhubung dan mengirim data.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between">
                <p className="font-inter text-sm text-[#777]">
                    {rooms.length} kamar terdeteksi ·{" "}
                    <span className="text-green-600 font-medium">
                        {rooms.filter((r) => isOnline(r.recorded_at)).length} online
                    </span>
                </p>
                <button
                    onClick={() => refetch()}
                    suppressHydrationWarning
                    className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-2 font-inter text-sm text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Grid kartu per kamar */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rooms.map((room) => {
                    const online = isOnline(room.recorded_at);
                    const loading = relayLoading[room.room_id] ?? false;

                    return (
                        <div
                            key={room.room_id}
                            className={`rounded-3xl border bg-white p-5 transition ${online ? "border-green-200" : "border-[#EAEAEA]"
                                }`}
                        >
                            {/* Header kamar */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-inter text-xs text-[#777]">Kamar</p>
                                    <h3 className="font-poppins text-lg font-bold text-[#2F2F2F]">
                                        {room.number ?? `#${room.room_id}`}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {online
                                        ? <Wifi size={16} className="text-green-500" />
                                        : <WifiOff size={16} className="text-gray-400" />
                                    }
                                    <span className={`font-inter text-xs font-medium ${online ? "text-green-600" : "text-gray-400"
                                        }`}>
                                        {online ? "Online" : "Offline"}
                                    </span>
                                </div>
                            </div>

                            <p className="mt-0.5 font-inter text-xs text-[#AAA]">
                                Update: {formatTime(room.recorded_at)}
                            </p>

                            {/* Data sensor — 2 kolom */}
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {/* Air */}
                                <div className="rounded-2xl bg-blue-50 p-3">
                                    <p className="font-inter text-xs text-blue-500">💧 Flow</p>
                                    <p className="mt-1 font-poppins text-lg font-bold text-blue-700">
                                        {Number(room.flow_rate_lpm ?? 0).toFixed(2)}
                                        <span className="font-inter text-xs font-normal ml-1">L/min</span>
                                    </p>
                                    <p className="font-inter text-xs text-blue-400 mt-0.5">
                                        Total: {Number((room.water_total_liter ?? 0) / 1000).toFixed(3)} m³
                                    </p>
                                </div>

                                {/* Listrik */}
                                <div className="rounded-2xl bg-yellow-50 p-3">
                                    <p className="font-inter text-xs text-yellow-600">⚡ Daya</p>
                                    <p className="mt-1 font-poppins text-lg font-bold text-yellow-700">
                                        {Number(room.power ?? 0).toFixed(1)}
                                        <span className="font-inter text-xs font-normal ml-1">W</span>
                                    </p>
                                    <p className="font-inter text-xs text-yellow-500 mt-0.5">
                                        Total: {Number(room.energy_kwh_total ?? 0).toFixed(3)} kWh
                                    </p>
                                </div>

                                {/* Voltage */}
                                <div className="rounded-2xl bg-[#F8F8F8] p-3">
                                    <p className="font-inter text-xs text-[#777]">Tegangan</p>
                                    <p className="mt-1 font-poppins text-base font-semibold text-[#2F2F2F]">
                                        {Number(room.voltage ?? 0).toFixed(1)}
                                        <span className="font-inter text-xs font-normal ml-1">V</span>
                                    </p>
                                </div>

                                {/* Current */}
                                <div className="rounded-2xl bg-[#F8F8F8] p-3">
                                    <p className="font-inter text-xs text-[#777]">Arus</p>
                                    <p className="mt-1 font-poppins text-base font-semibold text-[#2F2F2F]">
                                        {Number(room.current ?? 0).toFixed(3)}
                                        <span className="font-inter text-xs font-normal ml-1">A</span>
                                    </p>
                                </div>

                                {/* Frekuensi */}
                                <div className="rounded-2xl bg-[#F8F8F8] p-3">
                                    <p className="font-inter text-xs text-[#777]">Frekuensi</p>
                                    <p className="mt-1 font-poppins text-base font-semibold text-[#2F2F2F]">
                                        {Number(room.frequency ?? 0).toFixed(1)}
                                        <span className="font-inter text-xs font-normal ml-1">Hz</span>
                                    </p>
                                </div>

                                {/* Power Factor */}
                                <div className="rounded-2xl bg-[#F8F8F8] p-3">
                                    <p className="font-inter text-xs text-[#777]">Power Factor</p>
                                    <p className="mt-1 font-poppins text-base font-semibold text-[#2F2F2F]">
                                        {Number(room.pf ?? 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Relay controls */}
                            <div className="mt-4 border-t border-[#F0F0F0] pt-4">
                                <p className="mb-2 font-inter text-xs font-medium text-[#777]">Kontrol Relay</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRelay(room.room_id, room.number, "relay_on")}
                                        disabled={loading}
                                        suppressHydrationWarning
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-50 px-3 py-2 font-inter text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                                    >
                                        <Power size={13} />
                                        ON
                                    </button>
                                    <button
                                        onClick={() => handleRelay(room.room_id, room.number, "relay_off")}
                                        disabled={loading}
                                        suppressHydrationWarning
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-red-50 px-3 py-2 font-inter text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                    >
                                        <PowerOff size={13} />
                                        OFF
                                    </button>
                                    <button
                                        onClick={() => handleRelay(room.room_id, room.number, "reset_nvs")}
                                        disabled={loading}
                                        suppressHydrationWarning
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gray-50 px-3 py-2 font-inter text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <RefreshCw size={13} />
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}