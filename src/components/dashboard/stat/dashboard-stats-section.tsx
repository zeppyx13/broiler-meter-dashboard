"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Users, Droplets, Zap } from "lucide-react";
import StatCard from "./stat-card";
import { getDashboardStats } from "@/lib/dashboard-api";
import { socket } from "@/lib/socket";
import type { StatItem } from "@/types/dashboard";

type TelemetryPayload = {
    room_id?: number;
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

export default function DashboardStatsSection() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["dashboard-stats"],
        queryFn: getDashboardStats,
    });

    const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);

    useEffect(() => {
        socket.connect();

        const onTelemetryUpdate = (payload: TelemetryPayload) => {
            setTelemetry(payload);
        };

        socket.on("telemetry_update", onTelemetryUpdate);

        return () => {
            socket.off("telemetry_update", onTelemetryUpdate);
            socket.disconnect();
        };
    }, []);

    const stats = useMemo<StatItem[]>(() => {
        if (!data) return [];

        const liveWaterM3 =
            telemetry?.water_total_liter != null
                ? Number((telemetry.water_total_liter / 1000).toFixed(3))
                : data.waterUsage;

        const liveElectricityKwh =
            telemetry?.energy_kwh_total != null
                ? Number(telemetry.energy_kwh_total.toFixed(3))
                : data.electricityUsage;

        return [
            {
                title: "Total Kamar",
                value: String(data.totalRooms),
                desc: `${data.availableRooms} kamar tersedia`,
                icon: BedDouble,
            },
            {
                title: "Total Penghuni",
                value: String(data.totalTenants),
                desc: `${data.activeTenants} aktif bulan ini`,
                icon: Users,
            },
            {
                title: "Pemakaian Air",
                value: `${liveWaterM3} m³`,
                desc:
                    telemetry?.flow_rate_lpm != null
                        ? `Live flow ${telemetry.flow_rate_lpm} L/min`
                        : `Naik ${data.waterGrowth}% dari bulan lalu`,
                icon: Droplets,
            },
            {
                title: "Pemakaian Listrik",
                value: `${liveElectricityKwh} kWh`,
                desc:
                    telemetry?.power != null
                        ? `Live ${telemetry.power} W`
                        : data.electricityStatus,
                icon: Zap,
            },
        ];
    }, [data, telemetry]);

    if (isLoading) {
        return (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-35 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white"
                    />
                ))}
            </section>
        );
    }

    if (isError || !data) {
        return (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="col-span-full rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    Gagal memuat data statistik dashboard.
                </div>
            </section>
        );
    }

    return (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
                <StatCard key={item.title} item={item} />
            ))}
        </section>
    );
}