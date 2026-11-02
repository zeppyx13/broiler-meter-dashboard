// src/components/iot/terminal/terminal-log-panel.tsx
"use client";

import { useRef } from "react";
import { Terminal, Circle, ChevronRight, Send } from "lucide-react";
import { type LogEntry, LEVEL_STYLE, formatTs } from "../../types/terminal";

type Props = {
    logs: LogEntry[];
    autoScroll: boolean;
    sending: boolean;
    input: string;
    logEndRef: React.RefObject<HTMLDivElement>;
    onToggleAutoScroll: () => void;
    onWheel: () => void;
    onInputChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
};

export default function TerminalLogPanel({
    logs,
    autoScroll,
    sending,
    input,
    logEndRef,
    onToggleAutoScroll,
    onWheel,
    onInputChange,
    onKeyDown,
    onSubmit,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-1 flex-col min-w-0 rounded-3xl border border-[#EAEAEA] bg-[#0F1117] overflow-hidden">

            {/* Terminal title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-xs text-white/30 ml-2">
                    coasther/device/+/log — {logs.length} entries
                </span>
                <div className="ml-auto">
                    <button
                        onClick={onToggleAutoScroll}
                        className={`font-mono text-xs transition ${autoScroll ? "text-emerald-400" : "text-white/30"
                            }`}
                    >
                        {autoScroll ? "● auto-scroll ON" : "○ auto-scroll OFF"}
                    </button>
                </div>
            </div>

            {/* Log entries */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono text-sm"
                onWheel={onWheel}
            >
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                        <Terminal size={32} className="text-white" />
                        <p className="text-white text-xs">Menunggu log dari ESP32...</p>
                    </div>
                )}

                {logs.map((log) => {
                    const style = LEVEL_STYLE[log.level];
                    return (
                        <div
                            key={log.id}
                            className="flex items-start gap-3 py-0.5 group hover:bg-white/[0.02] rounded px-1"
                        >
                            <span className="text-white/25 text-xs shrink-0 mt-0.5 w-20">
                                {formatTs(log.ts)}
                            </span>
                            <span className={`text-xs font-bold shrink-0 w-12 mt-0.5 ${style.text}`}>
                                {log.level}
                            </span>
                            <div className="mt-1.5 shrink-0">
                                <Circle
                                    size={6}
                                    className={log.source === "mqtt"
                                        ? "fill-emerald-400 text-emerald-400"
                                        : "fill-blue-400 text-blue-400"
                                    }
                                />
                            </div>
                            <span className={`flex-1 break-all leading-relaxed ${log.source === "system"
                                ? "text-white/40 italic"
                                : "text-white/80"
                                }`}>
                                {log.msg}
                            </span>
                        </div>
                    );
                })}
                <div ref={logEndRef} />
            </div>

            {/* Command input */}
            <div className="border-t border-white/5 p-3">
                <form onSubmit={onSubmit} className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-emerald-400 shrink-0" />
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Ketik command... (↑↓ untuk history)"
                        disabled={sending}
                        className="flex-1 bg-transparent font-mono text-sm text-white/80 placeholder:text-white/20 outline-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <button
                        type="submit"
                        disabled={sending || !input.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-[#7B1113] px-3 py-1.5 font-inter text-xs text-white transition hover:bg-[#9B1416] disabled:opacity-40"
                    >
                        <Send size={11} />
                        {sending ? "Kirim..." : "Kirim"}
                    </button>
                </form>
            </div>
        </div>
    );
}