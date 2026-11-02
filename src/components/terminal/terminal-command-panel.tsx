"use client";

import { AlertTriangle, Circle } from "lucide-react";
import Swal from "sweetalert2";
import {
    NORMAL_COMMANDS,
    DANGER_COMMANDS,
    LEVEL_STYLE,
} from "../../types/terminal";

type Props = {
    sending: boolean;
    history: string[];
    onCommand: (cmd: string) => void;
    onHistorySelect: (cmd: string) => void;
};

export default function TerminalCommandPanel({
    sending,
    history,
    onCommand,
    onHistorySelect,
}: Props) {
    async function handleDangerCommand(cmd: string, label: string, desc: string) {
        const result = await Swal.fire({
            title: `${label}?`,
            text: desc,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, lanjutkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#b91c1c",
        });
        if (result.isConfirmed) onCommand(cmd);
    }

    return (
        <div className="w-64 shrink-0 flex flex-col gap-3">

            {/* Quick Commands — normal */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-4 flex flex-col gap-3">
                <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                    Quick Commands
                </p>
                <div className="space-y-1.5">
                    {NORMAL_COMMANDS.map((c) => (
                        <button
                            key={c.cmd}
                            onClick={() => onCommand(c.cmd)}
                            disabled={sending}
                            title={c.desc}
                            className="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 font-inter text-xs transition group disabled:opacity-50 bg-[#F8F8F8] text-[#444] hover:bg-[#F0F0F0]"
                        >
                            <span className="font-medium">{c.label}</span>
                            <span className="font-mono text-[10px] text-[#999] opacity-50 group-hover:opacity-80 transition">
                                {c.cmd}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-3xl border border-red-100 bg-white p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <p className="font-poppins text-sm font-semibold text-red-600">
                        Danger Zone
                    </p>
                </div>
                <div className="space-y-1.5">
                    {DANGER_COMMANDS.map((c) => (
                        <button
                            key={c.cmd}
                            onClick={() => handleDangerCommand(c.cmd, c.label, c.desc)}
                            disabled={sending}
                            title={c.desc}
                            className="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 font-inter text-xs transition group disabled:opacity-50 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                            <span className="font-medium">{c.label}</span>
                            <span className="font-mono text-[10px] text-red-400 opacity-50 group-hover:opacity-80 transition">
                                {c.cmd}
                            </span>
                        </button>
                    ))}
                </div>
                <p className="font-inter text-[10px] text-red-400 leading-relaxed">
                    Tindakan ini tidak dapat dibatalkan. Pastikan sebelum mengirim.
                </p>
            </div>

            {/* Keterangan */}
            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-4 flex flex-col gap-2.5">
                <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                    Keterangan
                </p>
                <div className="space-y-2">
                    {(["INFO", "WARN", "ERROR"] as const).map((lvl) => (
                        <div key={lvl} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_STYLE[lvl].dot}`} />
                            <span className="font-inter text-xs text-[#666]">{lvl}</span>
                        </div>
                    ))}
                    <div className="border-t border-[#F0F0F0] pt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Circle size={6} className="fill-emerald-400 text-emerald-400 shrink-0" />
                            <span className="font-inter text-xs text-[#666]">Log dari ESP32</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Circle size={6} className="fill-blue-400 text-blue-400 shrink-0" />
                            <span className="font-inter text-xs text-[#666]">Log sistem</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Riwayat Command */}
            {history.length > 0 && (
                <div className="rounded-3xl border border-[#EAEAEA] bg-white p-4 flex flex-col gap-2.5">
                    <p className="font-poppins text-sm font-semibold text-[#2F2F2F]">
                        Riwayat Command
                    </p>
                    <div className="space-y-1">
                        {history.slice(0, 8).map((h, i) => (
                            <button
                                key={i}
                                onClick={() => onHistorySelect(h)}
                                className="w-full text-left rounded-xl px-2.5 py-1.5 font-mono text-xs text-[#555] hover:bg-[#F8F8F8] transition"
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}