"use client";

import { Terminal, Wifi, WifiOff, Download, Trash2 } from "lucide-react";
import type { LogLevel } from "../../types/terminal";

type Props = {
    mqttConnected: boolean;
    filterLevel: LogLevel | "ALL";
    onFilterChange: (level: LogLevel | "ALL") => void;
    onExport: () => void;
    onClear: () => void;
};

export default function TerminalHeader({
    mqttConnected,
    filterLevel,
    onFilterChange,
    onExport,
    onClear,
}: Props) {
    return (
        <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-[#7B1113]">
                    <Terminal size={16} className="text-white" />
                </div>
                <div>
                    <h2 className="font-poppins text-base font-bold text-[#2F2F2F]">
                        Remote Terminal
                    </h2>
                    <p className="font-inter text-xs text-[#999]">
                        Monitor log & kirim command ke ESP32
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Connection badge */}
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium font-inter border ${mqttConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-600 border-red-200"
                    }`}>
                    {mqttConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {mqttConnected ? "Connected" : "Disconnected"}
                </div>

                {/* Filter buttons */}
                {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                    <button
                        key={lvl}
                        onClick={() => onFilterChange(lvl)}
                        className={`rounded-xl px-3 py-1.5 font-inter text-xs font-medium transition border ${filterLevel === lvl
                            ? "bg-[#7B1113] text-white border-[#7B1113]"
                            : "bg-white text-[#666] border-[#EAEAEA] hover:bg-[#F8F8F8]"
                            }`}
                    >
                        {lvl}
                    </button>
                ))}

                <button
                    onClick={onExport}
                    className="flex items-center gap-1.5 rounded-xl border border-[#EAEAEA] bg-white px-3 py-1.5 font-inter text-xs text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    <Download size={12} />
                    Export
                </button>

                <button
                    onClick={onClear}
                    className="flex items-center gap-1.5 rounded-xl border border-[#EAEAEA] bg-white px-3 py-1.5 font-inter text-xs text-[#666] transition hover:bg-[#F8F8F8]"
                >
                    <Trash2 size={12} />
                    Clear
                </button>
            </div>
        </div>
    );
}