"use client";

import { Cpu, MapPin } from "lucide-react";
import { useBroiler } from "@/components/broiler/broiler-provider";

/** Sensor fisik dan lahan aktif. */
export default function ContextBar() {
    const b = useBroiler();

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-2xl bg-[#7B1113] px-4 py-2 font-inter text-sm text-white"><Cpu size={14} /> Sensor</span>
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
        </div>
    );
}
