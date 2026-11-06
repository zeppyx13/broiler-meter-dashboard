"use client";

import { Cpu, FlaskConical, MapPin } from "lucide-react";
import { useBroiler } from "@/components/broiler/broiler-provider";

/** Pilihan sumber data (sensor fisik / simulasi backend) dan lahan aktif. */
export default function ContextBar() {
    const b = useBroiler();
    const sources = [
        { key: "real" as const, label: "Sensor", icon: Cpu },
        { key: "simulation" as const, label: "Simulasi", icon: FlaskConical },
    ];

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white" role="group" aria-label="Sumber data">
                {sources.map((s) => {
                    const Icon = s.icon;
                    const active = b.source === s.key;
                    return (
                        <button
                            key={s.key}
                            onClick={() => b.setSource(s.key)}
                            aria-pressed={active}
                            suppressHydrationWarning
                            className={`flex items-center gap-1.5 px-4 py-2 font-inter text-sm transition ${active ? "bg-[#7B1113] text-white" : "text-[#666] hover:bg-[#F8F8F8]"}`}
                        >
                            <Icon size={14} /> {s.label}
                        </button>
                    );
                })}
            </div>
            {b.farms.length > 1 && (
                <label className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white px-3 py-1.5 font-inter text-sm text-[#555]">
                    <MapPin size={14} className="text-[#7B1113]" />
                    <select
                        aria-label="Pilih lahan"
                        value={b.farmId ?? ""}
                        onChange={(e) => b.selectFarm(Number(e.target.value))}
                        suppressHydrationWarning
                        className="bg-transparent outline-none"
                    >
                        {b.farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </label>
            )}
            {b.source === "simulation" && (
                <span className="rounded-full bg-[#FFF4E5] px-3 py-1 font-inter text-xs font-medium text-[#9A6B14]">
                    Data simulasi backend, bukan pembacaan sensor
                </span>
            )}
        </div>
    );
}
